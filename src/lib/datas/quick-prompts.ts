export interface QuickPrompt {
	act: string;
	prompt: string;
	category: QuickPromptCategory;
}

export type QuickPromptCategory =
	| "translation"
	| "programming"
	| "writing"
	| "education"
	| "career"
	| "lifestyle"
	| "roleplay"
	| "tools";

export const QUICK_PROMPT_CATEGORIES: QuickPromptCategory[] = [
	"translation",
	"programming",
	"writing",
	"education",
	"career",
	"lifestyle",
	"roleplay",
	"tools",
];
