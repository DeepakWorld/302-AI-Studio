<script lang="ts">
	import LdrsLoader from "$lib/components/buss/ldrs-loader/ldrs-loader.svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Item from "$lib/components/ui/item/index.js";
	import { m } from "$lib/paraglide/messages";
	import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentSendMessageButtonState } from "$lib/stores/code-agent/code-agent-send-message-button-state.svelte";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { Pause, Play } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { match } from "ts-pattern";

	let openModelSelect = $state<() => void>();

	const statusText = $derived(
		match(codeAgentTaskboardState.taskboardStatus)
			.with("idle", () => m.taskboard_bar_status_idle())
			.with("running", () => m.taskboard_bar_status_running())
			.with("waiting_to_stop", () => m.taskboard_bar_status_waiting_to_stop())
			.exhaustive(),
	);

	const hasConfiguredProviders = $derived(() => {
		return persistedProviderState.current.some(
			(provider) => provider.enabled && provider.apiKey && provider.apiKey.trim() !== "",
		);
	});

	async function handleGoToModelSettings() {
		await window.electronAPI.windowService.handleOpenSettingsWindow("/settings/model-settings");
	}

	async function handleRun() {
		const fn = () =>
			match({
				isEmpty: chatState.inputValue.trim() === "" && chatState.attachments.length === 0,
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
						chatState.sendMessage();
					} else {
						document.startViewTransition(() => chatState.sendMessage());
					}
				});

		codeAgentTaskboardState.startAutoExecution(async () => {
			await codeAgentSendMessageButtonState.handleCodeAgentFlow(fn);
		});
	}

	const taskContent = $derived.by(() => {
		const list = codeAgentTaskboardState.tasklist;
		const status = codeAgentTaskboardState.taskboardStatus;

		if (status === "running" || status === "waiting_to_stop") {
			return (
				list.find((t) => t.status === "in_progress")?.content ??
				list.find((t) => t.status === "pending")?.content ??
				"—"
			);
		}
		// Idle
		return list.find((t) => t.status === "pending")?.content ?? "—";
	});
</script>

<Item.Root variant="outline" class="w-full max-w-chat-max-w !cursor-default">
	<Item.Content class="flex flex-row items-center gap-x-2">
		<div class="flex items-center justify-center">
			{#if codeAgentTaskboardState.taskboardStatus === "running" || codeAgentTaskboardState.taskboardStatus === "waiting_to_stop"}
				<LdrsLoader type="ripples" size={32} speed={5} />
			{:else}
				<LdrsLoader type="ping" size={32} speed={5} />
			{/if}
		</div>
		<span class="truncate text-sm font-medium">
			{statusText}
			{taskContent}
		</span>
	</Item.Content>
	<Item.Actions>
		<Button variant="secondary" size="sm" onclick={() => agentPreviewState.openTaskboardTab()}>
			{m.title_button_taskboard_panel()}
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class="hover:bg-secondary/80 dark:hover:bg-secondary/80"
			onclick={handleRun}
		>
			{#if codeAgentTaskboardState.taskboardStatus === "running"}
				<Pause class="h-4 w-4" />
			{:else}
				<Play class="h-4 w-4 " />
			{/if}
		</Button>
	</Item.Actions>
</Item.Root>
