import { taskListSchema, type Task } from "@shared/types";
import { type } from "arktype";
import { batchUploadFile, executeCommand } from "./base-apis";

const TODO_TASKS_FILE_PATH = ".302ai/todo/tasks.json";
const ATTACHMENTS_DIR_PATH = ".302ai/attachments";

/**
 * Validate and repair the task list.
 * If the content is invalid (not JSON or not matching schema), it will be overwritten with an empty array.
 * @param sandboxId - The sandbox ID
 * @param cwd - The project root directory
 * @param content - The raw JSON string content
 * @returns The validated task list or an empty array if repair was needed
 */
async function validateAndRepairTaskList(
	sandboxId: string,
	cwd: string,
	content: string,
): Promise<Task[]> {
	try {
		const parsed = JSON.parse(content);
		const validated = taskListSchema(parsed);

		if (validated instanceof type.errors) {
			console.warn(
				"Task list schema validation failed, resetting to empty list:",
				validated.summary,
			);
			await updateTasklist(sandboxId, cwd, []);
			return [];
		}

		// Remove duplicate tasks by id (keep first occurrence)
		const seenIds = new Set<string>();
		const uniqueTasks = validated.filter((task) => {
			if (seenIds.has(task.id)) {
				return false;
			}
			seenIds.add(task.id);
			return true;
		});

		// If duplicates were found, update the file
		if (uniqueTasks.length !== validated.length) {
			console.warn(
				`Found ${validated.length - uniqueTasks.length} duplicate task(s), removing duplicates`,
			);
			await updateTasklist(sandboxId, cwd, uniqueTasks);
		}

		return uniqueTasks;
	} catch (error) {
		console.warn("Task list JSON parse failed, resetting to empty list:", error);
		await updateTasklist(sandboxId, cwd, []);
		return [];
	}
}

/**
 * Get the task list from the sandbox
 * @param sandboxId - The sandbox ID
 * @param cwd - The project root directory
 * @returns The task list
 */
export async function getTasklist(
	sandboxId: string,
	cwd: string,
): Promise<{ isOk: boolean; tasks: Task[] }> {
	try {
		const tasksFilePath = `${cwd}/${TODO_TASKS_FILE_PATH}`;
		const dir = tasksFilePath.substring(0, tasksFilePath.lastIndexOf("/"));
		const response = await executeCommand({
			sandboxId,
			cwd,
			command: `mkdir -p ${dir} && if [ ! -f ${tasksFilePath} ]; then echo '[]' > ${tasksFilePath}; fi && cat ${tasksFilePath}`,
		});

		if (!response.success || response.result.exit_code !== 0) {
			// If file doesn't exist or other error, return empty list for now
			return { isOk: false, tasks: [] };
		}

		const tasks = await validateAndRepairTaskList(sandboxId, cwd, response.result.stdout);
		return { isOk: true, tasks };
	} catch (error) {
		console.error("Failed to get task list:", error);
		return { isOk: false, tasks: [] };
	}
}

/**
 * Update the task list in the sandbox
 * @param sandboxId - The sandbox ID
 * @param cwd - The project root directory
 * @param tasks - The task list to update
 */
export async function updateTasklist(
	sandboxId: string,
	cwd: string,
	tasks: Task[],
): Promise<{ isOk: boolean }> {
	try {
		const tasksFilePath = `${cwd}/${TODO_TASKS_FILE_PATH}`;
		const dir = tasksFilePath.substring(0, tasksFilePath.lastIndexOf("/"));
		const content = JSON.stringify(tasks).replace(/'/g, "'\\''");
		const response = await executeCommand({
			sandboxId,
			cwd,
			command: `mkdir -p ${dir} && echo '${content}' > ${tasksFilePath}`,
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

export interface Attachment {
	filename: string;
	content: string;
}

/**
 * Upload attachments to the sandbox
 * @param sandboxId - The sandbox ID
 * @param cwd - The project root directory
 * @param attachments - The attachments to upload
 * @returns Whether the upload was successful
 */
export async function uploadAttachments(
	sandboxId: string,
	cwd: string,
	attachments: Attachment[],
): Promise<{ isOk: boolean }> {
	if (attachments.length === 0) {
		return { isOk: true };
	}

	try {
		const fileList = attachments.map((attachment) => ({
			content: attachment.content,
			save_path: `${cwd}/${ATTACHMENTS_DIR_PATH}/${attachment.filename}`,
		}));

		const response = await batchUploadFile({
			sandbox_id: sandboxId,
			file_list: fileList,
		});

		if (!response.success) {
			console.error("Failed to upload attachments:", response.error?.message);
			return { isOk: false };
		}

		return { isOk: true };
	} catch (error) {
		console.error("Failed to upload attachments:", error);
		return { isOk: false };
	}
}
