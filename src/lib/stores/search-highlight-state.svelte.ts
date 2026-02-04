/**
 * State management for search keyword highlighting in chat messages
 * Used when navigating to a thread from sidebar search results
 */
class SearchHighlightState {
	private hasInitialized = false;

	// Current search keyword for highlighting
	#searchKeyword = $state<string>("");

	// Whether initial scroll has been performed
	#hasScrolled = $state(false);

	/**
	 * Initialize from window.tab if available
	 * Reads the initialSearchQuery passed when creating a tab from search results
	 */
	initializeForTab(): void {
		if (this.hasInitialized) return;
		this.hasInitialized = true;

		const tab = window.tab as { initialSearchQuery?: string };
		if (tab?.initialSearchQuery) {
			this.#searchKeyword = tab.initialSearchQuery.trim();
			console.log("[SearchHighlight] Initialized with keyword:", this.#searchKeyword);
		}
	}

	/**
	 * Get the current search keyword
	 */
	get searchKeyword(): string {
		return this.#searchKeyword;
	}

	/**
	 * Check if initial scroll has been performed
	 */
	get hasScrolled(): boolean {
		return this.#hasScrolled;
	}

	/**
	 * Mark that scrolling has been completed
	 */
	markScrolled(): void {
		this.#hasScrolled = true;
	}

	/**
	 * Clear the search highlighting state
	 */
	clearSearch(): void {
		this.#searchKeyword = "";
		this.#hasScrolled = false;
	}

	/**
	 * Reset the initialization flag (for testing or re-navigation)
	 */
	reset(): void {
		this.hasInitialized = false;
		this.#searchKeyword = "";
		this.#hasScrolled = false;
	}
}

export const searchHighlightState = new SearchHighlightState();
