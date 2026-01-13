import { getTasklist } from "$lib/api/taskboard";
import type { Task } from "@shared/types";
import { codeAgentState } from "./code-agent-state.svelte";

export class CodeAgentTaskboardState {
	taskboardStatus = $state<"idle" | "running">("idle");

	tasklist = $derived.by(() => {
		const currentSandboxId = codeAgentState.sandboxId;
		return this.#getTasklist(currentSandboxId);
	});

	async #getTasklist(sandboxId: string): Promise<Task[]> {
		const tasklist = await getTasklist(sandboxId);
		return tasklist;
	}
}

export const codeAgentTaskboardState = new CodeAgentTaskboardState();
