/**
 * Sandbox Command Execution API Client
 * 302.AI 沙盒命令执行 API
 */

import type { ModelProvider } from "@shared/types";

export interface ExecuteCommandRequest {
	sandbox_id: string;
	session_id?: string;
	command: string;
	cwd?: string;
}

export interface CommandResult {
	exit_code: number;
	stdout: string;
	stderr: string;
	error: string;
}

export interface ExecuteCommandResponse {
	success: boolean;
	result: CommandResult;
}

export interface ExecuteCommandResult {
	success: boolean;
	data?: ExecuteCommandResponse;
	error?: string;
}

/**
 * Execute a command in the sandbox
 */
export async function executeSandboxCommand(
	provider: ModelProvider,
	request: ExecuteCommandRequest,
): Promise<ExecuteCommandResult> {
	try {
		// Use the base URL without /v1 suffix
		const baseUrl = provider.baseUrl.replace(/\/v1\/?$/, "");
		const endpoint = `${baseUrl}/302/claude-code/commands`;

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
					// Handle error object with message property
					if (typeof errorData.error === "object" && errorData.error.message) {
						errorMessage = errorData.error.message;
					} else if (typeof errorData.error === "string") {
						errorMessage = errorData.error;
					}
				} else if (errorData.message) {
					errorMessage = errorData.message;
				}
			} catch {
				// If error response is not JSON, use the text as is
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

		// Check if the response indicates failure even with HTTP 200
		if (data.success === false) {
			let errorMessage = "Failed to execute command";
			if (data.error) {
				if (typeof data.error === "string") {
					errorMessage = data.error;
				} else if (data.error.message) {
					errorMessage = data.error.message;
				}
			}
			return {
				success: false,
				error: errorMessage,
			};
		}

		return {
			success: true,
			data: data,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to execute command",
		};
	}
}
