import { batchUploadFile, initProject } from "$lib/api/taskboard/base-apis";
import { m } from "$lib/paraglide/messages";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";
import { chatState } from "../chat-state.svelte";
import { mcpState } from "../mcp-state.svelte";
import { codeAgentState } from "./code-agent-state.svelte";
import { codeAgentTaskboardState } from "./code-agent-taskboard-state.svelte";
import { fileToBase64 } from "./utils";

const { addClaudeCodeSandboxMCP } = window.electronAPI.codeAgentService;

class CodeAgentSendMessageButtonState {
	executionIterator: AsyncGenerator<string, void, boolean> | null = null;

	showLackOfDiskDialog = $state(false);
	isChecking = $state(false);

	async #attachmentToBase64(attachment: { file?: unknown; preview?: unknown; filePath?: unknown }) {
		if (attachment.file instanceof Blob) {
			return await fileToBase64(attachment.file as File);
		}

		if (typeof attachment.preview === "string" && attachment.preview.startsWith("data:")) {
			return attachment.preview;
		}

		if (typeof attachment.filePath === "string") {
			const buffer = await window.electronAPI.appService.readFileAsBuffer(attachment.filePath);
			let binary = "";
			const bytes = new Uint8Array(buffer);
			for (let i = 0; i < bytes.byteLength; i++) {
				binary += String.fromCharCode(bytes[i]);
			}
			return `data:application/octet-stream;base64,${window.btoa(binary)}`;
		}

		return "";
	}

	async *enableCodeAgentFlow(fn: () => void) {
		this.isChecking = true;

		try {
			if (chatState.selectedModel && codeAgentState.currentModel !== chatState.selectedModel.id) {
				codeAgentState.updateSandboxModel(chatState.selectedModel.id);
			}

			const { isOK, sandboxInfo } = await codeAgentState.executeCodeAgentMode();
			if (!isOK) {
				this.isChecking = false;
				return;
			}

			if (sandboxInfo) {
				let workspacePath: string | undefined;

				if (codeAgentTaskboardState.isInitialized) {
					const isSessionIdEmpty = codeAgentState.sessionId === "";
					const sessionId: string = isSessionIdEmpty ? nanoid() : codeAgentState.sessionId;

					const { workspace_path } = await initProject({
						sandboxId: sandboxInfo.sandboxId,
						sessionId,
					});

					workspacePath = workspace_path;

					// Refresh sessions to sync the new workspace_path to local storage
					await window.electronAPI.codeAgentService.updateClaudeCodeSessions(sandboxInfo.sandboxId);

					// Collect all files to upload in a single batch request
					const filesToUpload: Array<{ content: string; save_path: string }> = [];

					// 1. tasks.json
					const tasksFilePath = `${workspacePath}/.302ai/todo/tasks.json`;
					const jsonContent = JSON.stringify(codeAgentTaskboardState.tasklist);
					const base64Content =
						"data:application/json;base64," +
						window.btoa(
							encodeURIComponent(jsonContent).replace(/%([0-9A-F]{2})/g, (_, p1) =>
								String.fromCharCode(parseInt(p1, 16)),
							),
						);
					filesToUpload.push({ content: base64Content, save_path: tasksFilePath });

					if (codeAgentTaskboardState.pendingAttachments.length > 0) {
						console.log("pending attachments", codeAgentTaskboardState.pendingAttachments);
						const pendingAttachments = await Promise.all(
							codeAgentTaskboardState.pendingAttachments.map(async (att) => ({
								content: att.file ? await fileToBase64(att.file) : "",
								save_path: `${workspacePath}/.302ai/attachments/${att.name}`,
							})),
						);
						filesToUpload.push(...pendingAttachments);
						codeAgentTaskboardState.clearPendingAttachments();
					}

					if (chatState.attachments.length > 0) {
						const chatAttachments = await Promise.all(
							chatState.attachments.map(async (att) => ({
								content: await this.#attachmentToBase64(att),
								save_path: `${workspacePath}/${att.name}`,
							})),
						);
						filesToUpload.push(...chatAttachments);
					}

					// Upload all files in a single batch request
					if (filesToUpload.length > 0) {
						const response = await batchUploadFile({
							sandbox_id: sandboxInfo.sandboxId,
							file_list: filesToUpload,
						});

						const faileds = response.result.filter((r) => !r.success);
						if (!response.success || faileds.length > 0) {
							console.error("Failed to upload files:", faileds.map((r) => r.error).join(", "));
							toast.error(m.taskboard_error_attachment_upload_failed());
							this.isChecking = false;
							return;
						}
					}

					if (isSessionIdEmpty) {
						codeAgentState.updateCurrentSessionId(sessionId);
					}
				}

				if (chatState.selectedModel && chatState.selectedModel.id !== sandboxInfo.llmModel) {
					await codeAgentState.handleCodeAgentModelChange(chatState.selectedModel);
				}

				// 在 sandbox 确定后，添加用户选择的 MCP 服务器
				if (chatState.mcpServerIds.length > 0) {
					const infos = mcpState.getMCPInfosByIds(chatState.mcpServerIds);
					if (infos.length > 0) {
						try {
							await addClaudeCodeSandboxMCP(sandboxInfo.sandboxId, infos);
						} catch (error) {
							console.error("Failed to add MCP servers:", error);
						}
					}
				}

				if (sandboxInfo.diskUsage === "insufficient") {
					this.showLackOfDiskDialog = true;
					const shouldContinue: boolean = yield "wait_user_choice";
					if (!shouldContinue) {
						codeAgentState.isCodeAgentPanelOpen = true;
						this.isChecking = false;
						return;
					}
				}
			}

			fn();
		} catch (error) {
			console.error("Failed to enable code agent flow:", error);
		} finally {
			this.isChecking = false;
		}
	}

	async handleContinueAnyway() {
		this.showLackOfDiskDialog = false;
		if (this.executionIterator) {
			await this.executionIterator.next(true);
			this.executionIterator = null;
		}
	}

	async handleChangeSandbox() {
		this.showLackOfDiskDialog = false;
		if (this.executionIterator) {
			await this.executionIterator.next(false);
			this.executionIterator = null;
		}
	}

	async handleCodeAgentFlow(fn: () => void) {
		this.executionIterator = this.enableCodeAgentFlow(fn);
		await this.executionIterator.next();
	}
}

export const codeAgentSendMessageButtonState = new CodeAgentSendMessageButtonState();
