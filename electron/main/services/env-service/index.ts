import { getLocalSandboxHealthStatus } from "@electron/main/apis/code-agent";
import { broadcastService } from "@electron/main/services/broadcast-service";
import { generalSettingsService } from "@electron/main/services/settings-service/general-settings-service";
import { providerStorage } from "@electron/main/services/storage-service/provider-storage";
import { isCommandNotFound } from "@electron/main/utils/cmd";
import { exec, spawn } from "child_process";
import { app, type IpcMainInvokeEvent } from "electron";
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
	 * Execute docker-compose up -d
	 * Runs docker-compose in detached mode to start services
	 * Sets DOCKER_HOST to use Podman socket
	 * Prepares runtime compose with .env file before starting
	 * @returns { isOk: boolean; port?: number; output?: string; error?: string }
	 */
	private async runDockerComposeUp(): Promise<{
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
			const composeDir = path.dirname(composePath);

			// Execute: docker-compose -f <path> up -d
			// Set DOCKER_HOST to use Podman socket
			const { stdout, stderr } = await execAsync(
				`DOCKER_HOST='unix:///var/run/docker.sock' docker-compose -f "${composePath}" up -d`,
				{ cwd: composeDir },
			);
			const output = `${stdout}\n${stderr}`;

			console.log("[Local Vibe] docker-compose up -d:", output);
			return { isOk: true, port: hostPort, output };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[Local Vibe] docker-compose up -d error:", errorMessage);
			return { isOk: false, error: errorMessage };
		}
	}

	/**
	 * Execute docker-compose stop
	 * Stops containers without removing them, allowing fast restart with docker-compose up
	 * Sets DOCKER_HOST to use Podman socket
	 * Uses runtime compose if exists, falls back to template compose
	 * @returns { isOk: boolean; output?: string; error?: string }
	 */
	private async runDockerComposeStop(): Promise<{
		isOk: boolean;
		output?: string;
		error?: string;
	}> {
		try {
			// Use runtime compose if exists, otherwise fall back to template
			const runtimePath = this.getRuntimeComposePath();
			const composePath = fs.existsSync(runtimePath) ? runtimePath : this.getDockerComposePath();
			const composeDir = path.dirname(composePath);

			// Execute: docker-compose -f <path> stop
			// Set DOCKER_HOST to use Podman socket
			const { stdout, stderr } = await execAsync(
				`DOCKER_HOST='unix:///var/run/docker.sock' docker-compose -f "${composePath}" stop`,
				{ cwd: composeDir },
			);
			const output = `${stdout}\n${stderr}`;

			console.log("[Local Vibe] docker-compose stop:", output);
			return { isOk: true, output };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[Local Vibe] docker-compose stop error:", errorMessage);
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
	): Promise<{ isOk: boolean }> {
		return new Promise((resolve) => {
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
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; isValid: boolean; output?: string; error?: string } - isOk: operation success, isValid: podman installed AND machine exists, output: command output, error: error message if failed
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
	 * - Windows: Check/install WSL → Check/install Scoop → Install Podman (if needed) → Init machine with WSL provider
	 * - macOS: Check/install Homebrew → Install Podman (if needed) → Init machine
	 * - Linux: Install Podman via apt-get (if needed)
	 *
	 * If Podman is already installed but ai302-machine doesn't exist, only machine init will be performed.
	 *
	 * Broadcasts log events via "install-log" channel with step identifiers:
	 * - install-wsl, scoop-policy, scoop-install, install-homebrew, install-podman, init-podman
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
	 * 4. Initialize Podman Machine with WSL provider (if not already exists)
	 */
	private async _installPodmanWindows(): Promise<{ isOk: boolean }> {
		// Check if Podman is already installed and machine exists
		const podmanCheck = await this.checkCommand("podman --version");
		const machineCheck = await this.checkPodmanMachineExists();

		if (podmanCheck.isValid && machineCheck.exists) {
			// Both podman and machine exist, nothing to do
			broadcastService.broadcastChannelToAll("install-log", {
				step: "init-podman",
				type: "stdout",
				data: "Podman and ai302-machine already exist, skipping installation",
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

		// 4. Initialize Podman Machine (only if not already exists)
		return this._initPodmanMachine();
	}

	/**
	 * macOS installation flow:
	 * 1. Check/install Homebrew
	 * 2. Install Podman via Homebrew (if not already installed)
	 * 3. Initialize Podman machine (if not already exists)
	 */
	private async _installPodmanMacOS(): Promise<{ isOk: boolean }> {
		// Check if Podman is already installed and machine exists
		const podmanCheck = await this.checkCommand("podman --version");
		const machineCheck = await this.checkPodmanMachineExists();

		if (podmanCheck.isValid && machineCheck.exists) {
			// Both podman and machine exist, nothing to do
			broadcastService.broadcastChannelToAll("install-log", {
				step: "init-podman",
				type: "stdout",
				data: "Podman and ai302-machine already exist, skipping installation",
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

		// 3. Initialize Podman Machine (only if not already exists)
		const machineInit = await this._initPodmanMachine();
		if (!machineInit.isOk) return { isOk: false };

		// 4. Install podman-mac-helper for better performance
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
	 */
	private async _installPodmanLinux(): Promise<{ isOk: boolean }> {
		// Check if Podman is already installed
		const podmanCheck = await this.checkCommand("podman --version");

		if (podmanCheck.isValid) {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman",
				type: "stdout",
				data: "Podman already installed, skipping installation",
			});
			return { isOk: true };
		}

		const podmanInstall = await this.runCommandWithBroadcast(
			"sudo",
			["apt-get", "-y", "install", "podman"],
			"install-podman",
		);
		return podmanInstall;
	}

	/**
	 * Private method to stop the local sandbox Podman machine
	 * First runs docker-compose stop to stop containers (without removing them), then stops the Podman machine
	 * Executes `podman machine stop ai302-machine`
	 * - Machine not existing or already stopped counts as success
	 * - Command not found or other errors count as failure
	 * On success, broadcasts non-healthy status via "podman-health" channel
	 */
	private async _stopLocalSandbox(): Promise<{ isOk: boolean; output?: string; error?: string }> {
		try {
			// Stop local sandbox health check
			await this.stopLocalSandboxHealthCheck();

			// First, stop docker-compose services (keeps containers for fast restart)
			const composeResult = await this.runDockerComposeStop();
			if (composeResult.output) {
				console.log(
					"[Local Vibe] docker-compose stop before stopping machine:",
					composeResult.output,
				);
			}
			if (composeResult.error) {
				console.error("[Local Vibe] docker-compose stop error (non-fatal):", composeResult.error);
			}

			// Then stop the Podman machine
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
	 * Starts the ai302-machine Podman machine
	 * Executes `export DOCKER_HOST='unix:///var/run/docker.sock' && podman machine start ai302-machine`
	 * Checks output for success message or already started state
	 * After successful start, automatically runs docker-compose up -d
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; alreadyStarted?: boolean; port?: number; output?: string; error?: string; composeOutput?: string; composeError?: string } - isOk: operation success, alreadyStarted: machine was already running, port: allocated host port, output: command output, error: error message if failed, composeOutput: docker-compose output, composeError: docker-compose error
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
		try {
			// Set DOCKER_HOST environment variable before starting the machine
			// Both commands must run in the same shell session to preserve the environment variable
			const { stdout, stderr } = await execAsync(
				"export DOCKER_HOST='unix:///var/run/docker.sock' && podman machine start ai302-machine",
			);
			const output = `${stdout}\n${stderr}`;

			// Execute docker-compose up -d after successful start
			const composeResult = await this.runDockerComposeUp();

			// Start local sandbox health check
			await new Promise((resolve) => setTimeout(resolve, 3000));
			await this.startLocalSandboxHealthCheck();

			return {
				isOk: true,
				alreadyStarted: false,
				port: composeResult?.port,
				output,
				composeOutput: composeResult?.output,
				composeError: composeResult?.error,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			// Machine already running is considered success
			// Based on actual Podman error: "Error: unable to start "ai302-machine": already running"
			if (errorMessage.includes("already running")) {
				// Execute docker-compose even if machine was already running
				const composeResult = await this.runDockerComposeUp();

				// Start local sandbox health check
				await new Promise((resolve) => setTimeout(resolve, 3000));
				await this.startLocalSandboxHealthCheck();

				return {
					isOk: true,
					alreadyStarted: true,
					port: composeResult?.port,
					output: errorMessage,
					composeOutput: composeResult?.output,
					composeError: composeResult?.error,
				};
			}

			return { isOk: false, error: errorMessage };
		}
	}
}

export const envService = new EnvService();
