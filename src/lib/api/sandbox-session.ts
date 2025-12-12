/**
 * Sandbox Session API Client
 * 302.AI 沙盒会话 API
 */

import type { ModelProvider } from "@shared/types";

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
	provider: ModelProvider,
	request: UpdateSessionNoteRequest,
): Promise<UpdateSessionNoteResult> {
	try {
		// Use the base URL without /v1 suffix
		const baseUrl = provider.baseUrl.replace(/\/v1\/?$/, "");
		const endpoint = `${baseUrl}/302/claude-code/sandbox/session`;

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${provider.apiKey}`,
			},
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorMessage = `API request failed: ${response.status} ${response.statusText}`;

			try {
				const errorData = JSON.parse(errorText);
				if (errorData.error) {
					if (typeof errorData.error === "object" && errorData.error.message) {
						errorMessage = errorData.error.message;
					} else if (typeof errorData.error === "string") {
						errorMessage = errorData.error;
					}
				} else if (errorData.message) {
					errorMessage = errorData.message;
				}
			} catch {
				if (errorText) {
					errorMessage = errorText;
				}
			}

			return {
				success: false,
				error: errorMessage,
			};
		}

		const data = await response.json();

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
export async function deleteSession(
	provider: ModelProvider,
	request: DeleteSessionRequest,
): Promise<DeleteSessionResult> {
	try {
		// Use the base URL without /v1 suffix
		const baseUrl = provider.baseUrl.replace(/\/v1\/?$/, "");
		const params = new URLSearchParams({
			sandbox_id: request.sandbox_id,
			session_id: request.session_id,
		});
		const endpoint = `${baseUrl}/302/claude-code/sandbox/session?${params.toString()}`;

		const response = await fetch(endpoint, {
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${provider.apiKey}`,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorMessage = `API request failed: ${response.status} ${response.statusText}`;

			try {
				const errorData = JSON.parse(errorText);
				if (errorData.error) {
					if (typeof errorData.error === "object" && errorData.error.message) {
						errorMessage = errorData.error.message;
					} else if (typeof errorData.error === "string") {
						errorMessage = errorData.error;
					}
				} else if (errorData.message) {
					errorMessage = errorData.message;
				}
			} catch {
				if (errorText) {
					errorMessage = errorText;
				}
			}

			return {
				success: false,
				error: errorMessage,
			};
		}

		const data = await response.json();

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
