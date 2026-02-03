/**
 * Sandbox Session API Client
 * 302.AI 沙盒会话 API
 */

import { type } from "arktype";
import { codeAgentKy } from "./core/code-agent-ky";

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
		const response = await codeAgentKy
			.post("302/claude-code/sandbox/session", {
				json: request,
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
		const data = (await codeAgentKy
			.post("302/claude-code/sandbox/session", {
				json: request,
			})
			.json()) as UpdateSessionNoteResponse;

		if (data.success === false) {
			return {
				success: false,
				error: data.message || "Failed to update session note",
			};
		}

		// Refresh sandbox/session list so UI stays in sync with latest note
		if (typeof window !== "undefined") {
			try {
				await window.electronAPI?.codeAgentService?.updateClaudeCodeSandboxesByIpc?.();
			} catch (refreshError) {
				console.error(
					"Failed to refresh Claude code sandboxes after updating session note:",
					refreshError,
				);
			}
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
		const data = (await codeAgentKy
			.delete("302/claude-code/sandbox/session", {
				searchParams: {
					sandbox_id: request.sandbox_id,
					session_id: request.session_id,
				},
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
