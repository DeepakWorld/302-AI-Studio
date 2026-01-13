import { getTasklist, updateTasklist } from "$lib/api/taskboard";
import { m } from "$lib/paraglide/messages";
import type { Task } from "@shared/types";
import { toast } from "svelte-sonner";
import { match } from "ts-pattern";
import { codeAgentState } from "./code-agent-state.svelte";
import { withLoadingState } from "./utils";

export class CodeAgentTaskboardState {
	isTaskboardRunning = $state(false);
	isLoading = $state(false);
	tasklist = $state<Task[]>([]);

	inProgressTask = $derived.by<Task | null>(() => {
		return this.tasklist.find((task) => task.status === "in_progress") ?? null;
	});

	#isInitialized = $derived(
		codeAgentState.enabled && codeAgentState.isFreshTab && codeAgentState.sandboxId === "",
	);

	toggleTaskboardRunningStatus() {
		this.isTaskboardRunning = !this.isTaskboardRunning;
	}

	/**
	 * Synchronizes the tasklist with the backend.
	 * If the taskboard is not initialized, it will fetch the tasklist from the backend.
	 * Otherwise, it will use an empty array.
	 */
	async syncTasklist(): Promise<void> {
		await withLoadingState(
			(loading) => (this.isLoading = loading),
			async () => {
				await match(this.#isInitialized)
					.with(true, () => (this.tasklist = []))
					.otherwise(async () => {
						const tasklist = await getTasklist(codeAgentState.sandboxId);
						this.tasklist = tasklist.tasks;
					});
			},
		);
	}

	/**
	 * Updates the tasklist in the backend.
	 * If the taskboard is not initialized, it will update the tasklist in the backend.
	 * Otherwise, it will use the provided tasklist.
	 */
	async updateTasklist(tasklist: Task[]): Promise<void> {
		match(this.#isInitialized)
			.with(true, () => {
				this.tasklist = tasklist;
			})
			.otherwise(async () => {
				this.tasklist = tasklist;
				const result = await updateTasklist(codeAgentState.sandboxId, tasklist);
				if (!result.isOk) {
					const { isOk, tasks } = await getTasklist(codeAgentState.sandboxId);
					this.tasklist = isOk ? tasks : [];

					toast.error(m.taskboard_update_failed());
				}
			});
	}
}

export const codeAgentTaskboardState = new CodeAgentTaskboardState();
