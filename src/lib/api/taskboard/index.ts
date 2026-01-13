import { taskListSchema, type Task } from "@shared/types";
import { type } from "arktype";
import { executeCommand } from "./base-apis";

const TODO_TASKS_FILE_PATH = ".302ai/todo/tasks.json";

/**
 * Validate and repair the task list.
 * If the content is invalid (not JSON or not matching schema), it will be overwritten with an empty array.
 * @param sandboxId - The sandbox ID
 * @param content - The raw JSON string content
 * @returns The validated task list or an empty array if repair was needed
 */
async function validateAndRepairTaskList(sandboxId: string, content: string): Promise<Task[]> {
	try {
		const parsed = JSON.parse(content);
		const validated = taskListSchema(parsed);

		if (validated instanceof type.errors) {
			console.warn(
				"Task list schema validation failed, resetting to empty list:",
				validated.summary,
			);
			await updateTasklist(sandboxId, []);
			return [];
		}

		return validated;
	} catch (error) {
		console.warn("Task list JSON parse failed, resetting to empty list:", error);
		await updateTasklist(sandboxId, []);
		return [];
	}
}

/**
 * Get the task list from the sandbox
 * @param sandboxId - The sandbox ID
 * @returns The task list
 */
export async function getTasklist(sandboxId: string): Promise<{ isOk: boolean; tasks: Task[] }> {
	try {
		const dir = TODO_TASKS_FILE_PATH.substring(0, TODO_TASKS_FILE_PATH.lastIndexOf("/"));
		const response = await executeCommand({
			sandboxId,
			command: `mkdir -p ${dir} && if [ ! -f ${TODO_TASKS_FILE_PATH} ]; then echo '[]' > ${TODO_TASKS_FILE_PATH}; fi && cat ${TODO_TASKS_FILE_PATH}`,
		});

		if (!response.success || response.result.exit_code !== 0) {
			// If file doesn't exist or other error, return empty list for now
			return { isOk: false, tasks: [] };
		}

		const tasks = await validateAndRepairTaskList(sandboxId, response.result.stdout);
		return { isOk: true, tasks };
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
		const dir = TODO_TASKS_FILE_PATH.substring(0, TODO_TASKS_FILE_PATH.lastIndexOf("/"));
		const content = JSON.stringify(tasks).replace(/'/g, "'\\''");
		const response = await executeCommand({
			sandboxId,
			command: `mkdir -p ${dir} && echo '${content}' > ${TODO_TASKS_FILE_PATH}`,
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
