import { isCommandNotFound } from "@electron/main/utils/cmd";
import { exec } from "child_process";
import type { IpcMainInvokeEvent } from "electron";
import { match } from "ts-pattern";
import { promisify } from "util";

const execAsync = promisify(exec);

export class EnvService {
	/**
	 * Validates if podman is installed and accessible
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; isValid: boolean } - isOk: 操作是否成功完成, isValid: podman 是否已安装
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
	 * @returns { isOk: boolean; isValid: boolean; message?: string } - isOk: 操作是否成功完成, isValid: podman 前置条件是否满足, message: 错误信息
	 */
	async validPodmanPrecondition(
		_event: IpcMainInvokeEvent,
	): Promise<{ isOk: boolean; isValid: boolean; message?: string }> {
		return match(process.platform)
			.with("win32", () => this.checkWSL())
			.with("darwin", () => this.checkHomebrew())
			.with("linux", () => this.checkAptGet())
			.otherwise((platform) => ({
				isOk: true,
				isValid: false,
				message: `Unsupported platform: ${platform}`,
			}));
	}

	private async checkWSL(): Promise<{
		isOk: boolean;
		isValid: boolean;
		message?: string;
	}> {
		try {
			await execAsync("wsl --version");
			return { isOk: true, isValid: true };
		} catch (error) {
			if (isCommandNotFound(error)) {
				return {
					isOk: true,
					isValid: false,
					message: "WSL is not installed. Run: wsl --install",
				};
			}
			return {
				isOk: false,
				isValid: false,
				message: "WSL check failed",
			};
		}
	}

	private async checkHomebrew(): Promise<{
		isOk: boolean;
		isValid: boolean;
		message?: string;
	}> {
		try {
			await execAsync("brew --version");
			return { isOk: true, isValid: true };
		} catch (error) {
			if (isCommandNotFound(error)) {
				return {
					isOk: true,
					isValid: false,
					message: "Homebrew is not installed",
				};
			}
			return {
				isOk: false,
				isValid: false,
				message: "Homebrew check failed",
			};
		}
	}

	private async checkAptGet(): Promise<{
		isOk: boolean;
		isValid: boolean;
		message?: string;
	}> {
		try {
			await execAsync("apt-get --version");
			return { isOk: true, isValid: true };
		} catch (error) {
			if (isCommandNotFound(error)) {
				return {
					isOk: true,
					isValid: false,
					message: "apt-get not available",
				};
			}
			return {
				isOk: false,
				isValid: false,
				message: "apt-get check failed",
			};
		}
	}
}

export const envService = new EnvService();
