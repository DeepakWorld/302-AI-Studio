import type { SkillDetailsRequest } from "./base-apis";
import { _editSkillDetails } from "./base-apis";

const { extractZipBlob } = window.electronAPI.appService;

export async function editSkillDetails(request: SkillDetailsRequest) {
	const blob = await _editSkillDetails(request);
	const arrayBuffer = await blob.arrayBuffer();
	const path = await extractZipBlob(arrayBuffer);
	console.log("path", path);
	return path;
}
