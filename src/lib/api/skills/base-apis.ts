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
					sandbox_id: sandboxId,
					session_id: sessionId,
					project_path: projectPath,
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

export const skillDetailsRequestSchema = type({
	skillName: "string",
	builtin: "boolean?",
});
export type SkillDetailsRequest = typeof skillDetailsRequestSchema.infer;
export const checkSkillDetailsResponseSchema = type({
	success: "boolean",
	skill: skill,
});
export type CheckSkillDetailsResponse = typeof checkSkillDetailsResponseSchema.infer;

export async function checkSkillDetails(
	request: SkillDetailsRequest,
): Promise<CheckSkillDetailsResponse> {
	const { skillName, builtin } = request;
	try {
		const response = await testKy
			.get("api/v1/claude-code/skills/detail", {
				searchParams: {
					name: skillName,
					mode: "view",
					builtin,
				},
			})
			.json();

		const validated = checkSkillDetailsResponseSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate check skill details response:", validated.summary);
			throw new Error("Invalid response format from check skill details API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to check skill details:", error);
		throw error;
	}
}

export async function _editSkillDetails(request: SkillDetailsRequest): Promise<Blob> {
	const { skillName, builtin } = request;
	try {
		const response = await testKy
			.get("api/v1/claude-code/skills/detail", {
				searchParams: {
					name: skillName,
					mode: "edit",
					builtin: builtin ?? false,
				},
			})
			.blob();

		return response;
	} catch (error) {
		console.error("Failed to check skill details:", error);
		throw error;
	}
}

// export const deleteSkillRequestSchema = type({
// 	skillNames: "string[]",
// });
// export type DeleteSkillRequest = typeof deleteSkillRequestSchema.infer;
// export const deleteSkillResponseSchema = type({
// 	success: "boolean",
// 	message: "string",
// });
// export type DeleteSkillResponse = typeof deleteSkillResponseSchema.infer;

// export async function deleteSkill(request: DeleteSkillRequest): Promise<DeleteSkillResponse> {
// 	const { skillNames } = request;
// 	try {
// 		const response = await testKy
// 			.delete("api/v1/claude-code/skills/delete", {
// 				searchParams: {
// 					names: skillNames.join(","),
// 				},
// 			})
// 			.json();

// 		const validated = deleteSkillResponseSchema(response);
// 		if (validated instanceof type.errors) {
// 			console.error("Failed to validate delete skill response:", validated.summary);
// 			throw new Error("Invalid response format from delete skill API");
// 		}
// 		return validated;
// 	} catch (error) {
// 		console.error("Failed to delete skill:", error);
// 		throw error;
// 	}
// }

export async function downloadSkill(skillName: string, builtin: boolean = false): Promise<Blob> {
	return _editSkillDetails({ skillName, builtin });
}
