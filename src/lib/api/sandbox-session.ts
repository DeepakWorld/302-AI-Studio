/**
 * Sandbox Session API Client
 * 302.AI 沙盒会话 API
 */

import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
import {
	listLocalClaudeCodeSessionsResponse,
	type ListLocalClaudeCodeSessionsResponse,
} from "@shared/types";
import { type } from "arktype";
import { getCodeAgentKy } from "./utils";

export interface UpdateSessionNoteRequest {
	/**
	 * 备注
	 */
	note: string;
	/**
	 * 沙盒id
	 */
	sandbox_id: string;
	/**
	 * 对话id
	 */
	session_id: string;
}

export const updateSessionNoteRequestSchema = type({
	note: "string",
	sandbox_id: "string",
	session_id: "string",
});
export type _UpdateSessionNoteRequest = typeof updateSessionNoteRequestSchema.infer;

export const updateSessionNoteResponseSchema = type({
	message: "string",
	note: "string",
	sandbox_id: "string",
	session_id: "string",
	success: "boolean",
});
export type _UpdateSessionNoteResponse = typeof updateSessionNoteResponseSchema.infer;

/**
 * Add or modify conversation note (New implementation)
 * 添加/修改对话备注
 */
export async function _updateSessionNote(
	request: _UpdateSessionNoteRequest,
): Promise<_UpdateSessionNoteResponse> {
	try {
		const kyInstance = await getCodeAgentKy();

		// Local mode doesn't need sandbox_id
		const requestBody =
			codeAgentState.type === "local"
				? {
						note: request.note,
						session_id: request.session_id,
					}
				: request;

		const response = await kyInstance
			.post("302/claude-code/sandbox/session", {
				json: requestBody,
			})
			.json();

		const validated = updateSessionNoteResponseSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate update session note response:", validated.summary);
			throw new Error("Invalid response format from update session note API");
		}

		return validated;
	} catch (error) {
		console.error("Failed to update session note:", error);
		throw error;
	}
}

export interface UpdateSessionNoteResponse {
	message: string;
	note: string;
	sandbox_id: string;
	session_id: string;
	success: boolean;
}

export interface UpdateSessionNoteResult {
	success: boolean;
	data?: UpdateSessionNoteResponse;
	error?: string;
}

export interface DeleteSessionRequest {
	/**
	 * 沙盒id
	 */
	sandbox_id: string;
	/**
	 * 对话id
	 */
	session_id: string;
}

export interface DeleteSessionResponse {
	message: string;
	sandbox_id: string;
	session_id: string;
	success: boolean;
}

export interface DeleteSessionResult {
	success: boolean;
	data?: DeleteSessionResponse;
	error?: string;
}

/**
 * Add or modify conversation note
 * 添加/修改对话备注
 */
export async function updateSessionNote(
	request: UpdateSessionNoteRequest,
): Promise<UpdateSessionNoteResult> {
	try {
		const kyInstance = await getCodeAgentKy();

		// Local mode doesn't need sandbox_id
		const requestBody =
			codeAgentState.type === "local"
				? {
						note: request.note,
						session_id: request.session_id,
					}
				: request;

		const data = (await kyInstance
			.post("302/claude-code/sandbox/session", {
				json: requestBody,
			})
			.json()) as UpdateSessionNoteResponse;

		if (data.success === false) {
			return {
				success: false,
				error: data.message || "Failed to update session note",
			};
		}

		try {
			if (codeAgentState.type === "local") {
				await localClaudeCodeSandboxState.refreshSessions();
			} else {
				await window.electronAPI?.codeAgentService?.updateClaudeCodeSandboxesByIpc?.();
			}
		} catch (refreshError) {
			console.error(
				"Failed to refresh Claude code sandboxes after updating session note:",
				refreshError,
			);
		}

		return {
			success: true,
			data: data,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to update session note",
		};
	}
}

/**
 * Delete a session
 * 删除对话
 */
export async function deleteSession(request: DeleteSessionRequest): Promise<DeleteSessionResult> {
	try {
		const kyInstance = await getCodeAgentKy();

		// Local mode doesn't need sandbox_id
		const searchParams =
			codeAgentState.type === "local"
				? {
						session_id: request.session_id,
					}
				: {
						sandbox_id: request.sandbox_id,
						session_id: request.session_id,
					};

		const data = (await kyInstance
			.delete("302/claude-code/sandbox/session", {
				searchParams,
			})
			.json()) as DeleteSessionResponse;

		if (data.success === false) {
			return {
				success: false,
				error: data.message || "Failed to delete session",
			};
		}

		return {
			success: true,
			data: data,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to delete session",
		};
	}
}

export async function listLocalClaudeCodeSessions(): Promise<ListLocalClaudeCodeSessionsResponse> {
	try {
		const kyInstance = await getCodeAgentKy();

		const response = await kyInstance.get("302/claude-code/sandbox/session").json();
		const validated = listLocalClaudeCodeSessionsResponse(response);
		if (validated instanceof type.errors) {
			console.error(
				"Failed to validate list local claude code sessions response:",
				validated.summary,
			);
			throw new Error("Invalid response format from list local claude code sessions API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to list local claude code sessions:", error);
		throw error;
	}
}
