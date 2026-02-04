<script lang="ts">
	import { SettingSelect } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { onMount } from "svelte";

	let { mode = "settings" }: { mode?: "settings" | "chat" } = $props();
	void mode; // Mark as intentionally unused for future use

	// Local state
	let agentFramework = $state("claude-code");
	let selectedSession = $state("new");
	let workDirectory = $state("new");

	// Workspace directories state
	let existingDirectories = $state<string[]>([]);

	const frameworkOptions = [{ value: "claude-code", label: "claude code" }];
	const sessionOptions = [{ value: "new", label: m.local_platform_new_session() }];

	// Grouped options for Work Directory - reactive based on fetched directories
	const workDirectoryOptions = $derived(() => ({
		standalone: [{ value: "new", label: m.local_platform_new_work_directory() }],
		groups:
			existingDirectories.length > 0
				? [
						{
							groupKey: "existing",
							groupLabel: m.local_platform_existing_work_directory(),
							items: existingDirectories.map((dir) => ({
								value: dir,
								label: dir,
							})),
						},
					]
				: [],
	}));

	// Fetch existing work directories on mount
	onMount(async () => {
		await loadWorkspaceDirectories();
	});

	async function loadWorkspaceDirectories() {
		try {
			existingDirectories = await window.electronAPI.localVibeService.listWorkspaceDirectories();
		} catch (error) {
			console.error("[WorkspaceConfig] Failed to load directories:", error);
			existingDirectories = [];
		}
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
		<Label class="text-label-fg font-normal">{m.local_platform_select_session()}</Label>
		<SettingSelect
			name="Select Session"
			bind:value={selectedSession}
			options={sessionOptions}
			placeholder={m.local_platform_new_session_placeholder()}
		/>
	</div>

	<!-- Work Directory -->
	<div class="space-y-2">
		<Label class="text-label-fg font-normal">{m.local_platform_work_directory()}</Label>
		<SettingSelect
			name="Work Directory"
			bind:value={workDirectory}
			groupedOptions={workDirectoryOptions()}
			placeholder={m.local_platform_new_work_directory_placeholder()}
		/>
	</div>
</div>
