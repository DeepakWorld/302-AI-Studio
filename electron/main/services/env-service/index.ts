import { getLocalSandboxHealthStatus } from "@electron/main/apis/code-agent";
import { broadcastService } from "@electron/main/services/broadcast-service";
import { generalSettingsService } from "@electron/main/services/settings-service/general-settings-service";
import { providerStorage } from "@electron/main/services/storage-service/provider-storage";
import { isCommandNotFound } from "@electron/main/utils/cmd";
import { exec, spawn } from "child_process";
import { app, shell, type IpcMainInvokeEvent } from "electron";
import fs from "fs";
import getPort from "get-port";
import path from "path";
import { match } from "ts-pattern";
import { promisify } from "util";
import { CRON_EXPRESSION, schedulerService } from "../scheduler-service";

const execAsync = promisify(exec);

/** Default port for local sandbox API */
export const DEFAULT_SANDBOX_PORT = 8123;

export class EnvService {
	/** Default port for local sandbox API */
	private runtimePort: number | null = null;

	// Localization helper method
	private async t(zh: string, en: string): Promise<string> {
		const language = await generalSettingsService.getLanguage();
		return language === "zh" ? zh : en;
	}

	/**
	 * Get the runtime port
	 */
	public getRuntimePort(): number | null {
		return this.runtimePort;
	}

	/**
	 * Get the path to docker-compose.yml
	 * In development: static/docker-compose.yml in project root
	 * In production: docker-compose.yml in app resources directory
	 */
	private getDockerComposePath(): string {
		if (app.isPackaged) {
			return path.join(process.resourcesPath, "docker-compose.yml");
		}
		return path.join(process.cwd(), "static", "docker-compose.yml");
	}

	/**
	 * Get the runtime compose directory
	 * In development: <project-root>/ai302
	 * In production: <userData>/ai302
	 */
	private getRuntimeComposeDir(): string {
		if (app.isPackaged) {
			return path.join(app.getPath("userData"), "ai302");
		}
		return path.join(process.cwd(), "ai302");
	}

	/**
	 * Get the runtime compose file path
	 */
	private getRuntimeComposePath(): string {
		return path.join(this.getRuntimeComposeDir(), "docker-compose.yml");
	}

	/**
	 * Get the runtime compose directory path via IPC
	 */
	async getComposeDirectory(_event: IpcMainInvokeEvent): Promise<string> {
		return this.getRuntimeComposeDir();
	}

	/**
	 * Open the runtime compose directory in system explorer via IPC
	 */
	async openComposeDirectory(_event: IpcMainInvokeEvent): Promise<boolean> {
		const dir = this.getRuntimeComposeDir();
		try {
			// Ensure directory exists
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			const error = await shell.openPath(dir);
			return error === "";
		} catch (error) {
			console.error("[EnvService] Failed to open compose directory:", error);
			return false;
		}
	}

	/**
	 * Prepare runtime environment for docker-compose
	 * - Copies template compose to runtime directory
	 * - Detects available port (starting from DEFAULT_SANDBOX_PORT)
	 * - Writes .env file with AI302_API_KEY, HOST_DATA_PATH, and HOST_PORT
	 * @param apiKey The API key to inject
	 * @returns The allocated host port
	 */
	private async prepareRuntimeCompose(apiKey: string): Promise<number> {
		const templatePath = this.getDockerComposePath();
		const runtimeDir = this.getRuntimeComposeDir();
		const runtimeComposePath = this.getRuntimeComposePath();
		const envFilePath = path.join(runtimeDir, ".env");

		// Ensure runtime directory exists
		fs.mkdirSync(runtimeDir, { recursive: true });

		// Copy template compose to runtime directory
		fs.copyFileSync(templatePath, runtimeComposePath);

		// Find available port (starting from default, will find next available if occupied)
		const hostPort = await getPort({ port: DEFAULT_SANDBOX_PORT });

		// Store the allocated port
		this.runtimePort = hostPort;

		// Write .env file with runtime values
		const envContent = [
			`AI302_API_KEY=${apiKey}`,
			`HOST_DATA_PATH=${runtimeDir}`,
			`HOST_PORT=${hostPort}`,
		].join("\n");
		fs.writeFileSync(envFilePath, envContent, "utf-8");

		console.log("[Local Vibe] Runtime compose prepared at:", runtimeDir);
		console.log("[Local Vibe] Allocated host port:", hostPort);

		return hostPort;
	}

