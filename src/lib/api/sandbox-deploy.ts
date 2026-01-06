import { type } from "arktype";
import { _302AIKy } from "./core/_302ai-ky";

export const deploySandboxRequestSchema = type({
	sandbox_id: "string",
	session_id: "string?",
});
export type DeploySandboxRequest = typeof deploySandboxRequestSchema.infer;
export const deploySandboxResponseSchema = type({
	success: "boolean",
	status: "string",
	id: "string",
	url: "string",
	cover: "string",
});
export type DeploySandboxResponse = typeof deploySandboxResponseSchema.infer;

/**
 * Deploy sandbox project to 302.AI hosting service (New implementation)
 */
export async function deploySandboxProject(
	request: DeploySandboxRequest,
): Promise<DeploySandboxResponse> {
	try {
		const response = await _302AIKy
			.post("302/claude-code/sandbox/deploy", {
				json: request,
			})
			.json();

		const validated = deploySandboxResponseSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate deploy sandbox response:", validated.summary);
			throw new Error("Invalid response format from deploy sandbox API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to deploy sandbox project:", error);
		throw error;
	}
}
