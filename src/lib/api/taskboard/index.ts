import { taskListSchema, type Task } from "@shared/types";
import { type } from "arktype";
import { executeCommand } from "./base-apis";

/**
 *
 * @param sandboxId
 * @param cwd
 * @returns
 */
export async function getTasklist(sandboxId: string): Promise<Task[]> {
	try {
		const response = await executeCommand({
			sandboxId,
			command: "cat .302ai/todo/tasks.json",
		});

		if (!response.success || response.result.exit_code !== 0) {
			// If file doesn't exist or other error, return empty list for now
			return [];
		}

		const tasks = JSON.parse(response.result.stdout);
		const validated = taskListSchema(tasks);
		if (validated instanceof type.errors) {
			console.error("Failed to validate task list:", validated.summary);
			return [];
		}
		return validated;
	} catch (error) {
		console.error("Failed to get task list:", error);
		return [];
	}
}
