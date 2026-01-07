import { deploySandboxProject, type DeploySandboxResponse } from "$lib/api/sandbox-deploy";
import { _updateSessionNote } from "$lib/api/sandbox-session";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import type { ChatMessage } from "$lib/types/chat";
import { type CodeAgentMetadata } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";
import { agentPreviewState } from "../agent-preview-state.svelte";

export interface ClaudeCodeSandboxInfo {
	sandboxId: string;
	sandboxRemark: string;
	llmModel: string;
	diskUsage: "normal" | "insufficient";
}

const {
	checkClaudeCodeSandbox,
	updateClaudeCodeSandboxesByIpc,
	createClaudeCodeSandboxByIpc,
	findClaudeCodeSandboxWithValidDisk,
} = window.electronAPI.codeAgentService;

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
		skills: [],
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
	skills = $derived(persistedClaudeCodeAgentState.current?.skills ?? []);
	agentMode = $derived.by(() => {
		return this.selectedSessionId === "new" ? "new" : "existing";
	});

	async handleChatFinished({
		canDeploy,
		lastMessage,
	}: {
		canDeploy: boolean;
		lastMessage: ChatMessage;
	}) {
		if (!canDeploy || !lastMessage || lastMessage.role !== "assistant") return;

		let deployInfo: DeploySandboxResponse | null = await this.handleActiveDeployment(lastMessage);
		const textDeployInfo = this.parseDeployInfoFromText(lastMessage);
		if (textDeployInfo) {
			deployInfo = textDeployInfo;
		}

		if (deployInfo) {
			await this.finalizeDeployment(deployInfo);
		}
	}

	private async handleActiveDeployment(
		message: ChatMessage,
	): Promise<DeploySandboxResponse | null> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const metadata = message.metadata as any;
		if (!metadata?.result?.preDeploy?.success) return null;

		console.log("[ClaudeCodeAgentState] Pre-deploy check passed, triggering deployment...");

		if (!this.sandboxId) return null;

		agentPreviewState.isDeploying = true;
		try {
			const result = await deploySandboxProject({
				sandbox_id: this.sandboxId,
				session_id: this.currentSessionId,
			});

			if (result.success) {
				console.log("[ClaudeCodeAgentState] Deployment successful:", result);
				return result;
			} else {
				console.error("[ClaudeCodeAgentState] Deployment failed:", result);
				toast.error(`${m.toast_deploy_failed()}`);
				return null;
			}
		} catch (error) {
			console.error("[ClaudeCodeAgentState] Deployment error:", error);
			toast.error(`${m.toast_deploy_failed()}: ${String(error)}`);
			return null;
		} finally {
			agentPreviewState.isDeploying = false;
		}
	}

	private parseDeployInfoFromText(message: ChatMessage): DeploySandboxResponse | null {
		const textContent = message.parts
			.filter((part): part is { type: "text"; text: string } => part.type === "text")
			.map((part) => part.text)
			.join("\n");

		if (!textContent.includes("**deploy sandbox successfully**")) return null;

		// Pattern matches: {'success': True, 'status': '...', 'id': '...', 'url': '...', 'cover': '...'}
		const deployInfoRegex =
			/\{[^{}]*'success'\s*:\s*(True|False)[^{}]*'status'\s*:\s*'([^']*)'[^{}]*'id'\s*:\s*'([^']*)'[^{}]*'url'\s*:\s*'([^']*)'[^{}]*'cover'\s*:\s*'([^']*)'\s*\}/;
		const match = textContent.match(deployInfoRegex);

		if (match) {
			const info = {
				success: match[1] === "True",
				status: match[2],
				id: match[3],
				url: match[4],
				cover: match[5],
			};
			console.log("[ClaudeCodeAgentState] Parsed deploy info:", info);
			return info;
		}

		return null;
	}

	private async finalizeDeployment(deployInfo: DeploySandboxResponse) {
		await agentPreviewState.setDeploymentInfo(
			this.sandboxId,
			this.currentSessionId,
			deployInfo.url,
			deployInfo.id,
		);
		console.log("[ClaudeCodeAgentState] Deploy detected:", { isDeploy: true, deployInfo });
	}

	async handleThreadTitleUpdated({ title }: { title: string }) {
		const { success } = await _updateSessionNote({
			note: title,
			sandbox_id: this.sandboxId,
			session_id: this.currentSessionId,
		});

		if (!success) toast.error(m.error_update_session_note());

		await updateClaudeCodeSandboxesByIpc();
	}

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

	updateSandboxModel(model: string): void {
		this.updateState({ model });
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
