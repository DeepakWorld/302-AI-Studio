/**
 * State management for sidebar search functionality
 */
class SidebarSearchState {
	private focusTriggerCallbacks: Array<() => void> = [];
	private hasInitialized = false;

	// Local search state for this tab
	#localSearchQuery = $state("");

	// Cached search result IDs (set from outside when search completes)
	#cachedSearchResultIds: string[] = [];

	// Initial search result IDs from tab creation
	#initialSearchResultIds: string[] | null = null;

	/**
	 * Initialize search state for this tab
	 * Reads initial search query and results from window.tab if available
	 */
	initializeForTab(): void {
		if (this.hasInitialized) return;
		this.hasInitialized = true;

		const tab = window.tab as {
			initialSearchQuery?: string;
			initialSearchResultIds?: string[];
		};

		// Check if tab has initial search query
		if (tab?.initialSearchQuery) {
			this.#localSearchQuery = tab.initialSearchQuery;
			console.log("[SidebarSearch] Initialized with search query:", tab.initialSearchQuery);
		}

		// Check if tab has initial search results
		if (tab?.initialSearchResultIds?.length) {
			this.#initialSearchResultIds = tab.initialSearchResultIds;
			this.#cachedSearchResultIds = tab.initialSearchResultIds;
			console.log(
				"[SidebarSearch] Initialized with search results:",
				tab.initialSearchResultIds.length,
				"items",
			);
		}
	}

	/**
	 * Get initial search result IDs (only available on first render)
	 */
	getInitialSearchResultIds(): string[] | null {
		const result = this.#initialSearchResultIds;
		// Clear after first access to prevent stale data
		this.#initialSearchResultIds = null;
		return result;
	}

	/**
	 * Update cached search result IDs when search completes
	 */
	setCachedSearchResultIds(ids: string[]): void {
		this.#cachedSearchResultIds = ids;
	}

	/**
	 * Get the current search query and result IDs to pass when creating a new tab
	 */
	getSearchDataForNewTab(): { query: string; resultIds: string[] } | undefined {
		const query = this.#localSearchQuery.trim();
		if (!query) return undefined;
		return {
			query,
			resultIds: this.#cachedSearchResultIds,
		};
	}

	/**
	 * Search query state - local to this tab
	 */
	get searchQuery(): string {
		return this.#localSearchQuery;
	}

	set searchQuery(value: string) {
		this.#localSearchQuery = value;
		// Clear cached results when query changes
		if (!value.trim()) {
			this.#cachedSearchResultIds = [];
		}
	}

	/**
	 * Register a callback to be called when search should be focused
	 */
	registerFocusCallback(callback: () => void): () => void {
		this.focusTriggerCallbacks.push(callback);

		// Return cleanup function
		return () => {
			const index = this.focusTriggerCallbacks.indexOf(callback);
			if (index > -1) {
				this.focusTriggerCallbacks.splice(index, 1);
			}
		};
	}

	/**
	 * Trigger focus on the search input
	 */
	triggerFocus(): void {
		this.focusTriggerCallbacks.forEach((callback) => callback());
	}

	/**
	 * Clear the search query
	 */
	clearSearch(): void {
		this.#localSearchQuery = "";
		this.#cachedSearchResultIds = [];
	}
}

export const sidebarSearchState = new SidebarSearchState();
