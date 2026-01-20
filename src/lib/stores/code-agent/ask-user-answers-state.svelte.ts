import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { SvelteMap, SvelteSet } from "svelte/reactivity";

/**
 * Represents the user's answer to a question in the ask-user-question-card
 */
export interface UserQuestionAnswer {
	/** Selected options per question index - stored as arrays since Sets can't be serialized */
	selectedOptions: Record<number, string[]>;
	/** Custom text inputs per question index */
	customInputs: Record<number, string>;
	/** Whether the custom input was shown for each question index */
	showCustomInput: Record<number, boolean>;
	/** Timestamp when the answer was submitted */
	submittedAt: string;
}

/**
 * Storage structure for all ask-user answers in a thread
 * Key: messageId, Value: UserQuestionAnswer
 */
export type AskUserAnswersStorage = Record<string, UserQuestionAnswer>;

// Get threadId from window.tab, fallback to "default" if not available
const tab = window?.tab ?? null;
const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "default";

/**
 * Persisted state for storing user answers to ask-user-question-card components.
 * Uses messageId as the key to associate answers with specific messages.
 */
export const askUserAnswersState = new PersistedState<AskUserAnswersStorage>(
	`plan-answers:${threadId}`,
	{},
);

/**
 * Check if the state has been hydrated from storage
 */
export function isAnswersHydrated(): boolean {
	return askUserAnswersState.isHydrated;
}

/**
 * Get the answer for a specific message
 */
export function getAnswerForMessage(messageId: string): UserQuestionAnswer | undefined {
	return askUserAnswersState.current[messageId];
}

/**
 * Save the answer for a specific message
 */
export function saveAnswerForMessage(
	messageId: string,
	selectedOptions: SvelteMap<number, SvelteSet<string>>,
	customInputs: SvelteMap<number, string>,
	showCustomInput: SvelteMap<number, boolean>,
): void {
	// Convert SvelteMaps and SvelteSets to serializable objects
	const answer: UserQuestionAnswer = {
		selectedOptions: Object.fromEntries(
			Array.from(selectedOptions.entries()).map(([k, v]) => [k, Array.from(v)]),
		),
		customInputs: Object.fromEntries(customInputs.entries()),
		showCustomInput: Object.fromEntries(showCustomInput.entries()),
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state, just creating a timestamp string
		submittedAt: new Date().toISOString(),
	};

	askUserAnswersState.current = {
		...askUserAnswersState.current,
		[messageId]: answer,
	};
}

/**
 * Restore SvelteMap<number, SvelteSet<string>> from the serialized format
 */
export function restoreSelectedOptions(
	stored: Record<number, string[]>,
): SvelteMap<number, SvelteSet<string>> {
	const map = new SvelteMap<number, SvelteSet<string>>();
	for (const [key, value] of Object.entries(stored)) {
		map.set(Number(key), new SvelteSet(value));
	}
	return map;
}

/**
 * Restore SvelteMap<number, string> from the serialized format
 */
export function restoreCustomInputs(stored: Record<number, string>): SvelteMap<number, string> {
	const map = new SvelteMap<number, string>();
	for (const [key, value] of Object.entries(stored)) {
		map.set(Number(key), value);
	}
	return map;
}

/**
 * Restore SvelteMap<number, boolean> from the serialized format
 */
export function restoreShowCustomInput(
	stored: Record<number, boolean>,
): SvelteMap<number, boolean> {
	const map = new SvelteMap<number, boolean>();
	for (const [key, value] of Object.entries(stored)) {
		map.set(Number(key), value);
	}
	return map;
}