	/**
	 * Execute podman compose up -d
	 * Runs podman compose in detached mode to start services
	 * Prepares runtime compose with .env file before starting
	 * @returns { isOk: boolean; port?: number; output?: string; error?: string }
	 */
	private async runPodmanComposeUp(): Promise<{
		isOk: boolean;
		port?: number;
		output?: string;
		error?: string;
	}> {
		try {
			// Get API key from provider storage
			const { valid, apiKey } = await providerStorage.validate302AIProvider();
			if (!valid || !apiKey) {
				console.warn("[Local Vibe] No valid 302AI API key found, proceeding without injection");
			}

			// Prepare runtime compose with .env file (includes port detection)
			const hostPort = await this.prepareRuntimeCompose(apiKey);

			const composePath = this.getRuntimeComposePath();

			// Execute: podman-compose -f <path> up -d
			// Use broadcast to show progress
			const result = await this.runCommandWithBroadcast(
				"podman-compose",
				["-f", composePath, "up", "-d"],
				"podman-compose-up",
			);

			if (!result.isOk) {
				const errorMessage = result.output;
				// Check if podman-compose command is not found
				if (isCommandNotFound(errorMessage)) {
					const notInstalledMsg = await this.t(
						"podman-compose 未安装。请先安装 podman-compose。",
						"podman-compose is not installed. Please install podman-compose first.",
					);
					console.error("[Local Vibe] podman-compose up -d error:", notInstalledMsg);
					return { isOk: false, error: notInstalledMsg };
				}

				console.error("[Local Vibe] podman-compose up -d error:", errorMessage);
				return { isOk: false, error: errorMessage };
			}

			console.log("[Local Vibe] podman-compose up -d:", result.output);
			return { isOk: true, port: hostPort, output: result.output };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[Local Vibe] podman-compose up -d error:", errorMessage);
			return { isOk: false, error: errorMessage };
		}
	}

	/**
	 * Execute podman-compose stop
	 * Stops containers without removing them, allowing fast restart with podman-compose up
	 * Uses runtime compose if exists, falls back to template compose
	 * @returns { isOk: boolean; output?: string; error?: string }
	 */
	private async runPodmanComposeStop(): Promise<{
		isOk: boolean;
		output?: string;
		error?: string;
	}> {
		try {
			// Use runtime compose if exists, otherwise fall back to template
			const runtimePath = this.getRuntimeComposePath();
			const composePath = fs.existsSync(runtimePath) ? runtimePath : this.getDockerComposePath();

			// Execute: podman-compose -f <path> stop
			const result = await this.runCommandWithBroadcast(
				"podman-compose",
				["-f", composePath, "stop"],
				"podman-compose-stop",
			);

			if (!result.isOk) {
				const errorMessage = result.output;
				// Check if podman-compose command is not found - treat as non-fatal for stop
				if (isCommandNotFound(errorMessage)) {
					console.warn("[Local Vibe] podman-compose stop: podman-compose not found (non-fatal)");
					return { isOk: true, output: "podman-compose not installed, nothing to stop" };
				}

				console.error("[Local Vibe] podman-compose stop error:", errorMessage);
				return { isOk: false, error: errorMessage };
			}

			console.log("[Local Vibe] podman-compose stop:", result.output);
			return { isOk: true, output: result.output };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[Local Vibe] podman-compose stop error:", errorMessage);
			return { isOk: false, error: errorMessage };
		}
	}

	private async checkCommand(command: string): Promise<{
		isOk: boolean;
		isValid: boolean;
	}> {
		try {
			await execAsync(command);
			return { isOk: true, isValid: true };
		} catch (error) {
			return {
				isOk: !isCommandNotFound(error),
				isValid: false,
			};
		}
	}

	private async runCommandWithBroadcast(
		command: string,
		args: string[],
		step: string,
		useShell = true,
	): Promise<{ isOk: boolean; output: string }> {
		return new Promise((resolve) => {
			let output = "";

			broadcastService.broadcastChannelToAll("install-log", {
				step,
				type: "start",
				data: `Starting: ${step}`,
			});

			const proc = spawn(command, args, {
				shell: useShell,
				windowsHide: true,
			});

			// Helper to process output data (handles \r progress bars)
			const processOutput = (data: Buffer, type: "stdout" | "stderr") => {
				const text = data.toString();
				output += text;
				// Replace \r with \n to ensure progress bars are shown as separate lines
				// Some tools use \r to overwrite the same line for progress animation
				const normalized = text.replace(/\r/g, "\n").replace(/\n+/g, "\n");
				if (normalized.trim()) {
					broadcastService.broadcastChannelToAll("install-log", {
						step,
						type,
						data: normalized,
					});
				}
			};

			proc.stdout.on("data", (data) => processOutput(data, "stdout"));
			proc.stderr.on("data", (data) => processOutput(data, "stderr"));

			proc.on("close", (code) => {
				broadcastService.broadcastChannelToAll("install-log", {
					step,
					type: "complete",
					data: `Process exited with code ${code}`,
				});
				resolve({ isOk: code === 0, output });
			});

			proc.on("error", (error) => {
				const errorMsg = error.message;
				output += `\nError: ${errorMsg}`;
				broadcastService.broadcastChannelToAll("install-log", {
					step,
					type: "error",
					data: errorMsg,
				});
				resolve({ isOk: false, output });
			});
		});
	}

