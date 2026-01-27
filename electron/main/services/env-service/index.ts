import { isCommandNotFound } from "@electron/main/utils/cmd";
import { exec } from "child_process";
import type { IpcMainInvokeEvent } from "electron";
import { match } from "ts-pattern";
import { promisify } from "util";

const execAsync = promisify(exec);

export class EnvService {
	protected async checkCommand(command: string): Promise<{
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
	 * Validates podman preconditions based on the operating system
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; isValid: boolean } - isOk: operation success, isValid: precondition check result
	 */
	async validPodmanPrecondition(
		_event: IpcMainInvokeEvent,
	): Promise<{ isOk: boolean; isValid: boolean }> {
		return match(process.platform)
			.with("win32", () => this.checkWSL())
			.with("darwin", () => ({ isOk: true, isValid: true }))
			.with("linux", () => ({ isOk: true, isValid: true }))
			.otherwise(() => ({
				isOk: true,
				isValid: false,
			}));
	}

	/**
	 * Checks if podman is healthy (can run podman ps)
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; isHealth: boolean } - isOk: operation success, isHealth: podman health check result
	 */
	async checkPodmanHealth(
		_event: IpcMainInvokeEvent,
	): Promise<{ isOk: boolean; isHealth: boolean }> {
		try {
			await execAsync("podman ps");
			return { isOk: true, isHealth: true };
		} catch (error) {
			return { isOk: !isCommandNotFound(error), isHealth: false };
		}
	}
}

export const envService = new EnvService();
