/**
 * Local Environment State Store
 *
 * Manages Podman installation status, health status, and installation logs
 * for the Code Agent local mode.
 */

export type PodmanHealthStatus = "unknown" | "healthy" | "unhealthy";

export interface InstallLogEntry {
	step: string;
	type: "start" | "stdout" | "stderr" | "complete" | "error";
	data: string;
	ts: number;
}

export interface PodmanHealthCheckData {
	isOk: boolean;
	isHealth: boolean;
	timestamp: number;
}

class LocalEnvState {
	// Podman installation status
	podmanInstalled = $state(false);

	// Podman health status
	podmanHealth = $state<PodmanHealthStatus>("unknown");

	// Loading states
	checking = $state(false);
	installing = $state(false);
	sandboxStarting = $state(false);

	// Installation result
	installFailed = $state(false);

	// Sandbox running status (independent of podman health)
	sandboxRunning = $state(false);

	// Installation logs
	installLogs = $state<InstallLogEntry[]>([]);

	// Unsubscribe functions for broadcast listeners
	private unsubscribeInstallLog: (() => void) | null = null;
	private unsubscribeHealthCheck: (() => void) | null = null;

	/**
	 * Refresh Podman installation status by calling envService.validPodman()
	 */
	async refreshPodmanStatus(): Promise<void> {
		this.checking = true;
		try {
			const result = await window.electronAPI.envService.validPodman();
			this.podmanInstalled = result.isOk && result.isValid;

			// Print command output
			if (result.output) {
				console.log("[Local Vibe] validPodman:", result.output);
			}
			if (result.error) {
				console.error("[Local Vibe] validPodman error:", result.error);
			}
		} catch (error) {
			console.error("[LocalEnvState] Failed to check Podman status:", error);
			this.podmanInstalled = false;
		} finally {
			this.checking = false;
		}
	}

	/**
	 * Start Podman health check scheduler (only when Podman is installed)
	 */
	async ensurePodmanHealthCheckStarted(): Promise<void> {
		if (!this.podmanInstalled) {
			return;
		}

		try {
			await window.electronAPI.envService.startPodmanHealthCheck();
		} catch (error) {
			console.error("[LocalEnvState] Failed to start Podman health check:", error);
		}
	}

	/**
	 * Install Podman - clears logs first, then calls envService.installPodman()
	 */
	async installPodman(): Promise<void> {
		// Clear previous logs before starting new installation
		this.installLogs = [];
		this.installing = true;
		this.installFailed = false;

		try {
			const result = await window.electronAPI.envService.installPodman();
			this.installFailed = !result.isOk;

			// Refresh status after installation
			await this.refreshPodmanStatus();

			// Start health check if installation succeeded
			if (result.isOk) {
				await this.ensurePodmanHealthCheckStarted();
			}
		} catch (error) {
			console.error("[LocalEnvState] Failed to install Podman:", error);
			this.installFailed = true;
		} finally {
			this.installing = false;
		}
	}

	/**
	 * Start Podman machine (sandbox)
	 * Calls envService.startPodmanMachine() and prints output with [Local Vibe] prefix
	 */
	async startSandbox(): Promise<boolean> {
		if (!this.podmanInstalled) {
			console.error("[LocalEnvState] Cannot start sandbox: Podman not installed");
			return false;
		}

		this.sandboxStarting = true;
		try {
			const result = await window.electronAPI.envService.startPodmanMachine();

			// Print Podman machine output
			if (result.output) {
				console.log("[Local Vibe] startPodmanMachine:", result.output);
			}
			if (result.error) {
				console.error("[Local Vibe] startPodmanMachine error:", result.error);
			}

			// Print docker-compose output
			if (result.composeOutput) {
				console.log("[Local Vibe] docker-compose up:", result.composeOutput);
			}
			if (result.composeError) {
				console.error("[Local Vibe] docker-compose error:", result.composeError);
			}

			// Toggle sandbox running state on success
			if (result.isOk) {
				this.sandboxRunning = true;
			}

			return result.isOk;
		} catch (error) {
			console.error("[LocalEnvState] Failed to start sandbox:", error);
			return false;
		} finally {
			this.sandboxStarting = false;
		}
	}

	/**
	 * Stop Podman machine (sandbox)
	 * Calls envService.stopLocalSandboxByIpc() and prints output with [Local Vibe] prefix
	 */
	async stopSandbox(): Promise<boolean> {
		this.sandboxStarting = true;
		try {
			const result = await window.electronAPI.envService.stopLocalSandboxByIpc();

			// Print command output with [Local Vibe] prefix
			if (result.output) {
				console.log("[Local Vibe] stopLocalSandboxByIpc:", result.output);
			}
			if (result.error) {
				console.error("[Local Vibe] stopLocalSandboxByIpc error:", result.error);
			}

			// Toggle sandbox running state on success
			if (result.isOk) {
				this.sandboxRunning = false;
			}

			return result.isOk;
		} catch (error) {
			console.error("[LocalEnvState] Failed to stop sandbox:", error);
			return false;
		} finally {
			this.sandboxStarting = false;
		}
	}

	/**
	 * Start listening to broadcast channels for install logs and health checks
	 */
	startListening(): void {
		// Subscribe to install-log channel
		this.unsubscribeInstallLog = window.electronAPI.onInstallLog(
			(data: Omit<InstallLogEntry, "ts">) => {
				this.installLogs = [
					...this.installLogs,
					{
						...data,
						ts: Date.now(),
					},
				];
			},
		);

		// Subscribe to podman-health-check channel
		this.unsubscribeHealthCheck = window.electronAPI.onPodmanHealthCheck(
			(data: PodmanHealthCheckData) => {
				if (data.isOk) {
					this.podmanHealth = data.isHealth ? "healthy" : "unhealthy";
				} else {
					this.podmanHealth = "unknown";
				}

				console.log("[LocalEnvState] Podman health check:", this.podmanHealth);
			},
		);
	}

	/**
	 * Stop listening to broadcast channels
	 */
	stopListening(): void {
		if (this.unsubscribeInstallLog) {
			this.unsubscribeInstallLog();
			this.unsubscribeInstallLog = null;
		}

		if (this.unsubscribeHealthCheck) {
			this.unsubscribeHealthCheck();
			this.unsubscribeHealthCheck = null;
		}
	}

	/**
	 * Clear installation logs
	 */
	clearLogs(): void {
		this.installLogs = [];
	}

	/**
	 * Reset state (useful when switching away from local mode)
	 */
	reset(): void {
		this.podmanHealth = "unknown";
		this.installFailed = false;
	}
}

export const localEnvState = new LocalEnvState();
