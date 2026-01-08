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
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import type { SelectOption } from "$lib/components/buss/settings/setting-select.svelte";
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { persistedClaudeCodeSandboxState } from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { claudeCodeAgentState } from "$lib/stores/code-agent/claude-code-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import type { CodeAgentType } from "@shared/storage/code-agent";
	import ClaudeCodePanel from "./claude-code-panel.svelte";

	let { onClose }: Props = $props();

	let disabled = $derived(!codeAgentState.isFreshTab);
	let tempSandboxRemark = $state("");
	let tempSessionRemark = $state("");

	let currentSandboxRemark = $derived.by(() => {
		const sandboxId = claudeCodeAgentState.sandboxId;
		const currentSandbox = persistedClaudeCodeSandboxState.current.find(
			(s) => s.sandboxId === sandboxId,
		);
		return currentSandbox?.sandboxRemark ?? "";
	});

	let currentSessionRemark = $derived.by(() => {
		const sandboxId = claudeCodeAgentState.sandboxId;
		const sessionId = claudeCodeAgentState.currentSessionId;
		const currentSandbox = persistedClaudeCodeSandboxState.current.find(
			(s) => s.sandboxId === sandboxId,
		);
		const currentSession = currentSandbox?.sessionInfos.find((s) => s.sessionId === sessionId);
		return currentSession?.note ?? "";
	});

	let isSandboxRemarkChanged = $derived(tempSandboxRemark !== currentSandboxRemark);
	let isSessionRemarkChanged = $derived(tempSessionRemark !== currentSessionRemark);

	$effect(() => {
		if (codeAgentState.inCodeAgentMode && codeAgentState.currentAgentId === "claude-code") {
			tempSandboxRemark = currentSandboxRemark;

			tempSessionRemark = currentSessionRemark;
		}
	});

	async function handleSelect(key: string) {
		codeAgentState.updateType(key as CodeAgentType);
	}

	function handleCodeAgentSelected(codeAgentId: string) {
		codeAgentState.updateCurrentAgentId(codeAgentId);
	}

	async function handleUpdateSandboxRemark() {
		if (!tempSandboxRemark || !isSandboxRemarkChanged) return;
		await codeAgentState.updateSandboxRemark(tempSandboxRemark);
	}

	async function handleUpdateSessionRemark() {
		if (!tempSessionRemark || !isSessionRemarkChanged) return;
		await codeAgentState.updateSessionRemark(tempSessionRemark);
	}
</script>

{#snippet initializePanel()}
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
{/snippet}

{#snippet configurationPanel()}
	<div class="w-[500px]">
		<div class="flex flex-col gap-y-4 rounded-[10px] bg-background p-4">
			<div class="gap-settings-gap flex flex-col">
				<Label class="text-label-fg">{m.title_sandbox_remark()}</Label>
				<div class="flex flex-row gap-2">
					<Input
						class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
						bind:value={tempSandboxRemark}
						placeholder={m.placeholder_input_sandbox_remark()}
					/>
					<Button
						variant="outline"
						class="h-10 shrink-0"
						disabled={codeAgentState.isUpdatingSandboxRemark || !isSandboxRemarkChanged}
						onclick={handleUpdateSandboxRemark}
					>
						{#if codeAgentState.isUpdatingSandboxRemark}
							<LdrsLoader type="line-spinner" size={16} />
						{:else}
							{m.text_button_save()}
						{/if}
					</Button>
				</div>
			</div>

			<div class="gap-settings-gap flex flex-col">
				<Label class="text-label-fg">{m.label_remark()}</Label>
				<div class="flex flex-row gap-2">
					<Input
						class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
						bind:value={tempSessionRemark}
						placeholder={m.placeholder_input()}
					/>
					<Button
						variant="outline"
						class="h-10 shrink-0"
						disabled={codeAgentState.isUpdatingSessionRemark || !isSessionRemarkChanged}
						onclick={handleUpdateSessionRemark}
					>
						{#if codeAgentState.isUpdatingSessionRemark}
							<LdrsLoader type="line-spinner" size={16} />
						{:else}
							{m.text_button_save()}
						{/if}
					</Button>
				</div>
			</div>

			<div class="flex flex-row justify-between">
				<Button variant="secondary" onclick={onClose}>
					{m.common_cancel()}
				</Button>
				<Button onclick={onClose}>
					{m.label_button_confirm()}
				</Button>
			</div>
		</div>
	</div>
{/snippet}

{#if codeAgentState.inCodeAgentMode}
	{@render configurationPanel()}
{:else}
	{@render initializePanel()}
{/if}
