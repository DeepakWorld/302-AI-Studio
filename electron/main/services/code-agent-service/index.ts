import {
	createClaudeCodeSandbox,
	deleteClaudeCodeSandbox,
	listClaudeCodeSandboxes,
	listClaudeCodeSessions,
	updateClaudeCodeSandbox,
} from "@electron/main/apis/code-agent";
import type {
	CodeAgentCreateResult,
	CreateClaudeCodeSandboxRequest,
} from "@shared/storage/code-agent";
import type { ThreadParmas } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { emitter } from "../broadcast-service";
import { storageService } from "../storage-service";
import {
	claudeCodeSandboxStorage,
	claudeCodeStorage,
	codeAgentStorage,
} from "../storage-service/code-agent";

export class CodeAgentService {
	constructor() {
		this._updateClaudeCodeSandboxes();

		emitter.on("provider:302ai-provider-changed", ({ apiKey }) => {
			this._updateClaudeCodeSandboxes(apiKey);
		});
	}

	private calculateDiskUsage(diskTotal: number, diskUsed: number): "normal" | "insufficient" {
		if (diskTotal === -1 || diskUsed === -1) return "normal";
		const availablePercentage = ((diskTotal - diskUsed) / diskTotal) * 100;
		return availablePercentage > 10 ? "normal" : "insufficient";
	}

	private async cleanupThreadsForSandbox(sandboxId: string): Promise<void> {
		try {
			const keys = await claudeCodeStorage.getKeysInternal();
			for (const key of keys) {
				if (key.startsWith("claude-code-agent-state-")) {
					const threadId = key.replace("claude-code-agent-state-", "").replace(".json", "");
					const state = await claudeCodeStorage.getItemInternal(key);
					if (state && state.sandboxId === sandboxId) {
						const configKey = `code-agent-config-state-${threadId}`;
						const config = await codeAgentStorage.getItemInternal(configKey);
						if (config) {
							config.isDeleted = true;
							await codeAgentStorage.setItemInternal(configKey, config);
						}
					}
				}
			}
		} catch (error) {
			console.error("Error cleaning up threads for sandbox:", error);
		}
	}

	private async cleanupThreadsForSession(sandboxId: string, sessionId: string): Promise<void> {
		try {
			const keys = await claudeCodeStorage.getKeysInternal();
			for (const key of keys) {
				if (key.startsWith("claude-code-agent-state-")) {
					const threadId = key.replace("claude-code-agent-state-", "").replace(".json", "");
					const state = await claudeCodeStorage.getItemInternal(key);
					if (state && state.sandboxId === sandboxId && state.currentSessionId === sessionId) {
						const configKey = `code-agent-config-state-${threadId}`;
						const config = await codeAgentStorage.getItemInternal(configKey);
						if (config) {
							config.isDeleted = true;
							await codeAgentStorage.setItemInternal(configKey, config);
						}
					}
				}
			}
		} catch (error) {
			console.error("Error cleaning up threads for session:", error);
		}
	}

	private async _updateClaudeCodeSandboxes(apiKey?: string): Promise<void> {
		try {
			const response = await listClaudeCodeSandboxes(apiKey);
			if (response.success) {
				const validList = response.list.filter((sandbox) => sandbox.status !== "killed");

				const list = validList.map((sandbox) => {
					const diskUsage = this.calculateDiskUsage(sandbox.disk_total, sandbox.disk_used);

					return {
						sandboxId: sandbox.sandbox_id,
						sandboxRemark: sandbox.sandbox_name,
						diskTotal: sandbox.disk_total,
						diskUsed: sandbox.disk_used,
						diskUsage: diskUsage as "normal" | "insufficient",
						status: sandbox.status,
						llmModel: sandbox.llm_model,
						createdAt: sandbox.created_at,
						updatedAt: sandbox.updated_at,
						deletedAt: sandbox.deleted_at,
						sessionInfos: sandbox.session_list.map((session) => ({
							sessionId: session.session_id,
							workspacePath: session.workspace_path,
							note: session.note,
							usedAt: session.used_at,
							updatedAt: session.updated_at,
						})),
					};
				});

				await claudeCodeSandboxStorage.setClaudeCodeSandboxes(list);

				console.log("[CodeAgentService] Updated Claude code sandboxes, count: ", list.length);
			}
		} catch (error) {
			console.error("Error listing Claude code sandboxes:", error);
			await claudeCodeSandboxStorage.setClaudeCodeSandboxes([]);
		}
	}

