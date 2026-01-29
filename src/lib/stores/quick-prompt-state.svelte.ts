import {
	type QuickPrompt,
	type QuickPromptCategory,
	quickPrompts,
	QUICK_PROMPT_CATEGORIES,
} from "$lib/datas/quick-prompts";

class QuickPromptState {
	isOpen = $state(false);
	searchQuery = $state("");
	selectedCategory = $state<QuickPromptCategory | null>(null);

	/** All available prompts */
	private prompts = quickPrompts;

	/** All available categories */
	categories = QUICK_PROMPT_CATEGORIES;

	/** Filtered prompts based on search query and selected category */
	filteredPrompts = $derived.by(() => {
		let result = this.prompts;

		// Filter by category
		if (this.selectedCategory) {
			result = result.filter((p) => p.category === this.selectedCategory);
		}

		// Filter by search query
		if (this.searchQuery.trim()) {
			const query = this.searchQuery.toLowerCase().trim();
			result = result.filter((p) => p.act.toLowerCase().includes(query));
		}

		return result;
	});

	/** Get prompts grouped by category */
	promptsByCategory = $derived.by(() => {
		const grouped = new Map<QuickPromptCategory, QuickPrompt[]>();

		for (const category of this.categories) {
			grouped.set(category, []);
		}

		for (const prompt of this.prompts) {
			const list = grouped.get(prompt.category);
			if (list) {
				list.push(prompt);
			}
		}

		return grouped;
	});

	/** Count of prompts per category */
	categoryCounts = $derived.by(() => {
		const counts = new Map<QuickPromptCategory, number>();
		for (const [category, prompts] of this.promptsByCategory) {
			counts.set(category, prompts.length);
		}
		return counts;
	});

	open() {
		this.isOpen = true;
		this.searchQuery = "";
		this.selectedCategory = null;
	}

	close() {
		this.isOpen = false;
		this.searchQuery = "";
		this.selectedCategory = null;
	}

	setSearchQuery(query: string) {
		this.searchQuery = query;
	}

	setCategory(category: QuickPromptCategory | null) {
		this.selectedCategory = category;
	}

	toggleCategory(category: QuickPromptCategory) {
		if (this.selectedCategory === category) {
			this.selectedCategory = null;
		} else {
			this.selectedCategory = category;
		}
	}
}

export const quickPromptState = new QuickPromptState();
