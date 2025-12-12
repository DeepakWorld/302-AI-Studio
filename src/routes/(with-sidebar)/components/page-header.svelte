<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { useSidebar } from "$lib/components/ui/sidebar";
	import { m } from "$lib/paraglide/messages";
	import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { claudeCodeAgentState } from "$lib/stores/code-agent/claude-code-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { cn } from "$lib/utils";
	import { Ghost, Server, Settings } from "@lucide/svelte";

	async function handleNewSettingsTab() {
		await window.electronAPI.windowService.handleOpenSettingsWindow();
	}

	// Check if agent preview button should be shown
	const showAgentPreviewButton = $derived(
		codeAgentState.enabled &&
			codeAgentState.currentAgentId === "claude-code" &&
			claudeCodeAgentState.sandboxId !== "",
	);

	// Handle agent preview toggle
	function handleAgentPreviewToggle() {
		if (agentPreviewState.isVisible) {
			agentPreviewState.closePreview();
		} else {
			const sandboxId = claudeCodeAgentState.sandboxId;
			if (sandboxId) {
				agentPreviewState.openPreview(sandboxId);
			}
		}
	}
</script>

<div
	class="absolute top-0 left-0 right-0 z-40 flex h-12 w-full flex-row items-center justify-between bg-transparent px-2"
>
	<ButtonWithTooltip
		tooltip={useSidebar().state === "expanded" ? m.title_sidebar_close() : m.title_sidebar_open()}
		tooltipSide="bottom"
	>
		<Sidebar.Trigger class="hover:!bg-icon-btn-hover size-9 [&_svg]:!size-5" />
	</ButtonWithTooltip>

	<div class="flex flex-row items-center gap-2">
		{#if showAgentPreviewButton}
			<ButtonWithTooltip
				class={cn(
					"hover:!bg-icon-btn-hover",
					agentPreviewState.isVisible && "!bg-icon-btn-active hover:!bg-icon-btn-active",
				)}
				tooltipSide="bottom"
				tooltip={agentPreviewState.isVisible
					? m.tooltip_close_agent_preview()
					: m.tooltip_open_agent_preview()}
				onclick={handleAgentPreviewToggle}
			>
				<Server class={cn("size-5", agentPreviewState.isVisible && "!text-icon-btn-active-fg")} />
			</ButtonWithTooltip>
		{/if}

		<ButtonWithTooltip
			class={cn(
				"hover:!bg-icon-btn-hover",
				chatState.isPrivateChatActive && "!bg-icon-btn-active hover:!bg-icon-btn-active",
			)}
			tooltipSide="bottom"
			tooltip={chatState.canTogglePrivacy ? m.title_incognito() : m.title_incognito_disabled()}
			disabled={!chatState.canTogglePrivacy}
			onclick={() => chatState.handlePrivateChatActiveChange(!chatState.isPrivateChatActive)}
		>
			<Ghost class={cn("size-5", chatState.isPrivateChatActive && "!text-icon-btn-active-fg")} />
		</ButtonWithTooltip>

		<ButtonWithTooltip
			tooltip={m.title_settings()}
			class="hover:!bg-icon-btn-hover"
			tooltipSide="bottom"
			onclick={() => handleNewSettingsTab()}
		>
			<Settings class="size-5" />
		</ButtonWithTooltip>
	</div>
</div>
