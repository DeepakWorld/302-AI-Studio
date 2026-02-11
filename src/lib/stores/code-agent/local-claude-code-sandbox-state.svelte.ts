import { deleteLocalSession, listLocalSessions } from "$lib/api/sandbox-session";
import type { GroupedSelectData } from "$lib/components/buss/settings/setting-select.svelte";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import type { LocalSessionInfo } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";

/**
 * Persisted state for local Claude Code sessions.
 */
export const persistedLocalClaudeCodeSessionsState = new PersistedState<LocalSessionInfo[]>(
	"CodeAgentStorage:local-claude-code-sessions-state",
	[],
);

// Trigger reactivity tracking
$effect.root(() => {
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedLocalClaudeCodeSessionsState.current;
	});
});

const newSessionItem = {
	key: "new",
	label: m.local_platform_new_session(),
	value: "new",
};

/**
 * State store for local Claude Code sandbox sessions and workspaces.
 * Manages session/workspace selection with bidirectional linkage.
 */
class LocalClaudeCodeSandboxState {
	// UI selection state
	selectedSessionId = $state("new");
	selectedWorkspacePath = $state("new");

	// Loading state
	isLoading = $state(false);

	// Derived: Sessions from persisted state
	sessions = $derived(persistedLocalClaudeCodeSessionsState.current);

	// Derived: Workspace directories extracted from sessions
	workspaceDirectories = $derived.by(() => {
		const dirs = this.sessions.map((s) => s.workspace_path).filter((dir) => dir !== "");
		return [...new Set(dirs)];
	});

	// Derived: Session options for dropdown
	sessionOptions = $derived.by((): GroupedSelectData => {
		return {
			standalone: [newSessionItem],
			groups:
				this.sessions.length > 0
					? [
							{
								groupKey: "existing",
								groupLabel: m.local_platform_existing_sessions(),
								items: this.sessions.map((s) => ({
									value: s.session_id,
									label: s.note || s.session_id,
									extra: `${m.local_platform_work_directory()}: ${s.workspace_path}`,
								})),
							},
						]
					: [],
		};
	});

	// Derived: Workspace options for dropdown
	workspaceOptions = $derived.by((): GroupedSelectData => {
		return {
			standalone: [{ value: "new", label: m.local_platform_new_work_directory() }],
			groups:
				this.workspaceDirectories.length > 0
					? [
							{
								groupKey: "existing",
								groupLabel: m.local_platform_existing_work_directory(),
								items: this.workspaceDirectories.map((dir) => {
									const relatedSessions = this.sessions.filter((s) => s.workspace_path === dir);
									const sessionLabel = relatedSessions
										.map((s) => s.note || m.local_platform_new_session())
										.join(", ");
									return {
										value: dir,
										label: dir,
										extra: m.local_platform_session({ session: sessionLabel }),
									};
								}),
							},
						]
					: [],
		};
	});

	/**
	 * Refresh sessions from the local container API
	 */
	async refreshSessions(): Promise<void> {
		this.isLoading = true;
		try {
			const response = await listLocalSessions();
			if (response.success) {
				persistedLocalClaudeCodeSessionsState.current = response.session_list;
			}
		} catch (error) {
			console.error("[LocalClaudeCodeSandboxState] Failed to refresh sessions:", error);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Handle session selection with bidirectional linkage.
	 */
	handleSessionSelected(sessionId: string): void {
		this.selectedSessionId = sessionId;
		if (sessionId !== "new") {
			const session = this.sessions.find((s) => s.session_id === sessionId);
			if (session && session.workspace_path) {
				this.selectedWorkspacePath = session.workspace_path;
			}
		}
	}

	/**
	 * Handle workspace selection with bidirectional linkage.
	 */
	handleWorkspaceSelected(workspacePath: string): void {
		this.selectedWorkspacePath = workspacePath;
		if (workspacePath !== "new") {
			this.selectedSessionId = "new";
		}
	}

	reset(): void {
		this.selectedSessionId = "new";
		this.selectedWorkspacePath = "new";
	}

	/**
	 * Delete a local session
	 */
	async deleteSession(sessionId: string): Promise<boolean> {
		// Find workspace path before deletion (we need it for directory cleanup)
		const session = this.sessions.find((s) => s.session_id === sessionId);
		const workspacePath = session?.workspace_path;

		const result = await deleteLocalSession(sessionId);

		if (result.success) {
			// Delete the local workspace directory if it exists.
			// workspace_path is a container-internal path (e.g. "/home/user/workspace/icr6cz4lnm")
			// We extract the last segment as subPath for the local directory mapping.
			if (workspacePath) {
				// Extract "icr6cz4lnm" from "/home/user/workspace/icr6cz4lnm"
				const segments = workspacePath.replace(/\\/g, "/").split("/").filter(Boolean);
				const subPath = segments[segments.length - 1];
				if (subPath) {
					try {
						await window.electronAPI.localVibeService.deleteWorkspaceDirectory(subPath);
					} catch (error) {
						console.error(
							"[LocalClaudeCodeSandboxState] Failed to delete workspace directory:",
							subPath,
							error,
						);
					}
				}
			}

			toast.success(m.delete_session_success());

			// Mark threads using this session as deleted (shows SessionDeleted UI)
			// "local" is the virtual sandboxId used in local mode
			await window.electronAPI.codeAgentService.deleteClaudeCodeSession("local", sessionId);

			await this.refreshSessions();
		} else {
			toast.error(m.delete_session_failed());
		}

		return result.success;
	}
}

export const localClaudeCodeSandboxState = new LocalClaudeCodeSandboxState();