	/**
	 * Shows password input dialog via AppleScript
	 */
	private async getSudoPasswordViaAppleScript(step: string): Promise<{
		success: boolean;
		password?: string;
		wasCancelled?: boolean;
		error?: string;
	}> {
		try {
			const title = await this.t("需要管理员权限", "Administrator Password Required");
			const message = await this.t(
				`安装 ${step} 需要管理员权限。请输入您的 macOS 用户密码。`,
				`Installing ${step} requires administrator privileges. Please enter your macOS user password.`,
			);
			const buttonOk = await this.t("确定", "OK");
			const buttonCancel = await this.t("取消", "Cancel");

			// Use heredoc to avoid escaping issues
			const appleScript = `display dialog "${message}" with title "${title}" default answer "" buttons {"${buttonCancel}", "${buttonOk}"} default button "${buttonOk}" with hidden answer`;
			const { stdout, stderr } = await execAsync(`osascript -e '${appleScript}'`);

			// AppleScript might output to stdout or stderr
			const output = stdout || stderr || "";

			// Parse result: "button returned:OK, text returned:password" (AppleScript format)
			// Try multiple patterns to be more robust
			const patterns = [
				/text returned:(.+?)(?:,|$)/m, // text returned:password,
				/text returned:"(.+?)"/m, // text returned:"password"
				/text returned:'(.+?)'/m, // text returned:'password'
				/text returned:(.+)/m, // text returned:password (last resort)
			];

			for (const pattern of patterns) {
				const match = output.match(pattern);
				if (match && match[1]) {
					const password = match[1].trim();
					console.log("[EnvService] Extracted password (length):", password.length);
					return { success: true, password };
				}
			}

			console.error(
				"[EnvService] Failed to parse AppleScript output. stdout:",
				stdout,
				"stderr:",
				stderr,
			);
			return { success: false, error: await this.t("无法获取密码", "Failed to get password") };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[EnvService] AppleScript error:", errorMessage);

			// User cancelled - check various possible error messages
			if (
				errorMessage.includes("User cancelled") ||
				errorMessage.includes("-128") ||
				errorMessage.includes("cancel")
			) {
				return {
					success: false,
					wasCancelled: true,
					error: await this.t("用户取消", "User cancelled"),
				};
			}

			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Runs command with sudo using AppleScript to get password
	 */
	private async runSudoCommandWithBroadcast(
		command: string,
		args: string[],
		step: string,
	): Promise<{ isOk: boolean; wasCancelled?: boolean }> {
		// Get password
		const passwordResult = await this.getSudoPasswordViaAppleScript(step);

		if (!passwordResult.success) {
			broadcastService.broadcastChannelToAll("install-log", {
				step,
				type: "error",
				data:
					passwordResult.error || (await this.t("用户取消操作", "User cancelled the operation")),
			});
			return { isOk: false, wasCancelled: passwordResult.wasCancelled };
		}

		return new Promise((resolve) => {
			broadcastService.broadcastChannelToAll("install-log", {
				step,
				type: "start",
				data: `Starting: ${step}`,
			});

			// Use sudo -S to read password from stdin
			const proc = spawn("sudo", ["-S", command, ...args], {
				shell: false,
				windowsHide: true,
			});

			// Write password
			proc.stdin.write(`${passwordResult.password}\n`);
			proc.stdin.end();

			const processOutput = (data: Buffer, type: "stdout" | "stderr") => {
				const text = data.toString().replace(/\r/g, "\n").replace(/\n+/g, "\n");
				if (text.trim()) {
					broadcastService.broadcastChannelToAll("install-log", { step, type, data: text });
				}
			};

			proc.stdout.on("data", (data) => processOutput(data, "stdout"));
			proc.stderr.on("data", (data) => processOutput(data, "stderr"));

			proc.on("close", (code) => {
				broadcastService.broadcastChannelToAll("install-log", {
					step,
					type: "complete",
					data: `Process exited with code ${code}`,
				});
				resolve({ isOk: code === 0 });
			});

			proc.on("error", (error) => {
				broadcastService.broadcastChannelToAll("install-log", {
					step,
					type: "error",
					data: error.message,
				});
				resolve({ isOk: false });
			});
		});
	}

	private async checkScoop(): Promise<{
		isOk: boolean;
		isValid: boolean;
	}> {
		return this.checkCommand("scoop --version");
	}

	private async checkWSL(): Promise<{
		isOk: boolean;
		isValid: boolean;
	}> {
		return this.checkCommand("wsl --version");
	}

	private async checkHomebrew(): Promise<{
		isOk: boolean;
		isValid: boolean;
	}> {
		return this.checkCommand("brew --version");
	}

	private async checkAptGet(): Promise<{
		isOk: boolean;
		isValid: boolean;
	}> {
		return this.checkCommand("apt-get --version");
	}

	/**
	 * Checks if podman-compose is installed and accessible
	 * @returns { isOk: boolean; isValid: boolean } - isOk: operation success, isValid: podman-compose is available
	 */
	private async checkPodmanCompose(): Promise<{
		isOk: boolean;
		isValid: boolean;
	}> {
		return this.checkCommand("podman-compose --version");
	}

	/**
	 * Checks if podman is healthy (ai302-machine exists)
	 * @returns { isOk: boolean; isHealth: boolean; timestamp?: number } - isOk: operation success, isHealth: podman health check result (ai302-machine exists), timestamp when called via startPodmanHealthCheck
	 */
	private async checkPodmanHealth(): Promise<{
		isOk: boolean;
		isHealth: boolean;
	}> {
		const machineCheck = await this.checkPodmanMachineExists();
		return {
			isOk: machineCheck.isOk,
			isHealth: machineCheck.exists,
		};
	}

	private async checkLocalSandboxHealth(): Promise<{
		isOk: boolean;
		isHealth: boolean;
		error?: string;
	}> {
		try {
			await getLocalSandboxHealthStatus();
			return { isOk: true, isHealth: true };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[EnvService] Local sandbox health check failed:", errorMessage);
			return { isOk: true, isHealth: false, error: errorMessage };
		}
	}

	/**
	 * Checks if the ai302-machine exists in podman machine list
	 * @returns { isOk: boolean; exists: boolean } - isOk: operation success, exists: whether machine exists
	 */
	private async checkPodmanMachineExists(): Promise<{ isOk: boolean; exists: boolean }> {
		try {
			const { stdout } = await execAsync("podman machine list --format json");
			const machines = JSON.parse(stdout) as Array<{ Name: string }>;
			const exists = machines.some((machine) => machine.Name === "ai302-machine");
			return { isOk: true, exists };
		} catch (error) {
			if (isCommandNotFound(error)) {
				return { isOk: true, exists: false };
			}
			return { isOk: false, exists: false };
		}
	}

	/**
	 * Validates if podman is installed and accessible, and ai302-machine exists
	 * Also checks if podman-compose is available
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; isValid: boolean; output?: string; error?: string } - isOk: operation success, isValid: podman installed AND machine exists AND podman-compose available, output: command output, error: error message if failed
	 */
	async validPodman(
		_event: IpcMainInvokeEvent,
	): Promise<{ isOk: boolean; isValid: boolean; output?: string; error?: string }> {
		try {
			const { stdout, stderr } = await execAsync("podman --version");
			const podmanInstalled = stdout.toLowerCase().includes("podman version");

			if (!podmanInstalled) {
				return { isOk: true, isValid: false, output: `${stdout}\n${stderr}` };
			}

			// Podman is installed, check if ai302-machine exists
			const machineCheck = await this.checkPodmanMachineExists();
			if (!machineCheck.isOk) {
				return { isOk: false, isValid: false, error: "Failed to check machine list" };
			}

			// Check if podman-compose is available
			const composeCheck = await this.checkPodmanCompose();
			if (!composeCheck.isOk) {
				return { isOk: false, isValid: false, error: "Failed to check podman-compose" };
			}
			if (!composeCheck.isValid) {
				const composeError = await this.t(
					"podman-compose 未安装。请先安装 podman-compose。",
					"podman-compose is not installed. Please install podman-compose first.",
				);
				return { isOk: true, isValid: false, error: composeError };
			}

			return { isOk: true, isValid: machineCheck.exists, output: stdout };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (isCommandNotFound(error)) {
				return { isOk: true, isValid: false, error: errorMessage };
			}

			return { isOk: false, isValid: false, error: errorMessage };
		}
	}

	/**
	 * Starts the periodic Podman health check (every 30 seconds)
	 * Results are broadcast to all renderer processes via "podman-health" channel
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	async startPodmanHealthCheck(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		const taskName = "podman-health-check";
		const podmanHealthCheckJob = async () => {
			const result = await this.checkPodmanHealth();
			const healthData = {
				...result,
				timestamp: Date.now(),
			};
			broadcastService.broadcastChannelToAll(taskName, healthData);
		};

		try {
			if (schedulerService.hasTask(taskName)) {
				schedulerService.removeTask(taskName);
			}

			const success = schedulerService.addTask(
				taskName,
				CRON_EXPRESSION.EVERY_10_SECONDS,
				podmanHealthCheckJob,
			);

			if (!success) {
				return { isOk: false };
			}

			// Run initial check immediately
			const initialResult = await this.checkPodmanHealth();
			broadcastService.broadcastChannelToAll(taskName, {
				...initialResult,
				timestamp: Date.now(),
			});

			return { isOk: true };
		} catch (error) {
			console.error("[EnvService] Failed to start Podman health check:", error);
			return { isOk: false };
		}
	}

	/**
	 * Starts the periodic Local Sandbox health check (every 30 seconds)
	 * Results are broadcast to all renderer processes via "local-sandbox-health-check" channel
	 */
	async startLocalSandboxHealthCheck(): Promise<{ isOk: boolean }> {
		const taskName = "local-sandbox-health-check";
		const localSandboxHealthCheckJob = async () => {
			const result = await this.checkLocalSandboxHealth();
			const healthData = {
				...result,
				timestamp: Date.now(),
			};
			broadcastService.broadcastChannelToAll(taskName, healthData);
		};

		try {
			if (schedulerService.hasTask(taskName)) {
				schedulerService.removeTask(taskName);
			}

			const success = schedulerService.addTask(
				taskName,
				CRON_EXPRESSION.EVERY_10_SECONDS,
				localSandboxHealthCheckJob,
			);

			if (!success) {
				return { isOk: false };
			}

			// Run initial check immediately
			const initialResult = await this.checkLocalSandboxHealth();
			broadcastService.broadcastChannelToAll(taskName, {
				...initialResult,
				timestamp: Date.now(),
			});

			return { isOk: true };
		} catch (error) {
			console.error("[EnvService] Failed to start Local Sandbox health check:", error);
			return { isOk: false };
		}
	}

	/**
	 * Stops the periodic Local Sandbox health check
	 */
	async stopLocalSandboxHealthCheck(): Promise<{ isOk: boolean }> {
		const taskName = "local-sandbox-health-check";
		try {
			if (schedulerService.hasTask(taskName)) {
				schedulerService.removeTask(taskName);
			}
			return { isOk: true };
		} catch (error) {
			console.error("[EnvService] Failed to stop Local Sandbox health check:", error);
			return { isOk: false };
		}
	}

	/**
	 * Installs WSL2 on Windows
	 *
	 * Broadcasts log events via "install-log" channel with the following format:
	 * - Start:  { step: "wsl", type: "start", data: "Starting: wsl" }
	 * - Stdout: { step: "wsl", type: "stdout", data: "Installing: Windows Subsystem for Linux..." }
	 * - Stderr: { step: "wsl", type: "stderr", data: "..." }
	 * - Complete: { step: "wsl", type: "complete", data: "Process exited with code 0" }
	 * - Error:  { step: "wsl", type: "error", data: "Error message" }
	 *
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	async installWSL(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		const result = await this.runCommandWithBroadcast("wsl", ["--install"], "wsl");
		return result;
	}

	/**
	 * Installs Scoop on Windows
	 *
	 * Broadcasts log events via "install-log" channel for two steps:
	 * - scoop-policy: Sets execution policy for PowerShell
	 * - scoop-install: Downloads and installs Scoop
	 *
	 * Log event examples:
	 * - Start:  { step: "scoop-policy", type: "start", data: "Starting: scoop-policy" }
	 * - Stdout: { step: "scoop-policy", type: "stdout", data: "..." }
	 * - Complete: { step: "scoop-policy", type: "complete", data: "Process exited with code 0" }
	 * - Start:  { step: "scoop-install", type: "start", data: "Starting: scoop-install" }
	 * - Stdout: { step: "scoop-install", type: "stdout", data: "Initializing..." }
	 * - Complete: { step: "scoop-install", type: "complete", data: "Process exited with code 0" }
	 *
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	async installScoop(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		const scoopInstall = await this.runCommandWithBroadcast(
			"powershell.exe",
			[
				"-ExecutionPolicy",
				"Bypass",
				"-Command",
				"Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression",
			],
			"scoop-install",
			false,
		);

		return scoopInstall;
	}

	/**
	 * Installs Homebrew on macOS
	 *
	 * Broadcasts log events via "install-log" channel with the following format:
	 * - Start:  { step: "homebrew", type: "start", data: "Starting: homebrew" }
	 * - Stdout: { step: "homebrew", type: "stdout", data: "==> Checking for sudo access..." }
	 * - Stdout: { step: "homebrew", type: "stdout", data: "==> Downloading and installing Homebrew..." }
	 * - Stderr: { step: "homebrew", type: "stderr", data: "..." }
	 * - Complete: { step: "homebrew", type: "complete", data: "Process exited with code 0" }
	 * - Error:  { step: "homebrew", type: "error", data: "Error message" }
	 *
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	async installHomebrew(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		const result = await this.runCommandWithBroadcast(
			"/bin/bash",
			[
				"-c",
				'sudo -v && NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
			],
			"homebrew",
		);
		return result;
	}

	/**
	 * Installs podman-compose on the current platform
	 *
	 * Platform-specific installation:
	 * - Windows: pip install podman-compose
	 * - macOS: brew install podman-compose
	 * - Linux: pip3 install podman-compose or apt-get install podman-compose
	 *
	 * Broadcasts log events via "install-log" channel with step: "install-podman-compose"
	 *
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	private async installPodmanCompose(): Promise<{ isOk: boolean }> {
		const platform = process.platform;

		if (platform === "win32") {
			// Windows: Install via pip (podman is installed via scoop which includes pip)
			return this.runCommandWithBroadcast(
				"pip",
				["install", "podman-compose"],
				"install-podman-compose",
			);
		} else if (platform === "darwin") {
			// macOS: Install via Homebrew
			return this.runCommandWithBroadcast(
				"brew",
				["install", "podman-compose"],
				"install-podman-compose",
			);
		} else if (platform === "linux") {
			// Linux: Try pip first, fallback to apt-get
			const pipResult = await this.runCommandWithBroadcast(
				"pip3",
				["install", "podman-compose"],
				"install-podman-compose",
			);
			if (pipResult.isOk) {
				return pipResult;
			}
			// Fallback to apt-get
			return this.runCommandWithBroadcast(
				"sudo",
				["apt-get", "install", "-y", "podman-compose"],
				"install-podman-compose",
			);
		}

		return { isOk: false };
	}

	/**
	 * Initializes the ai302-machine if it doesn't already exist
	 * Checks for existing machine before attempting init
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	private async _initPodmanMachine(): Promise<{ isOk: boolean }> {
		// Check if machine already exists
		const machineCheck = await this.checkPodmanMachineExists();
		if (!machineCheck.isOk) {
			return { isOk: false };
		}

		// Machine already exists, skip init
		if (machineCheck.exists) {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "init-podman",
				type: "stdout",
				data: "Machine 'ai302-machine' already exists, skipping initialization",
			});
			return { isOk: true };
		}

		// Initialize Podman Machine
		const machineInit = await this.runCommandWithBroadcast(
			"podman",
			["machine", "init", "ai302-machine"],
			"init-podman",
		);
		return machineInit;
	}

	/**
	 * Installs Podman with platform-specific logic
	 *
	 * Platform flows:
	 * - Windows: Check/install WSL → Check/install Scoop → Install Podman (if needed) → Install podman-compose (if needed) → Init machine with WSL provider
	 * - macOS: Check/install Homebrew → Install Podman (if needed) → Install podman-compose (if needed) → Init machine
	 * - Linux: Install Podman via apt-get (if needed) → Install podman-compose (if needed)
	 *
	 * If Podman is already installed but ai302-machine doesn't exist, only machine init will be performed.
	 *
	 * Broadcasts log events via "install-log" channel with step identifiers:
	 * - install-wsl, scoop-policy, scoop-install, install-homebrew, install-podman, install-podman-compose, init-podman
	 *
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	async installPodman(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		const platform = process.platform;

		const result = await match(platform)
			.with("win32", () => this._installPodmanWindows())
			.with("darwin", () => this._installPodmanMacOS())
			.with("linux", () => this._installPodmanLinux())
			.otherwise(() => {
				console.error(`[EnvService] Unsupported platform: ${platform}`);
				return { isOk: false };
			});

		// Start health check after successful installation
		if (result.isOk) {
			await this.startPodmanHealthCheck(_event);
		}

		return result;
	}

	/**
	 * Windows installation flow:
	 * 1. Check/install WSL
	 * 2. Check/install Scoop
	 * 3. Install Podman (if not already installed)
	 * 4. Install podman-compose (if not already installed)
	 * 5. Initialize Podman Machine with WSL provider (if not already exists)
	 */
	private async _installPodmanWindows(): Promise<{ isOk: boolean }> {
		// Check if Podman is already installed and machine exists
		const podmanCheck = await this.checkCommand("podman --version");
		const machineCheck = await this.checkPodmanMachineExists();
		const composeCheck = await this.checkPodmanCompose();

		if (podmanCheck.isValid && machineCheck.exists && composeCheck.isValid) {
			// Podman, machine and podman-compose exist, nothing to do
			broadcastService.broadcastChannelToAll("install-log", {
				step: "init-podman",
				type: "stdout",
				data: "Podman, ai302-machine and podman-compose already exist, skipping installation",
			});
			return { isOk: true };
		}

		// 1. Check and install WSL
		const wslCheck = await this.checkWSL();
		if (!wslCheck.isValid) {
			const wslInstall = await this.runCommandWithBroadcast("wsl", ["--install"], "install-wsl");
			if (!wslInstall.isOk) return { isOk: false };
		}

		// 2. Check and install Scoop
		const scoopCheck = await this.checkScoop();
		if (!scoopCheck.isValid) {
			// Install Scoop with execution policy bypass (shell: false to avoid cmd.exe pipe interception)
			const scoopInstall = await this.runCommandWithBroadcast(
				"powershell.exe",
				[
					"-ExecutionPolicy",
					"Bypass",
					"-Command",
					"Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression",
				],
				"scoop-install",
				false,
			);
			if (!scoopInstall.isOk) return { isOk: false };
		}

		// 3. Install Podman (only if not already installed)
		if (!podmanCheck.isValid) {
			const podmanInstall = await this.runCommandWithBroadcast(
				"scoop",
				["install", "podman"],
				"install-podman",
			);
			if (!podmanInstall.isOk) return { isOk: false };
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman",
				type: "stdout",
				data: "Podman already installed, skipping installation",
			});
		}

		// 4. Install podman-compose (only if not already installed)
		if (!composeCheck.isValid) {
			const composeInstall = await this.installPodmanCompose();
			if (!composeInstall.isOk) return { isOk: false };
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman-compose",
				type: "stdout",
				data: "podman-compose already installed, skipping installation",
			});
		}

		// 5. Initialize Podman Machine (only if not already exists)
		return this._initPodmanMachine();
	}

	/**
	 * macOS installation flow:
	 * 1. Check/install Homebrew
	 * 2. Install Podman via Homebrew (if not already installed)
	 * 3. Install podman-compose (if not already installed)
	 * 4. Initialize Podman machine (if not already exists)
	 */
	private async _installPodmanMacOS(): Promise<{ isOk: boolean }> {
		// Check if Podman is already installed and machine exists
		const podmanCheck = await this.checkCommand("podman --version");
		const machineCheck = await this.checkPodmanMachineExists();
		const composeCheck = await this.checkPodmanCompose();

		if (podmanCheck.isValid && machineCheck.exists && composeCheck.isValid) {
			// Podman, machine and podman-compose exist, nothing to do
			broadcastService.broadcastChannelToAll("install-log", {
				step: "init-podman",
				type: "stdout",
				data: "Podman, ai302-machine and podman-compose already exist, skipping installation",
			});
			return { isOk: true };
		}

		// 1. Check and install Homebrew
		const brewCheck = await this.checkHomebrew();
		if (!brewCheck.isValid) {
			const brewInstall = await this.runCommandWithBroadcast(
				"/bin/bash",
				[
					"-c",
					'sudo -v && NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
				],
				"install-homebrew",
			);
			if (!brewInstall.isOk) return { isOk: false };
		}

		// 2. Install Podman (only if not already installed)
		if (!podmanCheck.isValid) {
			const podmanInstall = await this.runCommandWithBroadcast(
				"brew",
				["install", "podman"],
				"install-podman",
			);
			if (!podmanInstall.isOk) return { isOk: false };
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman",
				type: "stdout",
				data: "Podman already installed, skipping installation",
			});
		}

		// 3. Install podman-compose (only if not already installed)
		if (!composeCheck.isValid) {
			const composeInstall = await this.installPodmanCompose();
			if (!composeInstall.isOk) return { isOk: false };
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman-compose",
				type: "stdout",
				data: "podman-compose already installed, skipping installation",
			});
		}

		// 4. Initialize Podman Machine (only if not already exists)
		const machineInit = await this._initPodmanMachine();
		if (!machineInit.isOk) return { isOk: false };

		// 5. Install podman-mac-helper for better performance
		const helperInstall = await this.runSudoCommandWithBroadcast(
			"/opt/homebrew/Cellar/podman/5.7.1/bin/podman-mac-helper",
			["install"],
			"install-podman-mac-helper",
		);

		if (helperInstall.wasCancelled) {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman-mac-helper",
				type: "stdout",
				data: await this.t(
					"用户跳过了 podman-mac-helper 安装",
					"User skipped podman-mac-helper installation",
				),
			});
			return { isOk: true };
		}

		if (!helperInstall.isOk) return { isOk: false };

		return machineInit;
	}

	/**
	 * Linux installation flow (Ubuntu/Debian):
	 * 1. Install Podman via apt-get (if not already installed)
	 * 2. Install podman-compose (if not already installed)
	 */
	private async _installPodmanLinux(): Promise<{ isOk: boolean }> {
		// Check if Podman is already installed
		const podmanCheck = await this.checkCommand("podman --version");
		const composeCheck = await this.checkPodmanCompose();

		if (podmanCheck.isValid && composeCheck.isValid) {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman",
				type: "stdout",
				data: "Podman and podman-compose already installed, skipping installation",
			});
			return { isOk: true };
		}

		// 1. Install Podman (only if not already installed)
		if (!podmanCheck.isValid) {
			const podmanInstall = await this.runCommandWithBroadcast(
				"sudo",
				["apt-get", "-y", "install", "podman"],
				"install-podman",
			);
			if (!podmanInstall.isOk) return { isOk: false };
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman",
				type: "stdout",
				data: "Podman already installed, skipping installation",
			});
		}

		// 2. Install podman-compose (only if not already installed)
		if (!composeCheck.isValid) {
			const composeInstall = await this.installPodmanCompose();
			if (!composeInstall.isOk) return { isOk: false };
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman-compose",
				type: "stdout",
				data: "podman-compose already installed, skipping installation",
			});
		}

		return { isOk: true };
	}

	/**
	 * Private method to stop the local sandbox Podman machine
	 * First runs podman compose stop to stop containers (without removing them)
	 * Then stops the Podman machine (macOS/Windows only - Linux runs rootless)
	 * Executes `podman machine stop ai302-machine`
	 * - Machine not existing or already stopped counts as success
	 * - Command not found or other errors count as failure
	 * On success, broadcasts non-healthy status via "podman-health" channel
	 */
	private async _stopLocalSandbox(): Promise<{ isOk: boolean; output?: string; error?: string }> {
		const platform = process.platform;

		try {
			// Stop local sandbox health check
			await this.stopLocalSandboxHealthCheck();

			// First, stop podman compose services (keeps containers for fast restart)
			const composeResult = await this.runPodmanComposeStop();
			if (composeResult.output) {
				console.log(
					"[Local Vibe] podman compose stop before stopping machine:",
					composeResult.output,
				);
			}
			if (composeResult.error) {
				console.error("[Local Vibe] podman compose stop error (non-fatal):", composeResult.error);
			}

			// On Linux, Podman runs rootless without a VM - skip machine stop
			if (platform === "linux") {
				console.log("[Local Vibe] Linux detected, skipping machine stop (rootless mode)");

				// Broadcast non-healthy status
				broadcastService.broadcastChannelToAll("podman-health", {
					isOk: true,
					isHealth: false,
					timestamp: Date.now(),
				});

				return { isOk: true, output: "Linux rootless mode - no machine to stop" };
			}

			// macOS/Windows: Stop the Podman machine
			const { stdout, stderr } = await execAsync("podman machine stop ai302-machine");

			// Broadcast non-healthy status after successful stop
			broadcastService.broadcastChannelToAll("podman-health", {
				isOk: true,
				isHealth: false,
				timestamp: Date.now(),
			});

			return { isOk: true, output: `${stdout}\n${stderr}` };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorMessageLower = errorMessage.toLowerCase();

			// Command not found - Podman is not installed
			if (isCommandNotFound(error)) {
				return { isOk: false, error: errorMessage };
			}

			// Machine does not exist - counts as success (nothing to stop)
			if (errorMessageLower.includes("does not exist")) {
				return { isOk: true, output: errorMessage };
			}

			// Machine already stopped - counts as success
			if (errorMessageLower.includes("is not running")) {
				return { isOk: true, output: errorMessage };
			}

			// Other errors - counts as failure
			return { isOk: false, error: errorMessage };
		}
	}

	/**
	 * IPC method to stop the local sandbox
	 * Called from renderer process
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; output?: string; error?: string } - isOk: operation success, output: command output, error: error message if failed
	 */
	async stopLocalSandboxByIpc(
		_event: IpcMainInvokeEvent,
	): Promise<{ isOk: boolean; output?: string; error?: string }> {
		return this._stopLocalSandbox();
	}

	/**
	 * Public method to stop the local sandbox
	 * Used by client (main process) before closing
	 * @returns { isOk: boolean; output?: string; error?: string } - isOk: operation success, output: command output, error: error message if failed
	 */
	async stopLocalSandbox(): Promise<{ isOk: boolean; output?: string; error?: string }> {
		return this._stopLocalSandbox();
	}

	/**
	 * Starts the ai302-machine Podman machine (macOS/Windows only)
	 * On Linux, Podman runs rootless without a VM, so machine start is skipped
	 * Executes `podman machine start ai302-machine`
	 * Checks output for success message or already started state
	 * After successful start, automatically runs podman compose up -d
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; alreadyStarted?: boolean; port?: number; output?: string; error?: string; composeOutput?: string; composeError?: string } - isOk: operation success, alreadyStarted: machine was already running, port: allocated host port, output: command output, error: error message if failed, composeOutput: podman compose output, composeError: podman compose error
	 */
	async startPodmanMachine(_event: IpcMainInvokeEvent): Promise<{
		isOk: boolean;
		alreadyStarted?: boolean;
		port?: number;
		output?: string;
		error?: string;
		composeOutput?: string;
		composeError?: string;
	}> {
		const platform = process.platform;

		// On Linux, Podman runs rootless without a VM - skip machine start
		if (platform === "linux") {
			console.log("[Local Vibe] Linux detected, skipping machine start (rootless mode)");

			// Execute podman compose up -d directly
			const composeResult = await this.runPodmanComposeUp();

			if (!composeResult.isOk) {
				return {
					isOk: false,
					error: composeResult.error,
				};
			}

			// Start local sandbox health check
			await new Promise((resolve) => setTimeout(resolve, 3000));
			await this.startLocalSandboxHealthCheck();

			return {
				isOk: true,
				alreadyStarted: false,
				port: composeResult.port,
				output: "Linux rootless mode - no machine needed",
				composeOutput: composeResult.output,
				composeError: composeResult.error,
			};
		}

		// macOS/Windows: Start the Podman machine first
		const startResult = await this.runCommandWithBroadcast(
			"podman",
			["machine", "start", "ai302-machine"],
			"podman-machine-start",
		);

		const output = startResult.output;
		let alreadyStarted = false;

		if (!startResult.isOk) {
			const errorMessage = startResult.output;

			// Check if already running
			// Based on actual Podman error: "Error: unable to start "ai302-machine": already running"
			if (errorMessage.includes("already running")) {
				alreadyStarted = true;
			} else if (isCommandNotFound(errorMessage)) {
				// Check if podman command is not found
				const notInstalledMsg = await this.t(
					"Podman 未安装。请先安装 Podman。",
					"Podman is not installed. Please install Podman first.",
				);
				return { isOk: false, error: notInstalledMsg };
			} else {
				// Other errors
				return { isOk: false, error: errorMessage };
			}
		}

		// Execute podman compose up -d after successful start (or if already running)
		const composeResult = await this.runPodmanComposeUp();

		// Start local sandbox health check
		await new Promise((resolve) => setTimeout(resolve, 3000));
		await this.startLocalSandboxHealthCheck();

		return {
			isOk: true,
			alreadyStarted,
			port: composeResult?.port,
			output,
			composeOutput: composeResult?.output,
			composeError: composeResult?.error,
		};
	}
}

export const envService = new EnvService();
