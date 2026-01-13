import { type } from "arktype";
import { _302AIKy } from "../core/_302ai-ky";

export const executeCommandRequestSchema = type({
	sandboxId: "string",
	command: "string",
});
export type ExecuteCommandRequest = typeof executeCommandRequestSchema.infer;
export const executeCommandResponseSchema = type({
	success: "boolean",
	result: type({
		exit_code: "number",
		stdout: "string",
		stderr: "string",
		error: "string",
	}),
});
export type ExecuteCommandResponse = typeof executeCommandResponseSchema.infer;

/**
 * Executes a command in the specified sandbox.
 * @param request The command execution request.
 * @returns The command execution response.
 */
export async function executeCommand(
	request: ExecuteCommandRequest,
): Promise<ExecuteCommandResponse> {
	try {
		const response = await _302AIKy
			.post("302/claude-code/commands", {
				json: request,
			})
			.json();

		const validated = executeCommandResponseSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate execute command response:", validated.summary);
			throw new Error("Invalid response format from execute command API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to execute command:", error);
		throw error;
	}
}
