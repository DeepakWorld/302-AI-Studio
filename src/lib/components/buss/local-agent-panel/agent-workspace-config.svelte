<script lang="ts">
	import { SettingSelect } from "$lib/components/buss/settings";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
	import { RefreshCw } from "@lucide/svelte";
	import { onMount } from "svelte";

	let { mode = "settings" }: { mode?: "settings" | "chat" } = $props();
	void mode; // Mark as intentionally unused for future use

	// Local state for agent framework (currently only claude-code)
	let agentFramework = $state("claude-code");

	const frameworkOptions = [{ value: "claude-code", label: "claude code" }];

	// Fetch sessions on mount
	onMount(async () => {
		await localClaudeCodeSandboxState.refreshSessions();
	});

	async function handleRefresh() {
		await localClaudeCodeSandboxState.refreshSessions();
	}
</script>

<div class="space-y-4">
	<!-- Agent Framework -->
	<div class="space-y-2">
		<Label class="text-label-fg font-normal">{m.local_platform_agent_framework()}</Label>
		<SettingSelect name="Agent Framework" bind:value={agentFramework} options={frameworkOptions} />
	</div>

	<!-- Select Session -->
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<Label class="text-label-fg font-normal">{m.local_platform_select_session()}</Label>
			<Button
				variant="ghost"
				size="icon"
				class="h-6 w-6"
				onclick={handleRefresh}
				disabled={localClaudeCodeSandboxState.isLoading}
			>
				<RefreshCw
					class="h-3.5 w-3.5 {localClaudeCodeSandboxState.isLoading ? 'animate-spin' : ''}"
				/>
			</Button>
		</div>
		<SettingSelect
			name="Select Session"
			value={localClaudeCodeSandboxState.selectedSessionId}
			groupedOptions={localClaudeCodeSandboxState.sessionOptions}
			placeholder={m.local_platform_new_session_placeholder()}
			onValueChange={localClaudeCodeSandboxState.handleSessionSelected.bind(
				localClaudeCodeSandboxState,
			)}
		/>
	</div>

	<!-- Work Directory -->
	<div class="space-y-2">
		<Label class="text-label-fg font-normal">{m.local_platform_work_directory()}</Label>
		<SettingSelect
			name="Work Directory"
			value={localClaudeCodeSandboxState.selectedWorkspacePath}
			groupedOptions={localClaudeCodeSandboxState.workspaceOptions}
			placeholder={m.local_platform_new_work_directory_placeholder()}
			onValueChange={localClaudeCodeSandboxState.handleWorkspaceSelected.bind(
				localClaudeCodeSandboxState,
			)}
		/>
	</div>
</div>
