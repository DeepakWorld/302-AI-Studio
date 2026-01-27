import { isCommandNotFound } from "@electron/main/utils/cmd";
import { exec } from "child_process";
import type { IpcMainInvokeEvent } from "electron";
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
}

export const envService = new EnvService();
