import { getTasklist, updateTasklist } from "$lib/api/taskboard";
import type { Task } from "@shared/types";
import { match } from "ts-pattern";
import { codeAgentState } from "./code-agent-state.svelte";
import { withLoadingState } from "./utils";

export class CodeAgentTaskboardState {
	taskboardStatus = $state<"idle" | "running">("idle");
	isLoading = $state(false);
	isUpdating = $state(false);

	#initialTasklist = $state<Task[]>([]);

	#isInitialized = $derived.by(() => codeAgentState.enabled && codeAgentState.isFreshTab);

	async getTasklist(): Promise<Task[]> {
		return await withLoadingState(
			(loading) => (this.isLoading = loading),
			async () => {
				return match(this.#isInitialized)
					.with(true, () => this.#initialTasklist)
					.otherwise(async () => {
						const tasklist = await getTasklist(codeAgentState.sandboxId);
						return tasklist.tasks;
					});
			},
		);
	}

	async updateTasklist(tasklist: Task[]): Promise<void> {
		await withLoadingState(
			(loading) => (this.isUpdating = loading),
			() =>
				match(this.#isInitialized)
					.with(true, () => {
						this.#initialTasklist = tasklist;
					})
					.otherwise(async () => {
						await updateTasklist(codeAgentState.sandboxId, tasklist);
					}),
		);
	}
}

export const codeAgentTaskboardState = new CodeAgentTaskboardState();
