<script lang="ts">
	import { SkillList } from "$lib/components/buss/skill-list";
	import type { Skill } from "@shared/types";

	const builtinSkills: Skill[] = [
		{
			name: "frontend-design",
			description:
				"Create distinctive, production-grade frontend interfaces with high design quality.",
		},
		{
			name: "mcp-builder",
			description:
				"Guide for creating high-quality MCP servers that enable LLMs to interact with external services.",
		},
		{
			name: "skill-creator",
			description: "Guide for creating effective skills that extend Claude capabilities.",
		},
	];

	const userSkills: Skill[] = [
		{
			name: "webapp-testing",
			description:
				"Toolkit for interacting with and testing local web applications using Playwright.",
		},
		{
			name: "project-conventions",
			description: "Our team coding conventions and project-specific guidelines.",
		},
	];

	function handleNew() {
		console.log("Create new skill");
	}

	// function handleUse(skill: Skill) {
	// 	console.log("Use skill:", skill.name);
	// }

	function handleEdit(skill: Skill) {
		console.log("Edit skill:", skill.name);
	}

	function handleDownload(skill: Skill) {
		console.log("Download skill:", skill.name);
	}

	function handleDelete(skill: Skill) {
		console.log("Delete skill:", skill.name);
	}
</script>

<SkillList
	{builtinSkills}
	{userSkills}
	onNew={handleNew}
	onEdit={handleEdit}
	onDownload={handleDownload}
	onDelete={handleDelete}
/>
