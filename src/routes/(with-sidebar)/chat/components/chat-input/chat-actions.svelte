<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { McpServerSelector } from "$lib/components/buss/mcp-server-selector";
	import { Overlay } from "$lib/components/buss/overlay";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";

	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { mcpState } from "$lib/stores/mcp-state.svelte";
	import { cn } from "$lib/utils";
	import mcpIcon from "@lobehub/icons-static-svg/icons/mcp.svg";
	import { Bot, Globe, Lightbulb, Settings2 } from "@lucide/svelte";
	import { AttachmentUploader } from "../attachment";
	import CodeAgentPanel from "../code-agent/code-agent-panel.svelte";
	import ParametersPanel from "./parameter/parameters-panel.svelte";

	const { addClaudeCodeSandboxMCP } = window.electronAPI.codeAgentService;

	interface Props {
		disabled?: boolean;
	}
	let { disabled = false }: Props = $props();

	let actionDisabled = $derived(chatState.providerType !== "302ai");

	let isMCPSelectorOpen = $state(false);
	let addingMCP = $state(false);

	function handleParametersClose() {
		chatState.isParametersOpen = false;
	}

	function handleMCPClick() {
		isMCPSelectorOpen = true;
	}

	async function handleMCPServerConfirm(selectedIds: string[]) {
		if (selectedIds.length > 0 && codeAgentState.enabled) {
			const sandboxId = codeAgentState.sandboxId;
			if (sandboxId) {
				addingMCP = true;
				const infos = mcpState.getMCPInfosByIds(selectedIds);
				await addClaudeCodeSandboxMCP(sandboxId, infos);
				addingMCP = false;
			}
		}

		chatState.handleMCPServerChange(selectedIds);
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
		disabled={disabled || addingMCP}
	>
		{#if addingMCP}
			<LdrsLoader type="line-spinner" size={16} />
		{:else}
			<img
				src={mcpIcon}
				alt="MCP"
				class={cn(
					"size-chat-icon group-hover:[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)] dark:invert",
					chatState.isMCPActive &&
						"[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)] dark:[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)]",
				)}
			/>
		{/if}
	</ButtonWithTooltip>

	<McpServerSelector
		bind:open={isMCPSelectorOpen}
		selectedServerIds={chatState.mcpServerIds}
		onConfirm={handleMCPServerConfirm}
		filterType={codeAgentState.enabled ? "streamableHTTP" : undefined}
	/>
{/snippet}

{#snippet actionSetParameters()}
	<ButtonWithTooltip
		class="hover:!bg-chat-action-hover"
		tooltip={m.title_chat_parameters()}
		onclick={() => (chatState.isParametersOpen = true)}
		{disabled}
	>
		<Settings2 />
	</ButtonWithTooltip>

	<Overlay
		title={m.title_chat_parameters()}
		open={chatState.isParametersOpen}
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
			codeAgentState.enabled &&
				"!bg-chat-action-active hover:!bg-chat-action-active border border-[color:var(--code-agent-primary)] rounded-[10px]",
		)}
		tooltip={m.title_code_agent()}
		onclick={() => handleCodeAgentClick()}
		size="sm"
		disabled={disabled || (codeAgentState.isFreshTab ? false : !codeAgentState.inCodeAgentMode)}
	>
		<div class="flex items-center">
			<Bot class={cn("size-4", codeAgentState.enabled && "!text-chat-action-active-fg")} />
			<div
				class={cn(
					"h-3.5 border-l mx-1.5",
					codeAgentState.enabled ? "code-agent-divider-active" : "code-agent-divider",
				)}
			></div>
			<span
				class={cn(
					"transition-all duration-300 ease-in-out opacity-100 max-w-[200px]",
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
	{@render actionUploadAttachment()}

	{#if !codeAgentState.enabled}
		{#if chatState.providerType === "302ai"}
			{@render actionEnableOnlineSearch()}
			{@render actionEnableThinking()}
		{/if}
	{/if}

	{@render actionEnableMCP()}

	{#if !codeAgentState.enabled}
		{@render actionSetParameters()}
	{/if}

	{@render actionCodeAgent()}
</div>