	private async _createClaudeCodeSandbox(
		threadId: string,
		sandboxCfg: CreateClaudeCodeSandboxRequest,
	): Promise<{ createdResult: CodeAgentCreateResult; sandboxId: string }> {
		const { isOK, sandboxId } = await claudeCodeStorage.getClaudeCodeSandboxId(threadId);
		if (isOK && sandboxId !== "") {
			return { createdResult: "already-exist", sandboxId };
		}

		const response = await createClaudeCodeSandbox(sandboxCfg);
		if (response.success) {
			const { sandbox_id: sandboxId, sandbox_name: sandboxRemark } = response.data;

			await claudeCodeStorage.setClaudeCodeSandboxInfo(threadId, sandboxId, sandboxRemark);

			return { createdResult: "success", sandboxId };
		}
		return { createdResult: "failed", sandboxId: "" };
	}

	async updateClaudeCodeSandboxes(): Promise<void> {
		await this._updateClaudeCodeSandboxes();
	}

	async removeCodeAgentState(threadId: string): Promise<void> {
		await codeAgentStorage.removeCodeAgentState(threadId);
	}

	async createClaudeCodeSandbox(
		threadId: string,
		sandboxCfg: CreateClaudeCodeSandboxRequest,
	): Promise<{ createdResult: CodeAgentCreateResult; sandboxId: string }> {
		return this._createClaudeCodeSandbox(threadId, sandboxCfg);
	}

	// ******************************* IPC Methods ******************************* //
	async updateClaudeCodeSandboxModel(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sandbox_id: string,
		llm_model: string,
	): Promise<{ isOK: boolean; llm_model: string }> {
		try {
			const response = await updateClaudeCodeSandbox(sandbox_id, llm_model);
			if (response.success) {
				await claudeCodeStorage.setClaudeCodeModel(threadId, llm_model);
				return { isOK: true, llm_model };
			}
			return { isOK: false, llm_model: "" };
		} catch (error) {
			console.error("Error updating Claude code sandbox:", error);
			return { isOK: false, llm_model: "" };
		}
	}

	async checkClaudeCodeSandbox(
		_event: IpcMainInvokeEvent,
		sandboxId: string,
	): Promise<{
		isOK: boolean;
		valid: boolean;
		sandboxInfo?: {
			sandboxId: string;
			sandboxRemark: string;
			llmModel: string;
			diskUsage: "normal" | "insufficient";
		};
	}> {
		try {
			const { isOK, sandboxes } = await claudeCodeSandboxStorage.getClaudeCodeSandboxes();
			if (!isOK) {
				return { isOK: false, valid: false };
			}
			const sandbox = sandboxes.find((sandbox) => sandbox.sandboxId === sandboxId);
			if (!sandbox) {
				return { isOK: true, valid: false };
			}
			return {
				isOK: true,
				valid: true,
				sandboxInfo: {
					sandboxId,
					sandboxRemark: sandbox.sandboxRemark,
					llmModel: sandbox.llmModel,
					diskUsage: sandbox.diskUsage,
				},
			};
		} catch (error) {
			console.error("Error checking Claude code sandbox:", error);
			return { isOK: false, valid: false };
		}
	}

	async updateClaudeCodeSandboxesByIpc(_event: IpcMainInvokeEvent): Promise<{ isOK: boolean }> {
		try {
			await this.updateClaudeCodeSandboxes();
			return { isOK: true };
		} catch (error) {
			console.error("Error updating Claude code sandboxes:", error);
			return { isOK: false };
		}
	}

	async updateClaudeCodeSessions(
		_event: IpcMainInvokeEvent,
		sandboxId: string,
	): Promise<{ isOK: boolean }> {
		try {
			const { success, session_list } = await listClaudeCodeSessions(sandboxId);
			if (!success) {
				return { isOK: false };
			}
			const list = session_list.map((session) => ({
				sessionId: session.session_id,
				workspacePath: session.workspace_path,
				note: session.note ?? "",
				usedAt: session.used_at ?? "",
			}));
			await claudeCodeSandboxStorage.setClaudeCodeSessions(sandboxId, list);
			return { isOK: true };
		} catch (error) {
			console.error("Error updating Claude code sessions:", error);
			return { isOK: false };
		}
	}

	async updateClaudeCodeCurrentSessionIdByThreadId(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sessionId: string,
	): Promise<{ isOK: boolean }> {
		try {
			await claudeCodeStorage.updateClaudeCodeCurrentSessionIdByThreadId(threadId, sessionId);
			return { isOK: true };
		} catch (error) {
			console.error("Error updating Claude code sessions:", error);
			return { isOK: false };
		}
	}

