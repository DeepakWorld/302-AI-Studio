<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";

	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		isOpen?: boolean;
		children: Snippet;
	}

	let { title, isOpen = $bindable(), children }: Props = $props();
</script>

<Collapsible.Root bind:open={isOpen} class="rounded-settings-item bg-settings-item-bg">
	<Collapsible.Trigger
		class="flex w-full cursor-pointer items-center justify-between px-4 py-3 hover:bg-muted/50 rounded-settings-item transition-colors"
	>
		<div class="flex items-center gap-2">
			<span class="text-sm font-medium">{title}</span>
		</div>
		<div class="flex items-center gap-2">
			<ChevronDownIcon
				class="size-4 text-muted-foreground transition-transform duration-200 {isOpen
					? 'rotate-180'
					: ''}"
			/>
		</div>
	</Collapsible.Trigger>
	<Collapsible.Content class="px-4 pb-4">
		<div class="pt-2">
			{@render children()}
		</div>
	</Collapsible.Content>
</Collapsible.Root>
