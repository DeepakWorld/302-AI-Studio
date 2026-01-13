<script lang="ts">
	import LdrsLoader from "$lib/components/buss/ldrs-loader/ldrs-loader.svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Item from "$lib/components/ui/item/index.js";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { Pause, Play } from "@lucide/svelte";
</script>

<Item.Root variant="outline" class="w-full max-w-chat-max-w !cursor-default">
	<Item.Content class="flex flex-row items-center gap-x-2">
		<div class="flex items-center justify-center">
			<LdrsLoader
				type={codeAgentTaskboardState.isTaskboardRunning ? "ripples" : "ping"}
				size={32}
				speed={5}
			/>
		</div>
		<span class="truncate text-sm font-medium">
			{codeAgentTaskboardState.inProgressTask?.content ?? "12321"}
		</span>
	</Item.Content>
	<Item.Actions>
		<Button variant="secondary" size="sm" onclick={() => {}}>
			{m.title_button_taskboard_panel()}
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class="hover:bg-secondary/80 dark:hover:bg-secondary/80"
			onclick={() => codeAgentTaskboardState.toggleTaskboardRunningStatus()}
		>
			{#if codeAgentTaskboardState.isTaskboardRunning}
				<Pause class="h-4 w-4" />
			{:else}
				<Play class="h-4 w-4 " />
			{/if}
		</Button>
	</Item.Actions>
</Item.Root>
