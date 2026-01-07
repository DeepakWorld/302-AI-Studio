import JSZip from "jszip";
import type { ListSkillsRequest, ListSkillsResponse, SkillDetailsRequest } from "./base-apis";
import { _createSkill, _editSkillDetails, _listSkills } from "./base-apis";

const { extractZipBlob } = window.electronAPI.appService;

export async function editSkillDetails(request: SkillDetailsRequest) {
	const blob = await _editSkillDetails(request);
	const arrayBuffer = await blob.arrayBuffer();
	const path = await extractZipBlob(arrayBuffer);
	console.log("path", path);
	return path;
}

export async function downloadSkill(skillName: string, builtin: boolean = false): Promise<Blob> {
	return _editSkillDetails({ skillName, builtin });
}

export async function listSkills(request: ListSkillsRequest): Promise<ListSkillsResponse> {
	const pipeline = (response: ListSkillsResponse) => {
		const { success, user_skills, builtin_skills, project_skills } = response;
		return {
			success,
			user_skills: user_skills.map((skill) => ({ ...skill, isBuiltin: false })),
			builtin_skills: builtin_skills.map((skill) => ({ ...skill, isBuiltin: true })),
			project_skills: project_skills.map((skill) => ({ ...skill, isBuiltin: false })),
		};
	};

	const result = await _listSkills(request);
	return pipeline(result);
}

export interface CreateSkillData {
	name: string;
	description: string;
	content: string;
}

export async function createSkill(data: CreateSkillData) {
	const { name, content } = data;

	// 创建 zip 文件，文件夹名与 skill 名一致
	const zip = new JSZip();
	const folder = zip.folder(name);
	if (!folder) {
		throw new Error("Failed to create skill folder in zip");
	}
	folder.file("SKILL.md", content);

	const zipBlob = await zip.generateAsync({ type: "blob" });
	const zipFile = new File([zipBlob], `${name}.zip`, { type: "application/zip" });

	return _createSkill(zipFile);
}
