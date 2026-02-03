<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog";
	import { ScrollArea } from "$lib/components/ui/scroll-area";

	interface Props {
		open: boolean;
		title: string;
		logs: string[];
	}

	let { open = $bindable(false), title, logs }: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="min-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
		</Dialog.Header>
		<div class="rounded-md bg-black/90 p-4 font-mono text-sm text-green-400">
			<ScrollArea class="h-[300px] w-full">
				<div class="space-y-1 min-w-0">
					{#each logs as log, i (i)}
						<p class="whitespace-pre-wrap break-all">{log}</p>
					{/each}
				</div>
			</ScrollArea>
		</div>
	</Dialog.Content>
</Dialog.Root>
