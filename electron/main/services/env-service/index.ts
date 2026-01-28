import { getLocalSandboxHealthStatus } from "@electron/main/apis/code-agent";
import { broadcastService } from "@electron/main/services/broadcast-service";
import { isCommandNotFound } from "@electron/main/utils/cmd";
import { exec, spawn } from "child_process";
import type { IpcMainInvokeEvent } from "electron";
import { match } from "ts-pattern";
import { promisify } from "util";
import { CRON_EXPRESSION, schedulerService } from "../scheduler-service";

const execAsync = promisify(exec);

export class EnvService {
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
	): Promise<{ isOk: boolean }> {
		return new Promise((resolve) => {
			broadcastService.broadcastChannelToAll("install-log", {
				step,
				type: "start",
				data: `Starting: ${step}`,
			});

			const proc = spawn(command, args, { shell: true });

			proc.stdout.on("data", (data) => {
				broadcastService.broadcastChannelToAll("install-log", {
					step,
					type: "stdout",
					data: data.toString(),
				});
			});

			proc.stderr.on("data", (data) => {
				broadcastService.broadcastChannelToAll("install-log", {
					step,
					type: "stderr",
					data: data.toString(),
				});
			});

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
	 * Checks if podman is healthy (can run podman ps)
	 * @returns { isOk: boolean; isHealth: boolean; timestamp?: number } - isOk: operation success, isHealth: podman health check result, timestamp when called via startPodmanHealthCheck
	 */
	private async checkPodmanHealth(): Promise<{
		isOk: boolean;
		isHealth: boolean;
	}> {
		try {
			await execAsync("podman ps");
			return { isOk: true, isHealth: true };
		} catch (error) {
			return { isOk: !isCommandNotFound(error), isHealth: false };
		}
	}

	private async checkLocalSandboxHealth(): Promise<{
		isOk: boolean;
		isHealth: boolean;
	}> {
		try {
			await getLocalSandboxHealthStatus();
			return { isOk: true, isHealth: true };
		} catch (error) {
			return { isOk: !isCommandNotFound(error), isHealth: false };
		}
	}

	/**
	 * Validates if podman is installed and accessible
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; isValid: boolean } - isOk: operation success, isValid: podman installation check result
	 */
	async validPodman(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean; isValid: boolean }> {
		try {
			const { stdout } = await execAsync("podman --version");
			const isValid = stdout.toLowerCase().includes("podman version");
			return { isOk: true, isValid };
		} catch (error) {
			if (isCommandNotFound(error)) {
				return { isOk: true, isValid: false };
			}

			return { isOk: false, isValid: false };
		}
	}

	/**
	 * Starts the periodic Podman health check (every 30 seconds)
	 * Results are broadcast to all renderer processes via "podman-health" channel
	 */
	async startPodmanHealthCheck(): Promise<{ isOk: boolean }> {
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
				CRON_EXPRESSION.EVERY_30_SECONDS,
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
				CRON_EXPRESSION.EVERY_30_SECONDS,
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
		const policyResult = await this.runCommandWithBroadcast(
			"powershell.exe",
			["-Command", "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"],
			"scoop-policy",
		);

		if (!policyResult.isOk) {
			return { isOk: false };
		}

		const installResult = await this.runCommandWithBroadcast(
			"powershell.exe",
			["-Command", "Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression"],
			"scoop-install",
		);

		return installResult;
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
	 * Installs Podman with platform-specific logic
	 *
	 * Platform flows:
	 * - Windows: Check/install WSL → Check/install Scoop → Install Podman → Init machine with WSL provider
	 * - macOS: Check/install Homebrew → Install Podman → Init machine
	 * - Linux: Install Podman via apt-get
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
			await this.startPodmanHealthCheck();
		}

		return result;
	}

	/**
	 * Windows installation flow:
	 * 1. Check/install WSL
	 * 2. Check/install Scoop
	 * 3. Install Podman via Scoop
	 * 4. Initialize Podman machine with WSL provider
	 */
	private async _installPodmanWindows(): Promise<{ isOk: boolean }> {
		// 1. Check and install WSL
		const wslCheck = await this.checkWSL();
		if (!wslCheck.isValid) {
			const wslInstall = await this.runCommandWithBroadcast("wsl", ["--install"], "install-wsl");
			if (!wslInstall.isOk) return { isOk: false };
		}

		// 2. Check and install Scoop
		const scoopCheck = await this.checkScoop();
		if (!scoopCheck.isValid) {
			// Set execution policy
			const policyResult = await this.runCommandWithBroadcast(
				"powershell.exe",
				["-Command", "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"],
				"scoop-policy",
			);
			if (!policyResult.isOk) return { isOk: false };

			// Install Scoop
			const scoopInstall = await this.runCommandWithBroadcast(
				"powershell.exe",
				["-Command", "Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression"],
				"scoop-install",
			);
			if (!scoopInstall.isOk) return { isOk: false };
		}

		// 3. Install Podman
		const podmanInstall = await this.runCommandWithBroadcast(
			"scoop",
			["install", "podman"],
			"install-podman",
		);
		if (!podmanInstall.isOk) return { isOk: false };

		// 4. Initialize Podman Machine
		const machineInit = await this.runCommandWithBroadcast(
			"podman",
			["machine", "init", "--provider", "wsl"],
			"init-podman",
		);
		return machineInit;
	}

	/**
	 * macOS installation flow:
	 * 1. Check/install Homebrew
	 * 2. Install Podman via Homebrew
	 * 3. Initialize Podman machine
	 */
	private async _installPodmanMacOS(): Promise<{ isOk: boolean }> {
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

		// 2. Install Podman
		const podmanInstall = await this.runCommandWithBroadcast(
			"brew",
			["install", "podman"],
			"install-podman",
		);
		if (!podmanInstall.isOk) return { isOk: false };

		// 3. Initialize Podman Machine
		const machineInit = await this.runCommandWithBroadcast(
			"podman",
			["machine", "init"],
			"init-podman",
		);
		return machineInit;
	}

	/**
	 * Linux installation flow (Ubuntu/Debian):
	 * 1. Install Podman via apt-get
	 */
	private async _installPodmanLinux(): Promise<{ isOk: boolean }> {
		const podmanInstall = await this.runCommandWithBroadcast(
			"sudo",
			["apt-get", "-y", "install", "podman"],
			"install-podman",
		);
		return podmanInstall;
	}
}

export const envService = new EnvService();
