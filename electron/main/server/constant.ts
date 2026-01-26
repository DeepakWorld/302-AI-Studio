import type { ThinkingBudgetType } from "@shared/types";

export const THINKING_BUDGET_MAP: Record<ThinkingBudgetType, number> = {
	off: 0,
	low: 2000,
	medium: 4000,
	high: 8000,
	max: 16000,
};
