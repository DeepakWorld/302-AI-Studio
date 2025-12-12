/**
 * Format a date/time string for display
 * @param dateStr - ISO date string or timestamp
 * @param options - Formatting options
 * @returns Formatted date string or empty string if invalid
 */
export function formatDateTime(
	dateStr?: string | number,
	options: {
		includeYear?: boolean;
		locale?: string;
	} = {},
): string {
	if (!dateStr) return "";

	const { includeYear = false, locale = "zh-CN" } = options;

	try {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return "";

		return date.toLocaleString(locale, {
			...(includeYear && { year: "numeric" }),
			month: "numeric",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "";
	}
}

/**
 * Format a date/time string with full year
 */
export function formatDateTimeFull(dateStr?: string | number, locale = "zh-CN"): string {
	return formatDateTime(dateStr, { includeYear: true, locale });
}

/**
 * Format a date/time string without year (short format)
 */
export function formatDateTimeShort(dateStr?: string | number, locale = "zh-CN"): string {
	return formatDateTime(dateStr, { includeYear: false, locale });
}
