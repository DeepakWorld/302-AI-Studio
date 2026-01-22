<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import * as m from "$lib/paraglide/messages";
	import { cn } from "$lib/utils.js";
	import { Repeat2 } from "@lucide/svelte";
	import type { Component } from "svelte";
	import ButtonWithTooltip from "../button-with-tooltip/button-with-tooltip.svelte";

	let {
		count = $bindable(1),
		defaultCount = 1,
		tooltip = m.taskboard_repeat_times(),
		Icon = Repeat2,
	}: {
		count: number;
		defaultCount?: number;
		tooltip?: string;
		Icon?: Component;
	} = $props();

	let isEditing = $state(false);
	let inputRef = $state<HTMLInputElement | null>(null);

	function normalizeNumber(value: string): number {
		const n = Number.parseInt(value, 10);
		return Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : defaultCount;
	}
</script>

<div
	class={cn(
		"group relative flex items-center rounded-[10px] transition-all duration-300 ease-out",
		"bg-secondary/80 text-secondary-foreground pr-1",
		"h-8",
	)}
	role="group"
	onmouseenter={() => (isEditing ? null : (isEditing = false))}
	onmouseleave={() => {
		if (!isEditing) {
			isEditing = false;
			inputRef?.blur();
		}
	}}
>
	<div onmousedown={(e) => e.preventDefault()} role="none">
		<ButtonWithTooltip
			{tooltip}
			class="hover:bg-transparent dark:hover:bg-transparent"
			onclick={() => {
				isEditing = true;
				inputRef?.focus();
			}}
			size="icon-sm"
		>
			<Icon class="size-4" />
		</ButtonWithTooltip>
	</div>

	{#if !isEditing}
		<button
			class="text-xs pr-2 pl-0.5 cursor-pointer select-none animate-in fade-in zoom-in duration-200"
			onclick={() => {
				isEditing = true;
				inputRef?.focus();
			}}
		>
			{count}
		</button>
	{/if}

	<div
		class={cn(
			"overflow-hidden transition-[width] duration-300 ease-out",
			isEditing ? "w-10" : "w-0",
		)}
	>
		<Input
			bind:ref={inputRef}
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
				if (!input.value || Number.parseInt(input.value, 10) === 0) {
					return;
				}
				count = normalizeNumber(input.value);
				if (input.value !== count.toString()) {
					input.value = count.toString();
				}
			}}
			onblur={(e) => {
				const input = e.currentTarget as HTMLInputElement;
				isEditing = false;
				count = normalizeNumber(input.value);
				input.value = count.toString();
			}}
		/>
	</div>
</div>
