import { listLocalClaudeCodeSessions } from "$lib/api/sandbox-session";
import type { GroupedSelectData } from "$lib/components/buss/settings/setting-select.svelte";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import type { LocalSessionInfo } from "@shared/storage/code-agent";

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
									console.log("relatedSessions", relatedSessions);
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
			const response = await listLocalClaudeCodeSessions();
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
}

export const localClaudeCodeSandboxState = new LocalClaudeCodeSandboxState();
