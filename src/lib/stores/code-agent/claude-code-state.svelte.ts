import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import { type CodeAgentMetadata } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";

export interface ClaudeCodeSandboxInfo {
	sandboxId: string;
	sandboxRemark: string;
	llmModel: string;
	diskUsage: "normal" | "insufficient";
}

const { checkClaudeCodeSandbox, createClaudeCodeSandboxByIpc, findClaudeCodeSandboxWithValidDisk } =
	window.electronAPI.codeAgentService;

const tab = window.tab ?? null;

const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

function getInitialData() {
	const initialData = {
		model: "claude-sonnet-4-5-20250929",
		currentWorkspacePath: "",
		workspacePaths: [],
		variables: [],
		currentSessionId: "",
		sandboxId: "",
		sandboxRemark: "",
	};
	return initialData;
}

export const persistedClaudeCodeAgentState = new PersistedState<CodeAgentMetadata>(
	"CodeAgentStorage:claude-code-agent-state" + "-" + threadId,
	getInitialData(),
);

class ClaudeCodeAgentState {
	baseUrl = "https://api.302.ai/v1";

	customSandboxName = $state("");

	selectedSessionId = $state("new");
	selectedSessionRemark = $state("");
	selectedSandboxId = $state("auto");
	selectedSandboxRemark = $state("");

	model = $derived(persistedClaudeCodeAgentState.current?.model ?? "");
	currentSessionId = $derived(persistedClaudeCodeAgentState.current?.currentSessionId ?? "");
	sandboxId = $derived(persistedClaudeCodeAgentState.current?.sandboxId ?? "");
	sandboxRemark = $derived(persistedClaudeCodeAgentState.current?.sandboxRemark ?? "");

	agentMode = $derived.by(() => {
		return this.selectedSessionId === "new" ? "new" : "existing";
	});

	private updateState(partial: Partial<CodeAgentMetadata>): void {
		persistedClaudeCodeAgentState.current = {
			...(persistedClaudeCodeAgentState.current ?? getInitialData()),
			...partial,
		};
	}

	updateCurrentSessionId(sessionId: string): void {
		this.updateState({ currentSessionId: sessionId });
	}

	updateSandboxId(sandboxId: string): void {
		this.updateState({ sandboxId });
	}

	updateSandboxRemark(sandboxRemark: string): void {
		this.updateState({ sandboxRemark });
	}

	async handleAgentModeExecute(): Promise<{
		isOK: boolean;
		sandboxInfo?: ClaudeCodeSandboxInfo;
	}> {
		if (this.agentMode === "existing") {
			const { isOK, valid, sandboxInfo } = await checkClaudeCodeSandbox(this.selectedSandboxId);
			if (!isOK || !valid) {
				toast.error(m.error_verify_sandbox());
				return { isOK: false };
			}

			this.updateState({
				sandboxId: this.selectedSandboxId,
				sandboxRemark: sandboxInfo?.sandboxRemark,
				currentSessionId: this.selectedSessionId,
			});

			return { isOK: true, sandboxInfo };
		} else if (this.agentMode === "new") {
			if (this.selectedSandboxId === "auto") {
				const { isOK, sandboxInfo } = await findClaudeCodeSandboxWithValidDisk(threadId);
				if (!isOK) {
					toast.error(m.error_verify_sandbox());
					return { isOK: false };
				}

				this.updateState({
					sandboxId: sandboxInfo?.sandboxId,
					sandboxRemark: sandboxInfo?.sandboxRemark,
				});

				return { isOK: true, sandboxInfo };
			} else {
				const { isOK, valid, sandboxInfo } = await checkClaudeCodeSandbox(this.selectedSandboxId);
				if (!isOK || !valid) {
					toast.error(m.error_verify_sandbox());
					return { isOK: false };
				}

				this.updateState({
					sandboxId: this.selectedSandboxId,
					sandboxRemark: sandboxInfo?.sandboxRemark,
				});

				return { isOK: true, sandboxInfo };
			}
		}
		return { isOK: false };
	}

	async handleCreateNewSandbox(): Promise<boolean> {
		const { isOK, sandboxId } = await createClaudeCodeSandboxByIpc(
			threadId,
			this.customSandboxName,
		);
		if (!isOK) {
			toast.error(m.error_create_sandbox());
			return false;
		}

		this.selectedSandboxId = sandboxId;
		toast.success(m.success_create_sandbox());
		return true;
	}
}

export const claudeCodeAgentState = new ClaudeCodeAgentState();
