<script lang="ts" module>
	export const platformOptions = [
		{
			key: "remote",
			label: m.title_remote(),
		},
		{
			key: "local",
			label: m.title_local(),
		},
	];
	export const options: SelectOption[] = [
		{
			key: "claude-code",
			label: "Claude Code",
			value: "claude-code",
		},
	];

	export interface Props {
		onClose: () => void;
	}
</script>

<script lang="ts">
	import NoSupportIcon from "$lib/assets/icons/code-agent/not-support.svg";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import type { SelectOption } from "$lib/components/buss/settings/setting-select.svelte";
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import type { CodeAgentType } from "@shared/storage/code-agent";
	import ClaudeCodePanel from "./claude-code-panel.svelte";

	let { onClose }: Props = $props();

	let disabled = $derived(!codeAgentState.isFreshTab);

	async function handleSelect(key: string) {
		codeAgentState.updateType(key as CodeAgentType);
	}

	function handleCodeAgentSelected(codeAgentId: string) {
		codeAgentState.updateCurrentAgentId(codeAgentId);
	}
</script>

<div class="w-[600px]">
	<div class="flex flex-col gap-y-4 rounded-[10px] bg-background p-4">
		<div class="gap-settings-gap flex flex-col">
			<Label class="mb-2 text-label-fg">{m.title_code_agent_type()}</Label>
			<SegButton
				options={platformOptions}
				selectedKey={codeAgentState.type}
				onSelect={handleSelect}
				{disabled}
			/>
		</div>

		{#if codeAgentState.type === "remote"}
			<Label class="text-label-fg">{m.title_agent()}</Label>
			<SettingSelect
				name="agent"
				value={codeAgentState.currentAgentId}
				{options}
				{disabled}
				placeholder={m.select_agent()}
				onValueChange={(codeAgentId) => handleCodeAgentSelected(codeAgentId)}
			/>

			{#if codeAgentState.currentAgentId === "claude-code"}
				<ClaudeCodePanel {onClose} />
			{/if}
		{/if}
		{#if codeAgentState.type === "local"}
			<!-- TODO: local agent -->
			<Empty.Root>
				<Empty.Content class="h-[200px] flex flex-col gap-0 items-center justify-center">
					<img src={NoSupportIcon} alt="Not supported" />
					<Empty.Description>
						{m.unsupport()}
					</Empty.Description>
				</Empty.Content>
			</Empty.Root>
		{/if}
	</div>
</div>
