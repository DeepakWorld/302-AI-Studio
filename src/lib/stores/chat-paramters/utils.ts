import type { Locale as ParaglideLocale } from "$lib/paraglide/runtime";
import type { ChatVariable } from "@shared/storage/chat-parameters";
import { format } from "date-fns";
import { enUS, zhCN, type Locale } from "date-fns/locale";

/**
 * Locale map for date-fns
 */
const localeMap: Record<ParaglideLocale, Locale> = {
	en: enUS,
	zh: zhCN,
};

/**
 * Variable resolution context
 */
export interface PromptResolveContext {
	/** User's original input message (optional, not used for system prompts) */
	input?: string;
	/** Model ID */
	modelId: string;
	/** Language/locale for date formatting */
	language?: ParaglideLocale;
	/** Cached variable values from systemPromptMap */
	cachedMap?: Record<string, string>;
	/** Variables used in the prompt (from systemPromptVariables) */
	variables?: ChatVariable[];
}

/**
 * Result of resolving a prompt
 */
export interface PromptResolveResult {
	/** The resolved prompt content */
	content: string;
	/** Updated variable map with newly computed values (to be cached) */
	updatedMap: Record<string, string>;
}

/**
 * Format date to locale string (date only)
 * Format: yyyy-MM-dd (e.g., 2024-12-16)
 */
function formatDate(date: Date, locale: Locale): string {
	return format(date, "yyyy-MM-dd", { locale });
}

/**
 * Format date to locale string (time only)
 * Format: HH:mm:ss (e.g., 14:30:25)
 */
function formatTime(date: Date, locale: Locale): string {
	return format(date, "HH:mm:ss", { locale });
}

/**
 * Format date to locale string (date and time)
 * Format: yyyy-MM-dd HH:mm:ss (e.g., 2024-12-16 14:30:25)
 */
function formatDatetime(date: Date, locale: Locale): string {
	return format(date, "yyyy-MM-dd HH:mm:ss", { locale });
}

/**
 * Variables that should always be recalculated (not cached)
 */
const ALWAYS_FRESH_VARIABLES: ChatVariable[] = ["now", "model_id"];

/**
 * Build variable map from context with caching optimization
 *
 * For performance optimization:
 * - Variables in `cachedMap` are reused (except for `now`)
 * - Only variables in `variables` array are computed
 * - `now` is always recalculated fresh
 *
 * @param context - The context containing values for variable resolution
 * @returns Object with variable map and updated values to cache
 */
function buildVariableMap(context: PromptResolveContext): {
	map: Record<string, string>;
	updatedMap: Record<string, string>;
} {
	const now = new Date();
	const locale = localeMap[context.language ?? "zh"];
	const cachedMap = context.cachedMap ?? {};
	const variables = context.variables ?? [];

	const map: Record<string, string> = {};
	const updatedMap: Record<string, string> = {};

	// Helper to compute a variable value
	const computeValue = (varName: ChatVariable): string => {
		switch (varName) {
			case "input":
				return context.input ?? "";
			case "date":
				return formatDate(now, locale);
			case "time":
				return formatTime(now, locale);
			case "datetime":
				return formatDatetime(now, locale);
			case "now":
				return formatDatetime(now, locale);
			case "model_id":
				return context.modelId;
			default:
				return "";
		}
	};

	// Only process variables that are actually used
	for (const varName of variables) {
		// `now` is always fresh
		if (ALWAYS_FRESH_VARIABLES.includes(varName)) {
			map[varName] = computeValue(varName);
			continue;
		}

		// Use cached value if available
		if (varName in cachedMap && cachedMap[varName]) {
			map[varName] = cachedMap[varName];
		} else {
			// Compute and mark for caching
			const value = computeValue(varName);
			map[varName] = value;
			updatedMap[varName] = value;
		}
	}

	return { map, updatedMap };
}

/**
 * Resolve variables in prompt content with caching optimization
 *
 * Supported variables:
 * - {{#input#}} - User's original input message
 * - {{#date#}} - Current date (yyyy-MM-dd) - cached after first use
 * - {{#time#}} - Current time (HH:mm:ss) - cached after first use
 * - {{#datetime#}} - Current date and time - cached after first use
 * - {{#now#}} - Current date and time (always fresh, updates every request)
 * - {{#model_id#}} - Model ID (always fresh, updates every request)
 *
 * @param content - The prompt content with variable placeholders
 * @param context - The context containing values for variable resolution
 * @returns Object with resolved content and updated map for caching
 */
export function resolvePrompt(content: string, context: PromptResolveContext): PromptResolveResult {
	if (!content) {
		return { content: "", updatedMap: {} };
	}

	const { map, updatedMap } = buildVariableMap(context);

	// Replace {{#variable#}} patterns
	const resolvedContent = content.replace(/\{\{#([^#}]+)#\}\}/g, (match, varName: string) => {
		const value = map[varName];
		// Return original match if variable is not recognized or not in map
		return value !== undefined ? value : match;
	});

	return { content: resolvedContent, updatedMap };
}
