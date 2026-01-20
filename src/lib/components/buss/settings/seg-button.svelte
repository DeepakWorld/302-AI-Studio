<script lang="ts">
	import { cn } from "$lib/utils";
	import { type Icon as IconType } from "@lucide/svelte";
	import { onMount } from "svelte";

	interface SegmentedOption {
		key: string;
		icon?: typeof IconType;
		label: string;
		iconSize?: number;
	}

	interface Props {
		options: SegmentedOption[];
		selectedKey: string | null;
		onSelect: (key: string) => void;
		disabled?: boolean;
		class?: string;
		thumbClass?: string;
	}

	let { options, selectedKey, onSelect, disabled, class: className, thumbClass }: Props = $props();

	let thumbStyle: { left: string; width: string } = $state({ left: "", width: "" });
	const itemElements: HTMLElement[] = $state([]);
	let containerElement: HTMLElement | null = $state(null);

	const selectedIndex = $derived(options.findIndex((o) => o.key === selectedKey));

	async function updateThumbPosition() {
		if (selectedIndex === -1) return;

		const item = itemElements[selectedIndex];
		if (!item) return;

		thumbStyle = {
			left: `${item.offsetLeft}px`,
			width: `${item.offsetWidth}px`,
		};
	}

	$effect(() => {
		if (selectedIndex !== -1) {
			updateThumbPosition();
		}
	});

	onMount(() => {
		updateThumbPosition();
		if (containerElement) {
			const observer = new ResizeObserver(() => {
				updateThumbPosition();
			});
			observer.observe(containerElement);
			return () => observer.disconnect();
		}
	});

	function handleSelect(key: string) {
		onSelect(key);
	}
</script>

<div
	bind:this={containerElement}
	class={cn(
		"h-seg rounded-seg-button-container bg-settings-item-bg px-seg-x relative flex items-center",
		className,
	)}
>
	{#if thumbStyle.left}
		<div
			class={cn(
				"h-seg-thumb bg-accent absolute z-1 rounded-md transition-all duration-400 ease-in-out",
				thumbClass,
			)}
			style="left: {thumbStyle.left}; width: {thumbStyle.width};"
		></div>
	{/if}

	<div class="flex w-full gap-2">
		{#each options as option, index (option.key)}
			{@const isActive = selectedKey === option.key}
			<button
				bind:this={itemElements[index]}
				class={cn(
					"h-seg-thumb relative z-2 flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md text-sm",
					thumbClass,
					isActive ? "text-accent-foreground" : "text-secondary-foreground hover:bg-tab-hover z-1",
					disabled && "cursor-not-allowed opacity-50",
				)}
				type="button"
				{disabled}
				onmousedown={() => handleSelect(option.key)}
				aria-pressed={isActive}
			>
				{#if option.icon}
					<!-- {@html option.icon} -->
					<option.icon size={option.iconSize} />
				{/if}
				<span>{option.label}</span>
			</button>
		{/each}
	</div>
</div>
