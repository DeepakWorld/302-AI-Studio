<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import * as m from "$lib/paraglide/messages";
	import { cn } from "$lib/utils.js";
	import { Repeat2 } from "@lucide/svelte";
	import ButtonWithTooltip from "../button-with-tooltip/button-with-tooltip.svelte";

	let { count = $bindable(1) }: { count: number } = $props();

	let repeatPinned = $state(false);
	let repeatInputRef = $state<HTMLInputElement | null>(null);

	function normalizeRepeatNumber(value: string): number {
		const n = Number.parseInt(value, 10);
		return Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1;
	}
</script>

<div
	class={cn(
		"group relative flex items-center rounded-[10px] transition-all duration-300 ease-out",
		"bg-secondary/80 text-secondary-foreground pr-1",
		"h-8",
	)}
	role="group"
	onmouseenter={() => (repeatPinned ? null : (repeatPinned = false))}
	onmouseleave={() => {
		if (!repeatPinned) {
			repeatPinned = false;
			repeatInputRef?.blur();
		}
	}}
>
	<div onmousedown={(e) => e.preventDefault()} role="none">
		<ButtonWithTooltip
			tooltip={m.taskboard_repeat_times()}
			class="hover:bg-transparent dark:hover:bg-transparent"
			onclick={() => {
				repeatPinned = true;
				repeatInputRef?.focus();
			}}
			size="icon-sm"
		>
			<Repeat2 class="size-4" />
		</ButtonWithTooltip>
	</div>

	{#if !repeatPinned}
		<button
			class="text-xs pr-2 pl-0.5 cursor-pointer select-none animate-in fade-in zoom-in duration-200"
			onclick={() => {
				repeatPinned = true;
				repeatInputRef?.focus();
			}}
		>
			{count}
		</button>
	{/if}

	<div
		class={cn(
			"overflow-hidden transition-[width] duration-300 ease-out",
			repeatPinned ? "w-10" : "w-0",
		)}
	>
		<Input
			bind:ref={repeatInputRef}
			type="number"
			min={1}
			max={99}
			inputmode="numeric"
			class={cn(
				"h-8 w-10 bg-transparent px-0 text-center !text-xs tabular-nums",
				"border-0 shadow-none outline-none ring-0",
				"focus:outline-none focus:ring-0 focus-visible:ring-0",
				"hover:border-0 hover:ring-0",
			)}
			value={count}
			oninput={(e) => {
				const input = e.currentTarget as HTMLInputElement;
				count = normalizeRepeatNumber(input.value);
				// 强制同步输入框的显示值，防止显示超过 99 的数字
				input.value = count.toString();
			}}
			onblur={(e) => {
				const input = e.currentTarget as HTMLInputElement;
				repeatPinned = false;
				count = normalizeRepeatNumber(input.value);
				input.value = count.toString();
			}}
		/>
	</div>
</div>
