<script lang="ts">
	import { SettingSelect } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";

	let { mode = "settings" }: { mode?: "settings" | "chat" } = $props();
	void mode; // Mark as intentionally unused for future use

	// Local state only
	let agentFramework = $state("claude-code");
	let selectedSession = $state("new");
	let workDirectory = $state("new");

	const frameworkOptions = [{ value: "claude-code", label: "claude code" }];
	const sessionOptions = [{ value: "new", label: m.local_platform_new_session() }];

	// Simulated existing directories
	const existingWorkDirectories = [
		{ value: "dir1", label: "MyProject-A", session: "Session-Alpha" },
		{ value: "dir2", label: "MyProject-B", session: "Session-Beta" },
		{ value: "dir3", label: "Experiment-01", session: "Session-Gamma" },
	];

	// Grouped options for Work Directory
	const workDirectoryOptions = $derived({
		standalone: [{ value: "new", label: m.local_platform_new_work_directory() }],
		groups: [
			{
				groupKey: "existing",
				groupLabel: m.local_platform_existing_work_directory(),
				items: existingWorkDirectories.map((dir) => ({
					value: dir.value,
					label: dir.label,
					extra: m.local_platform_session({ session: dir.session }),
				})),
			},
		],
	});
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
			groupedOptions={workDirectoryOptions}
			placeholder={m.local_platform_new_work_directory_placeholder()}
		/>
	</div>
</div>
