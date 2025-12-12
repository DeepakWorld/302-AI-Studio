/**
 * Simple hash function for API key tracking
 * Uses a fast, non-cryptographic hash for internal comparison only
 */
export function simpleHash(str: string): string {
	let hash = 0;
	if (str.length === 0) return hash.toString(16);

	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}

	// Convert to hex string and ensure positive
	return (hash >>> 0).toString(16);
}

/**
 * Generate a hash for an API key
 * Used to track which sessions were created with which API key
 */
export function hashApiKey(apiKey: string | null | undefined): string | undefined {
	if (!apiKey) return undefined;
	return simpleHash(apiKey);
}
