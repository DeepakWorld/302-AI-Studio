<script lang="ts">
	import { cn } from "$lib/utils";

	interface Props {
		title: string;
		description?: string;
		isSelected?: boolean;
		onclick?: () => void;
		onmouseenter?: () => void;
	}

	let { title, description = "", isSelected = false, onclick, onmouseenter }: Props = $props();
</script>

<button
	type="button"
	class={cn(
		"flex w-full cursor-pointer items-center rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
		isSelected ? "bg-accent text-accent-fg" : "hover:bg-muted",
	)}
	{onclick}
	{onmouseenter}
>
	<div class="flex flex-col">
		<span class="font-medium">{title}</span>
		{#if description}
			<span class="text-xs text-muted-fg">{description}</span>
		{/if}
	</div>
</button>
