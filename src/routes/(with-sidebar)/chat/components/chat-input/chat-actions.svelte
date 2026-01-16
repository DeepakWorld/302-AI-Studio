<script lang="ts">
	import type { ListSkillsResponse } from "$lib/api/skills/base-apis";
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import { McpServerSelector } from "$lib/components/buss/mcp-server-selector";
	import { Overlay } from "$lib/components/buss/overlay";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import { SkillList } from "$lib/components/buss/skill-list";
	import { buttonVariants } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import * as Popover from "$lib/components/ui/popover";
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger,
	} from "$lib/components/ui/tooltip";
	import { m } from "$lib/paraglide/messages.js";
	import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { mcpState } from "$lib/stores/mcp-state.svelte";
	import { cn } from "$lib/utils";
	import mcpIcon from "@lobehub/icons-static-svg/icons/mcp.svg";
	import { Bot, Globe, Lightbulb, ListTodo, Settings2, Zap } from "@lucide/svelte";
	import type { ThinkingBudgetType } from "@shared/types";
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

	let isThinkingBudgetOpen = $state(false);
	let skillsData = $state<Omit<ListSkillsResponse, "success" | "project_skills">>({
		builtin_skills: [],
		user_skills: [],
	});

	const thinkingBudgetOptions = $derived([
		{ key: "off", label: m.settings_off() },
		{ key: "low", label: m.thinking_strength_low() },
		{ key: "medium", label: m.thinking_strength_medium() },
		{ key: "high", label: m.thinking_strength_high() },
		{ key: "max", label: m.thinking_strength_max() },
	]);

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

	function handleSkillsPanelToggle() {
		// Open skills tab if not already on it
		if (agentPreviewState.activeTab !== "skills") {
			agentPreviewState.openSkillsTab();
		}
	}

	function handleTaskboardPanelToggle() {
		// Open taskboard tab if not already on it
		if (agentPreviewState.activeTab !== "taskboard") {
			agentPreviewState.openTaskboardTab();
		}
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

{#snippet actionEnableSkills()}
	{@const hasForceUseSkills = codeAgentState.skills.some((s) => s.forceUse)}
	<ButtonWithTooltip
		class={cn(
			"hover:!bg-chat-action-hover",
			hasForceUseSkills &&
				!codeAgentState.isLoadingSkills &&
				"!bg-chat-action-active hover:!bg-chat-action-active",
		)}
		tooltip={m.title_skills()}
		onclick={handleSkillsPanelToggle}
		disabled={codeAgentState.isLoadingSkills}
	>
		{#if codeAgentState.isLoadingSkills}
			<LdrsLoader type="line-spinner" size={16} />
		{:else}
			<Zap class={cn(hasForceUseSkills && "!text-chat-action-active-fg")} />
		{/if}
	</ButtonWithTooltip>

	<Overlay
		title={m.title_skills_management()}
		open={codeAgentState.isSkillsPanelOpen}
		onClose={handleSkillsPanelToggle}
		class="h-[70vh] w-[80vw] max-w-5xl flex flex-col"
	>
		<div class="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
			<SkillList
				builtinSkills={skillsData.builtin_skills}
				userSkills={skillsData.user_skills}
				loading={codeAgentState.isLoadingSkills}
				usedSkills={codeAgentState.skills}
				onUse={(skill) => codeAgentState.handleSkillsUse([skill])}
				onRemove={(skill) => codeAgentState.handleSkillsRemove([skill])}
				onForceUseToggle={(skill, forceUse) =>
					codeAgentState.handleSkillForceUseToggle(skill.name, forceUse)}
			/>
		</div>
	</Overlay>
{/snippet}

{#snippet actionEnabledAgentThinking()}
	<Popover.Root bind:open={isThinkingBudgetOpen}>
		<TooltipProvider delayDuration={500}>
			<Tooltip ignoreNonKeyboardFocus={true}>
				<TooltipTrigger>
					{#snippet child({ props: tooltipProps })}
						<Popover.Trigger>
							{#snippet child({ props: popoverProps })}
								<button
									{...tooltipProps}
									{...popoverProps}
									class={cn(
										buttonVariants({ variant: "ghost", size: "icon" }),
										"group rounded-[10px]",
										"hover:!bg-chat-action-hover",
										codeAgentState.thinkingBudget !== "off" &&
											"!bg-chat-action-active hover:!bg-chat-action-active",
									)}
									disabled={disabled || codeAgentState.isUpdatingThinkingBudget}
								>
									{#if codeAgentState.isUpdatingThinkingBudget}
										<LdrsLoader type="line-spinner" size={16} />
									{:else}
										<Lightbulb
											class={cn(
												codeAgentState.thinkingBudget !== "off" && "!text-chat-action-active-fg",
											)}
										/>
									{/if}
								</button>
							{/snippet}
						</Popover.Trigger>
					{/snippet}
				</TooltipTrigger>
				<TooltipContent
					side="top"
					class="bg-overlay text-overlay-foreground rounded-[10px] border px-2.5 py-1.5 text-sm/6"
					arrowClasses="hidden"
					sideOffset={5}
				>
					{actionDisabled ? m.title_unsupport_action() : m.title_thinking()}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>

		<Popover.Content class="w-[400px] p-4" align="center" side="bottom" sideOffset={10}>
			<div class="flex flex-col gap-2">
				<div class="flex flex-col gap-2">
					<Label class="text-label-fg">{m.title_thinking_strength()}</Label>
					<div class="text-muted-foreground text-xs">{m.description_thinking_strength()}</div>
				</div>
				<SegButton
					options={thinkingBudgetOptions}
					selectedKey={codeAgentState.thinkingBudget}
					onSelect={(key) => codeAgentState.updateThinkingBudget(key as ThinkingBudgetType)}
					disabled={codeAgentState.isUpdatingThinkingBudget}
				/>
			</div>
		</Popover.Content>
	</Popover.Root>
{/snippet}

{#snippet actionTaskOrchestration()}
	<ButtonWithTooltip
		class="hover:!bg-chat-action-hover"
		tooltip={m.label_tab_taskboard()}
		onclick={handleTaskboardPanelToggle}
		{disabled}
	>
		<ListTodo />
	</ButtonWithTooltip>
{/snippet}

<div class="flex h-chat-bar items-center gap-chat-bar-gap">
	{@render actionUploadAttachment()}

	{#if !codeAgentState.enabled && chatState.providerType === "302ai"}
		{@render actionEnableOnlineSearch()}
		{@render actionEnableThinking()}
	{/if}

	{@render actionEnableMCP()}

	{#if codeAgentState.enabled}
		{@render actionEnableSkills()}
		{@render actionEnabledAgentThinking()}
		{@render actionTaskOrchestration()}
	{:else}
		{@render actionSetParameters()}
	{/if}

	{@render actionCodeAgent()}
</div>
