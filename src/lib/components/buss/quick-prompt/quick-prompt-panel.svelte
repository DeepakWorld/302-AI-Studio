<script lang="ts">
	import type { QuickPrompt, QuickPromptCategory } from "$lib/datas/quick-prompts";
	import { m } from "$lib/paraglide/messages";
	import { quickPromptState } from "$lib/stores/quick-prompt-state.svelte";
	import { cn } from "$lib/utils";
	import { Search, X } from "@lucide/svelte";

	interface Props {
		onSelect: (prompt: QuickPrompt) => void;
		onClose: () => void;
	}

	const { onSelect, onClose }: Props = $props();

	let inputRef = $state<HTMLInputElement | null>(null);

	// Focus input when panel opens
	$effect(() => {
		if (quickPromptState.isOpen && inputRef) {
			// Small delay to ensure the panel is fully rendered
			setTimeout(() => inputRef?.focus(), 50);
		}
	});

	function handleSelect(prompt: QuickPrompt) {
		onSelect(prompt);
		quickPromptState.close();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			e.preventDefault();
			onClose();
		}
	}

	function getCategoryLabel(category: QuickPromptCategory): string {
		switch (category) {
			case "translation":
				return m.quick_prompt_category_translation();
			case "programming":
				return m.quick_prompt_category_programming();
			case "writing":
				return m.quick_prompt_category_writing();
			case "education":
				return m.quick_prompt_category_education();
			case "career":
				return m.quick_prompt_category_career();
			case "lifestyle":
				return m.quick_prompt_category_lifestyle();
			case "roleplay":
				return m.quick_prompt_category_roleplay();
			case "tools":
				return m.quick_prompt_category_tools();
			default:
				return category;
		}
	}

	function getCategoryIcon(category: QuickPromptCategory): string {
		switch (category) {
			case "translation":
				return "🌐";
			case "programming":
				return "💻";
			case "writing":
				return "✍️";
			case "education":
				return "📚";
			case "career":
				return "💼";
			case "lifestyle":
				return "🏠";
			case "roleplay":
				return "🎭";
			case "tools":
				return "🔧";
			default:
				return "📝";
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="flex flex-col overflow-hidden rounded-lg border bg-popover shadow-lg"
	style="width: min(500px, calc(100vw - 2rem)); max-height: min(400px, 50vh);"
	role="dialog"
	tabindex="-1"
	aria-label={m.quick_prompt_panel_title()}
	onkeydown={handleKeydown}
>
	<!-- Header with search -->
	<div class="flex items-center gap-2 border-b px-3 py-2">
		<Search class="size-4 shrink-0 text-muted-foreground" />
		<input
			bind:this={inputRef}
			type="text"
			class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
			placeholder={m.quick_prompt_search_placeholder()}
			value={quickPromptState.searchQuery}
			oninput={(e) => quickPromptState.setSearchQuery(e.currentTarget.value)}
		/>
		<button
			type="button"
			class="rounded p-1 hover:bg-muted"
			onclick={onClose}
			aria-label={m.btn_close()}
		>
			<X class="size-4" />
		</button>
	</div>

	<!-- Category tabs -->
	<div class="shrink-0 border-b">
		<div class="category-scroll-container overflow-x-auto px-2 py-1.5">
			<div class="flex w-max gap-1">
				<button
					type="button"
					class={cn(
						"shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors whitespace-nowrap",
						quickPromptState.selectedCategory === null
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:bg-muted hover:text-foreground",
					)}
					onclick={() => quickPromptState.setCategory(null)}
				>
					{m.quick_prompt_category_all()}
				</button>
				{#each quickPromptState.categories as category}
					{@const count = quickPromptState.categoryCounts.get(category) ?? 0}
					<button
						type="button"
						class={cn(
							"flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors whitespace-nowrap",
							quickPromptState.selectedCategory === category
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
						onclick={() => quickPromptState.toggleCategory(category)}
					>
						<span>{getCategoryIcon(category)}</span>
						<span>{getCategoryLabel(category)}</span>
						<span class="text-[10px] opacity-60">({count})</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Prompt list -->
	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="p-2">
			{#if quickPromptState.filteredPrompts.length === 0}
				<div class="py-6 text-center text-sm text-muted-foreground">
					{m.quick_prompt_no_results()}
				</div>
			{:else}
				<div class="flex flex-col gap-1">
					{#each quickPromptState.filteredPrompts as prompt (prompt.act)}
						<button
							type="button"
							class="flex flex-col items-start gap-1 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
							onclick={() => handleSelect(prompt)}
						>
							<div class="flex items-center gap-2">
								<span class="text-sm">{getCategoryIcon(prompt.category)}</span>
								<span class="text-sm font-medium">{prompt.act}</span>
							</div>
							<p class="line-clamp-2 text-xs text-muted-foreground">
								{prompt.prompt.slice(0, 100)}...
							</p>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Footer hint -->
	<div class="border-t px-3 py-1.5 text-xs text-muted-foreground">
		{m.quick_prompt_hint()}
	</div>
</div>

<style>
	/* Category tabs horizontal scroll */
	.category-scroll-container {
		scrollbar-width: thin;
		scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
	}
	.category-scroll-container::-webkit-scrollbar {
		height: 6px;
	}
	.category-scroll-container::-webkit-scrollbar-track {
		background: transparent;
	}
	.category-scroll-container::-webkit-scrollbar-thumb {
		background-color: hsl(var(--muted-foreground) / 0.3);
		border-radius: 3px;
	}
	.category-scroll-container::-webkit-scrollbar-thumb:hover {
		background-color: hsl(var(--muted-foreground) / 0.5);
	}
</style>
