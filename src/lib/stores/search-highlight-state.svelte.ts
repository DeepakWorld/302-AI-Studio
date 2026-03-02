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

	// Search options
	#caseSensitive = $state(false);
	#wholeWord = $state(false);
	#regex = $state(false);

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
	 * Mark scrolling state
	 * @param value - true to mark as scrolled, false to reset
	 */
	markScrolled(value: boolean = true): void {
		this.#hasScrolled = value;
	}

	/**
	 * Get case sensitive option
	 */
	get caseSensitive(): boolean {
		return this.#caseSensitive;
	}

	/**
	 * Set case sensitive option
	 */
	setCaseSensitive(value: boolean): void {
		this.#caseSensitive = value;
	}

	/**
	 * Get whole word option
	 */
	get wholeWord(): boolean {
		return this.#wholeWord;
	}

	/**
	 * Set whole word option
	 */
	setWholeWord(value: boolean): void {
		this.#wholeWord = value;
	}

	/**
	 * Get regex option
	 */
	get regex(): boolean {
		return this.#regex;
	}

	/**
	 * Set regex option
	 */
	setRegex(value: boolean): void {
		this.#regex = value;
	}

	/**
	 * Clear the search highlighting state
	 */
	clearSearch(): void {
		this.#searchKeyword = "";
		this.#hasScrolled = false;
		this.#caseSensitive = false;
		this.#wholeWord = false;
		this.#regex = false;
	}

	applySearchKeyword(keyword: string): void {
		const trimmed = keyword.trim();
		if (!trimmed) {
			this.clearSearch();
			return;
		}
		this.#searchKeyword = trimmed;
		this.#hasScrolled = false;
	}

	/**
	 * Reset the initialization flag (for testing or re-navigation)
	 */
	reset(): void {
		this.hasInitialized = false;
		this.#searchKeyword = "";
		this.#hasScrolled = false;
		this.#caseSensitive = false;
		this.#wholeWord = false;
		this.#regex = false;
	}
}

export const searchHighlightState = new SearchHighlightState();
