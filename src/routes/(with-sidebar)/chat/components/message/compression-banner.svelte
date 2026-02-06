<script lang="ts">
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from "$lib/components/ui/collapsible";
	import * as m from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { ChevronDown, FileStack } from "@lucide/svelte";

	let isExpanded = $state(false);

	const compressedCount = $derived(chatState.compressedMessageCount ?? 0);
	const contextSummary = $derived(chatState.contextSummary);
	const isActive = $derived(compressedCount > 0 && !!contextSummary);
</script>

{#if isActive}
	<Collapsible bind:open={isExpanded} class="mb-4 rounded-lg border bg-muted/30 p-3">
		<CollapsibleTrigger
			class="flex w-full items-center justify-between text-left transition-colors hover:bg-muted/20 rounded-md p-2"
		>
			<div class="flex items-center gap-2">
				<FileStack class="h-4 w-4 text-muted-foreground" />
				<span class="text-sm text-muted-foreground">
					{m.compression_banner_count({ count: compressedCount })}
				</span>
			</div>
			<ChevronDown
				class="h-4 w-4 text-muted-foreground transition-transform duration-200 {isExpanded
					? 'rotate-180'
					: ''}"
			/>
		</CollapsibleTrigger>
		<CollapsibleContent class="space-y-2">
			<div class="pt-3">
				<div class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
					{contextSummary}
				</div>
			</div>
		</CollapsibleContent>
	</Collapsible>
{/if}
