<script lang="ts">
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import { cn } from "$lib/utils";
	import { AlertTriangle } from "@lucide/svelte";

	interface Props {
		status: "gray" | "green" | "red";
		text: string;
		showWarning?: boolean;
		warningTooltip?: string;
		className?: string; // Allow custom class
	}

	let { status, text, showWarning = false, warningTooltip, className }: Props = $props();

	// Derived classes for status dot
	const statusColorClass = $derived(
		status === "green" ? "bg-green-500" : status === "red" ? "bg-red-500" : "bg-muted-foreground", // gray
	);

	const statusIconClass = $derived(
		status === "green"
			? "text-green-600"
			: status === "red"
				? "text-red-600"
				: "text-muted-foreground",
	);
</script>

<div class={cn("flex items-center gap-2", className)}>
	<span class={cn("size-2 rounded-full", statusColorClass)}></span>
	<span class={cn("text-sm", statusIconClass)}>{text}</span>
	{#if status === "green"}
		<!-- <Circle class="size-3 fill-green-500 text-green-500" />  Optional: extra checkmark/circle if needed, mimicking mockup -->
	{/if}
	{#if showWarning}
		<Tooltip.Root>
			<Tooltip.Trigger>
				<AlertTriangle class="size-4 text-yellow-500" />
			</Tooltip.Trigger>
			{#if warningTooltip}
				<Tooltip.Content>
					<p>{warningTooltip}</p>
				</Tooltip.Content>
			{/if}
		</Tooltip.Root>
	{/if}
</div>
