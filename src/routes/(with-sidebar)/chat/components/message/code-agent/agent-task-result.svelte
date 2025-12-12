<script lang="ts" module>
	export interface Props {
		result: ResultMetadata;
	}
</script>

<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { CopyButton } from "$lib/components/buss/copy-button";
	import { MarkdownRenderer } from "$lib/components/buss/markdown/index.js";

	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { m } from "$lib/paraglide/messages";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import type { ResultMetadata } from "$lib/types/chat";
	import { Info } from "@lucide/svelte";

	let { result }: Props = $props();

	let isDialogOpen = $state(false);
	let duration = $derived.by(() => {
		if (result.duration_ms == null) return null;
		return (result.duration_ms / 1000).toFixed(1);
	});
</script>

{#snippet header()}
	<Dialog.Header class="flex flex-row items-center justify-between">
		<Dialog.Title>{m.title_agent_task_infos()}</Dialog.Title>
		{#if result.is_error}
			<span class="text-sm text-[#D82525]">{m.tool_call_status_error()}</span>
		{:else}
			<span class="text-sm text-[#38B865]">{m.tool_call_status_success()}</span>
		{/if}
	</Dialog.Header>
{/snippet}

{#snippet content()}
	<div class="overflow-y-auto h-full">
		{#if result.content}
			<div class="prose prose-sm max-w-none dark:prose-invert">
				<MarkdownRenderer
					content={result.content}
					codeTheme={persistedThemeState.current.shouldUseDarkColors
						? "vitesse-dark"
						: "vitesse-light"}
				/>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet footer()}
	<div class="flex flex-row justify-between items-center">
		<div class="flex flex-row items-center gap-x-4">
			<span class="text-sm text-muted-foreground">{m.text_duration()}: {duration}s</span>
			<span class="text-sm text-muted-foreground">{m.text_turns()}: {result.num_turns}</span>
		</div>
		<div class="flex flex-row items-center gap-x-2">
			<span class="text-sm text-muted-foreground">{result.session_id}</span>
			<CopyButton content={result.session_id ?? ""} />
		</div>
	</div>
{/snippet}

<Dialog.Root bind:open={isDialogOpen}>
	<ButtonWithTooltip
		tooltipSide="bottom"
		class="text-muted-foreground hover:!bg-chat-action-hover"
		tooltip={m.title_agent_task_infos()}
		onclick={() => (isDialogOpen = true)}
	>
		<Info class="h-4 w-4" />
	</ButtonWithTooltip>
	<Dialog.Content class="!min-w-[600px] px-8 h-[60vh]">
		{@render header()}
		{@render content()}
		{@render footer()}
	</Dialog.Content>
</Dialog.Root>
