import { taskListSchema, type Task } from "@shared/types";
import { type } from "arktype";
import { executeCommand } from "./base-apis";

const TODO_TASKS_FILE_PATH = ".302ai/todo/tasks.json";

/**
 * Get the task list from the sandbox
 * @param sandboxId - The sandbox ID
 * @returns The task list
 */
export async function getTasklist(sandboxId: string): Promise<{ isOk: boolean; tasks: Task[] }> {
	try {
		const response = await executeCommand({
			sandboxId,
			command: `cat ${TODO_TASKS_FILE_PATH}`,
		});

		if (!response.success || response.result.exit_code !== 0) {
			// If file doesn't exist or other error, return empty list for now
			return { isOk: false, tasks: [] };
		}

		const tasks = JSON.parse(response.result.stdout);
		const validated = taskListSchema(tasks);
		if (validated instanceof type.errors) {
			console.error("Failed to validate task list:", validated.summary);
			return { isOk: false, tasks: [] };
		}
		return { isOk: true, tasks: validated };
	} catch (error) {
		console.error("Failed to get task list:", error);
		return { isOk: false, tasks: [] };
	}
}

/**
 * Update the task list in the sandbox
 * @param sandboxId - The sandbox ID
 * @param tasks - The task list to update
 */
export async function updateTasklist(sandboxId: string, tasks: Task[]): Promise<{ isOk: boolean }> {
	try {
		const response = await executeCommand({
			sandboxId,
			command: `echo '${JSON.stringify(tasks)}' > ${TODO_TASKS_FILE_PATH}`,
		});

		if (!response.success || response.result.exit_code !== 0) {
			return { isOk: false };
		}
		return { isOk: true };
	} catch (error) {
		console.error("Failed to update task list:", error);
		return { isOk: false };
	}
}
