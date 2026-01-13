import { generalSettings } from "$lib/stores/general-settings.state.svelte";

const CHANGELOG_API_URL = "https://studio.302.ai/api/changelog";

/**
 * Changelog version entry
 */
export interface ChangelogVersion {
	version: string;
	date: string;
	changes: {
		new?: string[];
		improved?: string[];
		fixed?: string[];
	};
}

/**
 * Changelog API response
 */
export interface ChangelogResponse {
	total: number;
	versions: ChangelogVersion[];
}

/**
 * Options for fetching changelog
 */
export interface FetchChangelogOptions {
	/** Language code: 'en' or 'zh' */
	lang?: "en" | "zh";
	/** Limit the number of versions returned */
	limit?: number;
	/** Only return the latest version */
	latest?: boolean;
	/** Get a specific version */
	version?: string;
}

/**
 * Fetch changelog from the API
 * @param options - Options for the API call
 * @returns Promise resolving to ChangelogResponse
 */
export async function fetchChangelog(options: FetchChangelogOptions = {}): Promise<ChangelogResponse> {
	const url = new URL(CHANGELOG_API_URL);

	// Use current language if not specified
	const lang = options.lang ?? (generalSettings.language as "en" | "zh");
	url.searchParams.set("lang", lang);

	if (options.limit !== undefined) {
		url.searchParams.set("limit", String(options.limit));
	}

	if (options.latest) {
		url.searchParams.set("latest", "true");
	}

	if (options.version) {
		url.searchParams.set("version", options.version);
	}

	const response = await fetch(url.toString(), {
		method: "GET",
		headers: {
			Accept: "application/json",
		},
	});

	if (!response.ok) {
		if (response.status === 404) {
			throw new Error("Changelog not found");
		}
		throw new Error(`Failed to fetch changelog: ${response.status} ${response.statusText}`);
	}

	const data: ChangelogResponse = await response.json();
	return data;
}

/**
 * Fetch the latest changelog version
 * @param lang - Optional language override
 * @returns Promise resolving to the latest ChangelogVersion or null
 */
export async function fetchLatestChangelog(lang?: "en" | "zh"): Promise<ChangelogVersion | null> {
	try {
		const response = await fetchChangelog({ lang, latest: true });
		return response.versions[0] ?? null;
	} catch {
		return null;
	}
}

/**
 * Fetch changelog with a limit
 * @param limit - Number of versions to fetch
 * @param lang - Optional language override
 * @returns Promise resolving to ChangelogResponse
 */
export async function fetchChangelogWithLimit(
	limit: number,
	lang?: "en" | "zh",
): Promise<ChangelogResponse> {
	return fetchChangelog({ lang, limit });
}
