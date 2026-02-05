/**
 * Sandbox Command Execution API Client
 * 302.AI 沙盒命令执行 API
 */

import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
import { _302AIKy } from "./core/_302ai-ky";
import { localCodeAgentKy } from "./core/local-code-agent-ky";

/**
 * Get the appropriate ky instance based on code agent mode
 */
export function getCodeAgentKy() {
	return codeAgentState.type === "local" ? localCodeAgentKy : _302AIKy;
}

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
	request: ExecuteCommandRequest,
): Promise<ExecuteCommandResult> {
	try {
		const kyInstance = getCodeAgentKy();

		// Local mode logic for request body
		const requestBody =
			codeAgentState.type === "local"
				? {
						session_id: request.session_id,
						command: request.command,
						cwd: request.cwd,
					}
				: request;

		const response = await kyInstance.post("302/claude-code/commands", {
			json: requestBody,
		});

		const data: ExecuteCommandResponse = await response.json();

		// Check if the response indicates failure even with HTTP 200
		if (data.success === false) {
			let errorMessage = "Failed to execute command";
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const errorData = (data as any).error;
			if (errorData) {
				if (typeof errorData === "string") {
					errorMessage = errorData;
				} else if (errorData.message) {
					errorMessage = errorData.message;
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
		// Handle HTTP errors (ky throws on non-2xx responses)
		if (error && typeof error === "object" && "response" in error) {
			const httpError = error as { response: Response };
			try {
				const errorText = await httpError.response.text();
				let errorMessage = `API request failed: ${httpError.response.status} ${httpError.response.statusText}`;

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
					if (errorText) errorMessage = errorText;
				}

				return {
					success: false,
					error: errorMessage,
				};
			} catch {
				// Failed to read response
			}
		}

		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to execute command",
		};
	}
}
