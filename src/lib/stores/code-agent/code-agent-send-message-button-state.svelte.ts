import { chatState } from "../chat-state.svelte";
import { codeAgentState } from "./code-agent-state.svelte";

class CodeAgentSendMessageButtonState {
	executionIterator: AsyncGenerator<string, void, boolean> | null = null;

	showLackOfDiskDialog = $state(false);
	isChecking = $state(false);

	async *enableCodeAgentFlow(fn: () => void) {
		this.isChecking = true;

		const { isOK, sandboxInfo } = await codeAgentState.executeCodeAgentMode();
		if (!isOK) {
			this.isChecking = false;
			return;
		}

		if (sandboxInfo) {
			if (chatState.selectedModel && chatState.selectedModel.id !== sandboxInfo.llmModel) {
				await codeAgentState.handleCodeAgentModelChange(chatState.selectedModel);
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
