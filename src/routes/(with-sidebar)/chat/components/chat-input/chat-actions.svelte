<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { McpServerSelector } from "$lib/components/buss/mcp-server-selector";
	import { Overlay } from "$lib/components/buss/overlay";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";

	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { cn } from "$lib/utils";
	import mcpIcon from "@lobehub/icons-static-svg/icons/mcp.svg";
	import { Bot, Globe, Lightbulb, Settings2 } from "@lucide/svelte";
	import { AttachmentUploader } from "../attachment";
	import CodeAgentPanel from "../code-agent/code-agent-panel.svelte";
	import ParametersPanel from "./parameters-panel.svelte";

	interface Props {
		disabled?: boolean;
	}
	let { disabled = false }: Props = $props();

	let actionDisabled = $derived(chatState.providerType !== "302ai");

	let isParametersOpen = $state(false);
	let isMCPSelectorOpen = $state(false);

	function handleParametersClose() {
		isParametersOpen = false;
	}

	function handleMCPSelectorClose() {
		isMCPSelectorOpen = false;
	}

	function handleMCPClick() {
		isMCPSelectorOpen = true;
	}

	function handleMCPServerConfirm(selectedIds: string[]) {
		chatState.handleMCPServerIdsChange(selectedIds);
		chatState.handleMCPActiveChange(selectedIds.length > 0);
	}

	function handleCodeAgentClick() {
		if (codeAgentState.enabled && codeAgentState.isFreshTab) {
			codeAgentState.updateEnabled(false);
			return;
		}

		codeAgentState.isCodeAgentPanelOpen = true;
	}

	function handleCodeAgentPanelClose() {
		codeAgentState.isCodeAgentPanelOpen = false;
	}
</script>

{#snippet actionEnableThinking()}
	<ButtonWithTooltip
		class={cn(
			"hover:!bg-chat-action-hover",
			chatState.isThinkingActive && "!bg-chat-action-active hover:!bg-chat-action-active",
		)}
		tooltip={actionDisabled ? m.title_unsupport_action() : m.title_thinking()}
		onclick={() => chatState.handleThinkingActiveChange(!chatState.isThinkingActive)}
		{disabled}
	>
		<Lightbulb class={cn(chatState.isThinkingActive && "!text-chat-action-active-fg")} />
	</ButtonWithTooltip>
{/snippet}

{#snippet actionEnableOnlineSearch()}
	<ButtonWithTooltip
		class={cn(
			"hover:!bg-chat-action-hover",
			chatState.isOnlineSearchActive && "!bg-chat-action-active hover:!bg-chat-action-active",
		)}
		tooltip={actionDisabled ? m.title_unsupport_action() : m.title_online_search()}
		onclick={() => chatState.handleOnlineSearchActiveChange(!chatState.isOnlineSearchActive)}
		{disabled}
	>
		<Globe class={cn(chatState.isOnlineSearchActive && "!text-chat-action-active-fg")} />
	</ButtonWithTooltip>
{/snippet}

{#snippet actionEnableMCP()}
	<ButtonWithTooltip
		class={cn(
			"hover:!bg-chat-action-hover",
			chatState.isMCPActive && "!bg-chat-action-active hover:!bg-chat-action-active",
		)}
		tooltip={m.title_mcpServers()}
		onclick={handleMCPClick}
		{disabled}
	>
		<img
			src={mcpIcon}
			alt="MCP"
			class={cn(
				"size-chat-icon group-hover:[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)] dark:invert",
				chatState.isMCPActive &&
					"[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)] dark:[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)]",
			)}
		/>
	</ButtonWithTooltip>

	<McpServerSelector
		bind:open={isMCPSelectorOpen}
		selectedServerIds={chatState.mcpServerIds}
		onClose={handleMCPSelectorClose}
		onConfirm={handleMCPServerConfirm}
	/>
{/snippet}

{#snippet actionSetParameters()}
	<ButtonWithTooltip
		class="hover:!bg-chat-action-hover"
		tooltip={m.title_chat_parameters()}
		onclick={() => (isParametersOpen = true)}
		{disabled}
	>
		<Settings2 />
	</ButtonWithTooltip>

	<Overlay
		title={m.title_chat_parameters()}
		open={isParametersOpen}
		onClose={handleParametersClose}
	>
		<ParametersPanel />
	</Overlay>
{/snippet}

{#snippet actionUploadAttachment()}
	<AttachmentUploader {disabled} />
{/snippet}

{#snippet actionCodeAgent()}
	<ButtonWithTooltip
		class={cn(
			"h-9 px-2.5",
			"hover:!bg-chat-action-hover group/code-agent",
			codeAgentState.enabled && "!bg-chat-action-active hover:!bg-chat-action-active",
		)}
		tooltip={m.title_code_agent()}
		onclick={() => handleCodeAgentClick()}
		size="sm"
		disabled={disabled || (codeAgentState.isFreshTab ? false : !codeAgentState.inCodeAgentMode)}
	>
		<div class="flex items-center">
			<Bot class={cn("size-4", codeAgentState.enabled && "!text-chat-action-active-fg")} />
			<span
				class={cn(
					"transition-all duration-300 ease-in-out opacity-0 group-hover/code-agent:ml-2 group-hover/code-agent:opacity-100 max-w-0 group-hover/code-agent:max-w-[200px]",
					codeAgentState.enabled && "!text-chat-action-active-fg",
				)}
			>
				{m.title_code_agent()}
			</span>
		</div>
	</ButtonWithTooltip>

	<Overlay
		title={m.title_code_agent()}
		open={codeAgentState.isCodeAgentPanelOpen}
		onClose={handleCodeAgentPanelClose}
	>
		<CodeAgentPanel onClose={handleCodeAgentPanelClose} />
	</Overlay>
{/snippet}

<div class="flex h-chat-bar items-center gap-chat-bar-gap">
	{#if !codeAgentState.enabled}
		{@render actionUploadAttachment()}
		{#if chatState.providerType === "302ai"}
			{@render actionEnableThinking()}
			{@render actionEnableOnlineSearch()}
		{/if}
		{@render actionEnableMCP()}
		{@render actionSetParameters()}
	{/if}

	{@render actionCodeAgent()}
</div>
