import { deleteSession } from "$lib/api/sandbox-session";
import { validate302Provider } from "$lib/api/webserve-deploy";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import { persistedProviderState } from "$lib/stores/provider-state.svelte";
import type { ClaudeCodeSandboxInfo } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";
import { claudeCodeAgentState } from "./claude-code-state.svelte";

export const persistedClaudeCodeSandboxState = new PersistedState<ClaudeCodeSandboxInfo[]>(
	"CodeAgentStorage:claude-code-sandbox-state",
	[],
);

const newSessionItem = {
	key: "new",
	label: m.select_session_new(),
	value: "new",
};

const {
	updateClaudeCodeSandboxesByIpc,
	updateClaudeCodeSessions,
	deleteClaudeCodeSandboxByIpc,
	updateClaudeCodeSandboxRemark,
} = window.electronAPI.codeAgentService;

$effect.root(() => {
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedClaudeCodeSandboxState.current;
	});
});

class ClaudeCodeSandboxState {
	sandboxRemarkMap = $state(new Map<string, string>());

	sandboxes = $derived.by(() => {
		return [
			{
				key: "auto",
				label: m.select_sandbox_auto(),
				value: "auto",
			},
			...persistedClaudeCodeSandboxState.current.map((sandbox) => {
				this.sandboxRemarkMap.set(sandbox.sandboxId, sandbox.sandboxRemark);
				return {
					key: sandbox.sandboxId,
					label: `${sandbox.sandboxId} (${m.remark()}: ${sandbox.sandboxRemark === "" ? m.remark_null() : sandbox.sandboxRemark})`,
					value: sandbox.sandboxId,
				};
			}),
		];
	});

	sessions = $derived.by(() => {
		const sanboxes = persistedClaudeCodeSandboxState.current;
		return [
			newSessionItem,
			...sanboxes
				.flatMap((sandbox) => sandbox.sessionInfos)
				.map((session) => {
					const name = session.note && session.note !== "" ? session.note : session.sessionId;
					return {
						key: session.workspacePath,
						label: name,
						value: session.sessionId,
						extra: session.usedAt,
					};
				}),
		];
	});

	/**
	 * Get the workspace path for the current session
	 * Returns the session's workspacePath if available, empty string otherwise
	 */
	currentSessionWorkspacePath = $derived.by(() => {
		const sandboxId = claudeCodeAgentState.sandboxId;
		const sessionId = claudeCodeAgentState.currentSessionId;

		console.log("[ClaudeCodeSandboxState] Computing currentSessionWorkspacePath:", {
			sandboxId,
			sessionId,
			sandboxCount: persistedClaudeCodeSandboxState.current.length,
		});

		const sandbox = persistedClaudeCodeSandboxState.current.find(
			(sandbox) => sandbox.sandboxId === sandboxId,
		);
		if (!sandbox) {
			console.log("[ClaudeCodeSandboxState] Sandbox not found for ID:", sandboxId);
			return "";
		}

		console.log(
			"[ClaudeCodeSandboxState] Found sandbox, sessionInfos count:",
			sandbox.sessionInfos.length,
		);

		const session = sandbox.sessionInfos.find((s) => s.sessionId === sessionId);
		const workspacePath = session?.workspacePath || "";

		console.log("[ClaudeCodeSandboxState] Session workspace path:", {
			sessionId,
			foundSession: !!session,
			workspacePath,
		});

		return workspacePath;
	});

	async refreshSandboxes(): Promise<boolean> {
		const { isOK } = await updateClaudeCodeSandboxesByIpc();
		if (!isOK) {
			toast.error(m.refresh_failed());
		}

		toast.success(m.refresh_success());
		return isOK;
	}

	async refreshSessions(sandboxId: string): Promise<boolean> {
		const { isOK } = await updateClaudeCodeSessions(sandboxId);

		if (!isOK) {
			toast.error(m.refresh_sessions_failed());
		}

		return isOK;
	}

	async deleteSandbox(sandboxId: string): Promise<boolean> {
		const { isOK, error } = await deleteClaudeCodeSandboxByIpc(sandboxId);
		if (isOK) {
			toast.success(m.delete_sandbox_success());
		} else {
			toast.error(m.delete_sandbox_failed());
			console.error(error);
		}
		return isOK;
	}

	async updateSandboxRemark(sandboxId: string, remark: string): Promise<boolean> {
		const { isOK } = await updateClaudeCodeSandboxRemark(sandboxId, remark);
		if (isOK) {
			toast.success(m.update_remark_success());
			await this.refreshSandboxes();
		} else {
			toast.error(m.update_remark_failed());
		}
		return isOK;
	}

	async handleSessionSelected(sessionId: string): Promise<void> {
		const sandboxList = persistedClaudeCodeSandboxState.current;

		if (sessionId !== "new") {
			const targetSandbox = sandboxList.find((sandbox) =>
				sandbox.sessionInfos.find((sessionInfo) => sessionInfo.sessionId === sessionId),
			);
			if (targetSandbox) {
				claudeCodeAgentState.selectedSandboxId = targetSandbox.sandboxId;
				claudeCodeAgentState.selectedSandboxRemark = targetSandbox.sandboxRemark;
				claudeCodeAgentState.selectedSessionRemark =
					targetSandbox.sessionInfos.find((sessionInfo) => sessionInfo.sessionId === sessionId)
						?.note || "";
			}
		}

		claudeCodeAgentState.selectedSessionId = sessionId;
	}

	async handleSelectSandbox(sandboxId: string): Promise<void> {
		const sandboxList = persistedClaudeCodeSandboxState.current;

		if (sandboxId === "auto") {
			claudeCodeAgentState.selectedSessionId = "new";
			claudeCodeAgentState.selectedSessionRemark = "";
			claudeCodeAgentState.selectedSandboxId = "auto";
			claudeCodeAgentState.selectedSandboxRemark = "";
		} else {
			const targetSandbox = sandboxList.find((sandbox) => sandbox.sandboxId === sandboxId);
			if (targetSandbox) {
				claudeCodeAgentState.selectedSandboxId = targetSandbox.sandboxId;
				claudeCodeAgentState.selectedSandboxRemark = targetSandbox.sandboxRemark;
				claudeCodeAgentState.selectedSessionId = "new";
				claudeCodeAgentState.selectedSessionRemark = "";
			}
		}
	}

	async deleteSession(sandboxId: string, sessionId: string): Promise<boolean> {
		const providerResult = validate302Provider(persistedProviderState.current);
		if (!providerResult.valid || !providerResult.provider) {
			toast.error("No 302.AI provider available");
			return false;
		}

		const result = await deleteSession(providerResult.provider, {
			sandbox_id: sandboxId,
			session_id: sessionId,
		});

		if (result.success) {
			toast.success(m.delete_session_success());
			// Cleanup threads using this session
			await window.electronAPI.codeAgentService.deleteClaudeCodeSession(sandboxId, sessionId);
			// Refresh sessions after successful deletion
			await this.refreshSessions(sandboxId);
		} else {
			toast.error(result.error || m.delete_session_failed());
		}

		return result.success;
	}
}

export const claudeCodeSandboxState = new ClaudeCodeSandboxState();
