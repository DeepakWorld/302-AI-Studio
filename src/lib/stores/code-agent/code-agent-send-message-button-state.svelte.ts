import { updateTasklist, uploadAttachments, type Attachment } from "$lib/api/taskboard";
import { initProject } from "$lib/api/taskboard/base-apis";
import { nanoid } from "nanoid";
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

	async *enableCodeAgentFlow(fn: () => void) {
		this.isChecking = true;

		if (chatState.selectedModel && codeAgentState.currentModel !== chatState.selectedModel.id) {
			codeAgentState.updateSandboxModel(chatState.selectedModel.id);
		}

		const { isOK, sandboxInfo } = await codeAgentState.executeCodeAgentMode();
		if (!isOK) {
			this.isChecking = false;
			return;
		}

		if (sandboxInfo) {
			let sessionId: string = codeAgentState.sessionId;
			if (!codeAgentState.sessionId) {
				sessionId = nanoid();
				codeAgentState.updateCurrentSessionId(sessionId);
			}

			if (codeAgentTaskboardState.isInitialized) {
				const { workspace_path: workspacePath } = await initProject({
					sandboxId: sandboxInfo.sandboxId,
					sessionId,
				});

				const promises = [
					updateTasklist(sandboxInfo.sandboxId, workspacePath, codeAgentTaskboardState.tasklist),
				];

				if (codeAgentTaskboardState.attachments.length > 0) {
					const attachmentList: Attachment[] = await Promise.all(
						codeAgentTaskboardState.attachments.map(async (att) => ({
							filename: att.name,
							content: att.file ? await fileToBase64(att.file) : "",
						})),
					);
					promises.push(uploadAttachments(sandboxInfo.sandboxId, workspacePath, attachmentList));
				}

				await Promise.all(promises);
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

		this.isChecking = false;
		fn();
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
