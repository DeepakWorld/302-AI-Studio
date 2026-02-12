export interface TabUsageMetrics {
	tabId: string;
	lastAccessTime: number;
	isBusy: boolean;
	isActive: boolean;
}

export class LRUTabManager {
	/**
	 * Calculate which tabs should be evicted (slept) based on LRU policy.
	 * @param metrics Metrics for all currently active tabs (those with views)
	 * @param maxBackgroundTabs Maximum number of background tabs to keep alive
	 * @returns List of tabIds that should be put to sleep
	 */
	static calculateEvictions(metrics: TabUsageMetrics[], maxBackgroundTabs: number): string[] {
		// 1. Filter out tabs that CANNOT be slept (active or busy)
		const evictableCandidates = metrics.filter((m) => !m.isActive && !m.isBusy);

		// 2. Check if we are within quota
		if (evictableCandidates.length <= maxBackgroundTabs) {
			return [];
		}

		// 3. Sort by last access time (ascending -> oldest first)
		evictableCandidates.sort((a, b) => a.lastAccessTime - b.lastAccessTime);

		// 4. Determine how many to evict
		const evictionCount = evictableCandidates.length - maxBackgroundTabs;

		// 5. Return the oldest N tabs
		return evictableCandidates.slice(0, evictionCount).map((m) => m.tabId);
	}
}
