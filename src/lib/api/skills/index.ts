import { skill } from "@shared/types";
import { type } from "arktype";
import { testKy } from "../core/test-ky";

export const listSkillsRequestSchema = type({
	sandboxId: "string?",
	sessionId: "string?",
	projectPath: "string?",
});
export type ListSkillsRequest = typeof listSkillsRequestSchema.infer;
export const listSkillsResponseSchema = type({
	success: "boolean",
	user_skills: skill.array(),
	builtin_skills: skill.array(),
	project_skills: skill.array(),
});
export type ListSkillsResponse = typeof listSkillsResponseSchema.infer;

export async function listSkills(request: ListSkillsRequest): Promise<ListSkillsResponse> {
	const { sandboxId, sessionId, projectPath } = request;
	try {
		const response = await testKy
			.get("api/v1/claude-code/skills/list", {
				searchParams: {
					sandboxId,
					sessionId,
					projectPath,
				},
			})
			.json();

		const validated = listSkillsResponseSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate list skills response:", validated.summary);
			throw new Error("Invalid response format from list skills API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to list skills:", error);
		throw error;
	}
}