	async updateClaudeCodeSandboxRemark(
		_event: IpcMainInvokeEvent,
		sandbox_id: string,
		remark: string,
	): Promise<{ isOK: boolean; remark: string }> {
		try {
			const response = await updateClaudeCodeSandbox(sandbox_id, undefined, remark);
			if (response.success) {
				return { isOK: true, remark };
			}
			return { isOK: false, remark: "" };
		} catch (error) {
			console.error("Error updating Claude code sandbox:", error);
			return { isOK: false, remark: "" };
		}
	}

	async createClaudeCodeSandboxByIpc(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sandboxName: string,
	): Promise<{ isOK: boolean; sandboxId: string }> {
		try {
			const targetThread = await storageService.getItemInternal("app-thread:" + threadId);
			if (!targetThread) {
				return { isOK: false, sandboxId: "" };
			}
			const llmModel =
				(targetThread as ThreadParmas).selectedModel?.id ?? "claude-sonnet-4-5-20250929";
			const cfg: CreateClaudeCodeSandboxRequest = {
				llm_model: llmModel,
				sandbox_name: sandboxName,
			};

			const { createdResult, sandboxId } = await this._createClaudeCodeSandbox(threadId, cfg);
			const isOK = createdResult === "success";
			if (isOK) {
				await claudeCodeSandboxStorage.addSandbox(sandboxId, sandboxName, llmModel);
			}
			return { isOK, sandboxId };
		} catch (error) {
			console.error("Error creating Claude code sandbox:", error);
			return { isOK: false, sandboxId: "" };
		}
	}

	async deleteClaudeCodeSandboxByIpc(
		_event: IpcMainInvokeEvent,
		sandbox_id: string,
	): Promise<{ isOK: boolean; error?: string }> {
		try {
			const response = await deleteClaudeCodeSandbox(sandbox_id);
			if (response.success) {
				await this.updateClaudeCodeSandboxes();
				await this.cleanupThreadsForSandbox(sandbox_id);
				return { isOK: true };
			}
			return { isOK: false };
		} catch (error) {
			return { isOK: false, error: error instanceof Error ? error.message : "Unknown error" };
		}
	}

	async deleteClaudeCodeSession(
		_event: IpcMainInvokeEvent,
		sandbox_id: string,
		session_id: string,
	): Promise<{ isOK: boolean }> {
		try {
			await this.cleanupThreadsForSession(sandbox_id, session_id);
			return { isOK: true };
		} catch (error) {
			console.error("Error deleting Claude code session:", error);
			return { isOK: false };
		}
	}

	async findClaudeCodeSandboxWithValidDisk(
		_event: IpcMainInvokeEvent,
		threadId: string,
	): Promise<{
		isOK: boolean;
		sandboxInfo?: {
			sandboxId: string;
			sandboxRemark: string;
			llmModel: string;
			diskUsage: "normal" | "insufficient";
		};
	}> {
		const { isOK, sandboxes } = await claudeCodeSandboxStorage.getClaudeCodeSandboxes();
		if (!isOK) return { isOK: false };

		const normalSandboxes = sandboxes.filter((sandbox) => sandbox.diskUsage === "normal");
		if (normalSandboxes.length > 0) {
			const randomSandbox = normalSandboxes[Math.floor(Math.random() * normalSandboxes.length)];
			return {
				isOK: true,
				sandboxInfo: {
					sandboxId: randomSandbox.sandboxId,
					sandboxRemark: randomSandbox.sandboxRemark,
					llmModel: randomSandbox.llmModel,
					diskUsage: "normal",
				},
			};
		}

		const targetThread = await storageService.getItemInternal("app-thread:" + threadId);
		if (!targetThread) {
			return { isOK: false };
		}
		const llmModel =
			(targetThread as ThreadParmas).selectedModel?.id ?? "claude-sonnet-4-5-20250929";
		const { createdResult, sandboxId } = await this._createClaudeCodeSandbox(threadId, {
			llm_model: llmModel,
		});

		if (createdResult === "success" && sandboxId) {
			await claudeCodeSandboxStorage.addSandbox(sandboxId, "", llmModel);

			return {
				isOK: true,
				sandboxInfo: {
					sandboxId,
					sandboxRemark: "",
					llmModel,
					diskUsage: "normal",
				},
			};
		}

		return { isOK: false };
	}
}

export const codeAgentService = new CodeAgentService();
