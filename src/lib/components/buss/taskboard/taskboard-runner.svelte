<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import * as m from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentSendMessageButtonState, codeAgentState } from "$lib/stores/code-agent";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { cn } from "$lib/utils.js";
	import { toast } from "svelte-sonner";
	import { match } from "ts-pattern";

	let openModelSelect = $state<() => void>();

	// Derived states from store
	const isRunning = $derived(codeAgentTaskboardState.taskboardStatus === "running");
	const isWaitingToStop = $derived(codeAgentTaskboardState.taskboardStatus === "waiting_to_stop");
	const isWaitingForChat = $derived(codeAgentTaskboardState.taskboardStatus === "waiting_for_chat");
	const isWaitingForUserInput = $derived(
		codeAgentTaskboardState.taskboardStatus === "waiting_for_user_input",
	);
	const currentTask = $derived(
		codeAgentTaskboardState.tasklist.find((t) => t.status === "in_progress"),
	);
	const currentTaskContent = $derived(currentTask?.content ?? "—");
	const buttonText = $derived(codeAgentTaskboardState.buttonText);

	const hasConfiguredProviders = $derived(() => {
		return persistedProviderState.current.some(
			(provider) => provider.enabled && provider.apiKey && provider.apiKey.trim() !== "",
		);
	});

	async function handleGoToModelSettings() {
		await window.electronAPI.windowService.handleOpenSettingsWindow("/settings/model-settings");
	}

	async function handleRun() {
		const fn = async (content: string) =>
			match({
				isEmpty: content.trim() === "" && chatState.attachments.length === 0,
				noProviders: !hasConfiguredProviders(),
				noModel: chatState.selectedModel === null,
			})
				.with({ isEmpty: true }, () => {
					toast.warning(m.toast_empty_message());
				})
				.with({ noProviders: true }, () => {
					toast.info(m.toast_no_provider_configured(), {
						action: {
							label: m.text_button_go_to_settings(),
							onClick: () => handleGoToModelSettings(),
						},
					});
				})
				.with({ noModel: true }, () => {
					toast.warning(m.toast_no_model(), {
						action: {
							label: m.text_button_select_model(),
							onClick: () => {
								if (!hasConfiguredProviders()) {
									toast.info(m.toast_no_provider_configured(), {
										action: {
											label: m.text_button_go_to_settings(),
											onClick: () => handleGoToModelSettings(),
										},
									});
									return;
								}
								openModelSelect?.();
							},
						},
					});
				})
				.otherwise(() => {
					if (chatState.hasMessages) {
						chatState.sendMessage({ content });
					} else {
						document.startViewTransition(() => chatState.sendMessage({ content }));
					}
				});

		codeAgentTaskboardState.startAutoExecution(async (content) => {
			if (codeAgentState.enabled && codeAgentState.isFreshTab) {
				await codeAgentSendMessageButtonState.handleCodeAgentFlow(() => fn(content));
			} else {
				await fn(content);
			}
		});

		// if (codeAgentState.enabled && codeAgentState.isFreshTab) {
		// 	codeAgentTaskboardState.startAutoExecution(async () => {
		// 		await codeAgentSendMessageButtonState.handleCodeAgentFlow(fn);
		// 	});
		// } else {
		// 	codeAgentTaskboardState.startAutoExecution(async () => fn());
		// }
	}
</script>

<div class="p-3">
	<div class={cn("flex flex-col gap-2 p-3 rounded-xl border", "bg-input")}>
		<!-- Row 1: Status indicators & buttons (wrap on narrow) -->
		<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
			<!-- Status indicator -->
			<div class="flex items-center gap-2 text-sm">
				{#if isWaitingForUserInput}
					<span class="flex items-center gap-1.5 text-orange-500">
						<span class="size-2 rounded-full bg-orange-500 animate-pulse"></span>
						{m.taskboard_status_waiting_for_user_input()}
					</span>
				{:else if isWaitingForChat}
					<span class="flex items-center gap-1.5 text-blue-500">
						<span class="size-2 rounded-full bg-blue-500 animate-pulse"></span>
						{m.taskboard_status_waiting_for_chat()}
					</span>
				{:else if isWaitingToStop}
					<span class="flex items-center gap-1.5 text-yellow-500">
						<span class="size-2 rounded-full bg-yellow-500 animate-pulse"></span>
						{m.taskboard_status_waiting_to_stop()}
					</span>
				{:else if isRunning}
					<span class="flex items-center gap-1.5 text-primary">
						<span class="size-2 rounded-full bg-primary animate-pulse"></span>
						{m.taskboard_status_running()}
					</span>
				{:else}
					<span class="flex items-center gap-1.5 text-muted-foreground">
						<span class="size-2 rounded-full bg-muted-foreground/50"></span>
						{m.taskboard_status_idle()}
					</span>
				{/if}
			</div>

			<!-- Buttons -->
		</div>

		<!-- Row 2: Current task -->
		<div class="flex justify-between">
			<div class="flex items-center gap-2 text-sm min-w-0">
				<span class="text-muted-foreground shrink-0">{m.taskboard_label_current()}</span>
				<span class="truncate font-medium">{currentTaskContent}</span>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="default"
					size="sm"
					disabled={(!codeAgentTaskboardState.canStart &&
						!isRunning &&
						!isWaitingToStop &&
						!isWaitingForChat &&
						!currentTask) ||
						(!isRunning && !isWaitingToStop && !isWaitingForChat && codeAgentState.isChecking)}
					onclick={handleRun}
				>
					{buttonText}
				</Button>
			</div>
		</div>
	</div>
</div>
