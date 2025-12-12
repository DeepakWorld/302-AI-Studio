import {
	createClaudeCodeSandboxResponse,
	type CreateClaudeCodeSandboxRequest,
	type CreateClaudeCodeSandboxResponse,
} from "@shared/storage/code-agent";
import { type } from "arktype";
import ky from "ky";
import { _302AIKy } from "./core/_302ai-ky";

export const sessionInfoSchema = type({
	session_id: "string",
	workspace_path: "string",
	note: "string",
	used_at: "string",
	updated_at: "string",
});
export type SessionInfo = typeof sessionInfoSchema.infer;

/**
 * Create a claude code sandbox
 * @param llm_model - The llm model to use
 * @returns The created claude code sandbox
 */
export async function createClaudeCodeSandbox(
	request: CreateClaudeCodeSandboxRequest,
): Promise<CreateClaudeCodeSandboxResponse> {
	try {
		console.debug("request", request);
		const response = await _302AIKy
			.post("302/claude-code/sandbox/create", {
				json: {
					...request,
					auto_pause_seconds: 30,
				},
			})
			.json();

		console.debug(response);

		const validated = createClaudeCodeSandboxResponse(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate create claude code sandbox:", validated.summary);
			throw new Error("Invalid response format from create claude code sandbox API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to create claude code sandbox:", error);
		throw error;
	}
}

const updateClaudeCodeSandboxResponse = type({
	success: "boolean",
	data: {
		message: "string",
		sandbox_id: "string",
	},
});
export type UpdateClaudeCodeSandboxResponse = typeof updateClaudeCodeSandboxResponse.infer;

/**
 * Update a claude code sandbox
 * @param sandbox_id - The sandbox id to update
 * @param llm_model - The llm model to use
 * @returns The updated claude code sandbox
 */
export async function updateClaudeCodeSandbox(
	sandbox_id: string,
	llm_model?: string,
	sandbox_name?: string,
): Promise<UpdateClaudeCodeSandboxResponse> {
	try {
		const response = await _302AIKy
			.post("302/claude-code/sandbox/reset", {
				json: { sandbox_id, llm_model, sandbox_name, auto_pause_seconds: 30 },
			})
			.json();

		console.debug(response);

		const validated = updateClaudeCodeSandboxResponse(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate update claude code sandbox:", validated.summary);
			throw new Error("Invalid response format from update claude code sandbox API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to update claude code sandbox:", error);
		throw error;
	}
}

const deleteClaudeCodeSandboxResponse = type({
	success: "boolean",
});
export type DeleteClaudeCodeSandboxResponse = typeof deleteClaudeCodeSandboxResponse.infer;

/**
 * Delete a claude code sandbox
 * @param sandbox_id - The sandbox id to delete
 * @returns The response from deleting the claude code sandbox
 */
export async function deleteClaudeCodeSandbox(
	sandbox_id: string,
): Promise<DeleteClaudeCodeSandboxResponse> {
	try {
		const response = await _302AIKy
			.post("302/claude-code/sandbox/delete", {
				json: { sandbox_id },
			})
			.json();

		console.debug(response);

		const validated = deleteClaudeCodeSandboxResponse(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate delete claude code sandbox:", validated.summary);
			throw new Error("Invalid response format from delete claude code sandbox API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to delete claude code sandbox:", error);
		throw error;
	}
}

const sandboxInfoSchema = type({
	sandbox_id: "string",
	sandbox_name: "string",
	status: "'killed' | 'running' | 'paused'",
	llm_model: "string",
	created_at: "string",
	updated_at: "string",
	deleted_at: "string",
	max_thinking_token: "number",
	disk_used: "number",
	disk_total: "number",
	session_num: "number",
	session_list: sessionInfoSchema.array(),
});
export type SandboxInfo = typeof sandboxInfoSchema.infer;
export const listClaudeCodeSandboxesResponse = type({
	success: "boolean",
	pagination: {
		current_page: "number",
		page_size: "number",
		total_items: "number",
		total_pages: "number",
	},
	list: sandboxInfoSchema.array(),
});
export type ListClaudeCodeSandboxesResponse = typeof listClaudeCodeSandboxesResponse.infer;

/**
 * List all claude code sandboxes
 * @returns The list of claude code sandboxes
 */
export async function listClaudeCodeSandboxes(
	apiKey?: string,
): Promise<ListClaudeCodeSandboxesResponse> {
	try {
		const response =
			apiKey && apiKey.trim() !== ""
				? await ky
						.get("https://api.302.ai/302/claude-code/sandbox/list", {
							headers: {
								Authorization: `Bearer ${apiKey}`,
							},
						})
						.json()
				: await _302AIKy.get("302/claude-code/sandbox/list").json();

		const validated = listClaudeCodeSandboxesResponse(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate list claude code sandboxes:", validated.summary);
			throw new Error("Invalid response format from list claude code sandboxes API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to list claude code sandboxes:", error);
		throw error;
	}
}

export const listClaudeCodeSessionsResponse = type({
	success: "boolean",
	sandbox_id: "string",
	session_list: sessionInfoSchema.array(),
});
export type ListClaudeCodeSessionsResponse = typeof listClaudeCodeSessionsResponse.infer;

/**
 * List all claude code sessions
 * @param sandbox_id - The sandbox id to list sessions for
 * @returns The list of claude code sessions
 */
export async function listClaudeCodeSessions(
	sandbox_id: string,
): Promise<ListClaudeCodeSessionsResponse> {
	try {
		const response = await _302AIKy
			.get(`302/claude-code/sandbox/session?sandbox_id=${sandbox_id}`)
			.json();

		const validated = listClaudeCodeSessionsResponse(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate list claude code sessions:", validated.summary);
			throw new Error("Invalid response format from list claude code sessions API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to list claude code sessions:", error);
		throw error;
	}
}
