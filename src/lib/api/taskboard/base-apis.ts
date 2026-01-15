import { withRetry } from "$lib/utils/retry";
import { type } from "arktype";
import { _302AIKy } from "../core/_302ai-ky";

export const executeCommandRequestSchema = type({
	sandboxId: "string",
	command: "string",
	cwd: "string",
});
export type ExecuteCommandRequest = typeof executeCommandRequestSchema.infer;
export const executeCommandResponseSchema = type({
	success: "boolean",
	result: {
		exit_code: "number",
		stdout: "string",
		stderr: "string",
		error: "string",
	},
});
export type ExecuteCommandResponse = typeof executeCommandResponseSchema.infer;

/**
 * Executes a command in the specified sandbox.
 * @param request The command execution request.
 * @param maxRetries Maximum number of retries on failure (default: 3).
 * @returns The command execution response.
 */
export async function executeCommand(
	request: ExecuteCommandRequest,
): Promise<ExecuteCommandResponse> {
	return withRetry(
		async () => {
			const response = await _302AIKy
				.post("302/claude-code/commands", {
					json: {
						sandbox_id: request.sandboxId,
						command: request.command,
					},
				})
				.json();

			const validated = executeCommandResponseSchema(response);
			if (validated instanceof type.errors) {
				console.error("Failed to validate execute command response:", validated.summary);
				throw new Error("Invalid response format from execute command API");
			}
			return validated;
		},
		3,
		1000,
		10000,
	);
}

export const sandboxFileOperationResponseSchema = type({
	success: "boolean",
	file: {
		name: "string",
		type: "string",
		path: "string",
		size: "number",
	},
});
export type SandboxFileOperationResponse = typeof sandboxFileOperationResponseSchema.infer;

/**
 * Uploads a file to the specified sandbox.
 * @param sandboxId The ID of the sandbox to upload the file to.
 * @param path The path where the file should be uploaded.
 * @param file The file to upload.
 * @param auto_unzip Whether to automatically unzip the file after upload.
 * @returns The file operation response.
 */
export async function uploadFileToSandbox(
	sandboxId: string,
	path: string,
	file: File,
	auto_unzip: boolean = false,
): Promise<SandboxFileOperationResponse> {
	try {
		const formData = new FormData();
		formData.append("sandbox_id", sandboxId);
		formData.append("path", path);
		formData.append("file", file);
		if (auto_unzip) {
			formData.append("auto_unzip", "true");
		}

		const response = await _302AIKy
			.post("302/claude-code/sandbox/file/upload", {
				body: formData,
			})
			.json();

		const validated = sandboxFileOperationResponseSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate upload file response:", validated.summary);
			throw new Error("Invalid response format from upload file API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to upload file:", error);
		throw error;
	}
}

export const initProjectRequestSchema = type({
	sandboxId: "string",
	sessionId: "string",
	workspacePath: "string?",
});
export type InitProjectRequest = typeof initProjectRequestSchema.infer;
export const initProjectResponseSchema = type({
	success: "boolean",
	workspace_path: "string",
	session_id: "string",
	message: "string",
});
export type InitProjectResponse = typeof initProjectResponseSchema.infer;

export async function initProject(request: InitProjectRequest): Promise<InitProjectResponse> {
	try {
		const response = await _302AIKy
			.post("302/claude-code/sandbox/project/init", {
				json: {
					sandbox_id: request.sandboxId,
					session_id: request.sessionId,
					workspace_path: request.workspacePath ?? "",
				},
			})
			.json();

		const validated = initProjectResponseSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate init project response:", validated.summary);
			throw new Error("Invalid response format from init project API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to init project:", error);
		throw error;
	}
}

// Batch Upload File API
export const batchUploadFileRequestSchema = type({
	sandbox_id: "string",
	file_list: type({
		content: "string",
		save_path: "string",
	}).array(),
});
export type BatchUploadFileRequest = typeof batchUploadFileRequestSchema.infer;

export const batchUploadFileResponseSchema = type({
	success: "boolean",
	error: type({
		message: "string",
	}).optional(),
});
export type BatchUploadFileResponse = typeof batchUploadFileResponseSchema.infer;

/**
 * Batch uploads files to the specified sandbox.
 * @param request The batch upload request containing sandbox_id and file_list.
 * @param maxRetries Maximum number of retries on failure (default: 3).
 * @returns The batch upload response.
 */
export async function batchUploadFile(
	request: BatchUploadFileRequest,
	maxRetries: number = 3,
): Promise<BatchUploadFileResponse> {
	return withRetry(
		async () => {
			const response = await _302AIKy
				.post("302/claude-code/sandbox/file/upload/batch", {
					json: request,
					timeout: 300000,
				})
				.json();

			const validated = batchUploadFileResponseSchema(response);
			if (validated instanceof type.errors) {
				console.error("Failed to validate batch upload file response:", validated.summary);
				throw new Error("Invalid response format from batch upload file API");
			}
			return validated;
		},
		maxRetries,
		1000,
		10000,
	);
}
