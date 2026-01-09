<script lang="ts">
	import { editSkillDetails, updateSkill } from "$lib/api/skills";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import Button from "$lib/components/ui/button/button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import { Loader2 } from "@lucide/svelte";
	import type { Skill } from "@shared/types";
	import { toast } from "svelte-sonner";
	import { SvelteMap } from "svelte/reactivity";
	import SkillManualForm from "../skill-manual-form.svelte";

	interface Props {
		skillName: string;
		skill?: Skill;
		onRefresh?: () => void;
	}

	let { skillName, skill, onRefresh }: Props = $props();

	let isLoading = $state(true);
	let isSaving = $state(false);
	let manualFormRef = $state<SkillManualForm | undefined>();
	let extractedPath = $state("");
	let skillRootDir = $state("");
	let skillMdFilePath = $state("");
	let changedFiles = $state<Map<string, string>>(new Map());
	let prevFormContent = $state("");

	let formData = $state({
		name: "",
		description: "",
		content: "",
	});

	const isBuiltin = $derived(skill?.isBuiltin ?? false);

	const { readFile, scanDirectory, writeFile } = window.electronAPI.appService;

	// 递归查找 SKILL.md 文件
	function findSkillMd(node: { name: string; path: string; children?: unknown[] }): string | null {
		if (node.name === "SKILL.md") {
			return node.path;
		}
		if (node.children) {
			for (const child of node.children as (typeof node)[]) {
				const found = findSkillMd(child);
				if (found) return found;
			}
		}
		return null;
	}

	// 获取 SKILL.md 所在的目录作为文件树根路径
	function getSkillRootDir(skillMdPath: string): string {
		return skillMdPath.replace(/[/\\]SKILL\.md$/i, "");
	}

	function parseFrontMatter(content: string): { data: Record<string, string>; body: string } {
		const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
		if (!match) return { data: {}, body: content };

		const yamlStr = match[1];
		const body = match[2];
		const data: Record<string, string> = {};

		for (const line of yamlStr.split(/\r?\n/)) {
			const colonIdx = line.indexOf(":");
			if (colonIdx > 0) {
				const key = line.slice(0, colonIdx).trim();
				const value = line.slice(colonIdx + 1).trim();
				data[key] = value;
			}
		}
		return { data, body };
	}

	async function loadSkillContent() {
		if (!skill) return;

		isLoading = true;
		try {
			extractedPath = await editSkillDetails({
				skillName: skill.name,
				builtin: skill.isBuiltin,
			});

			const tree = await scanDirectory(extractedPath);
			const skillMdPath = findSkillMd(tree);

			if (!skillMdPath) {
				throw new Error("SKILL.md not found in extracted files");
			}

			skillRootDir = getSkillRootDir(skillMdPath);
			skillMdFilePath = skillMdPath;
			const content = await readFile(skillMdPath);
			const parsed = parseFrontMatter(content);

			formData = {
				name: parsed.data.name || skill.name,
				description: parsed.data.description || skill.description,
				content: content,
			};
		} catch (error) {
			console.error("Failed to load skill content:", error);
			toast.error(m.skills_load_failed?.() || "Failed to load skill");
			skillsPanelState.pop();
		} finally {
			isLoading = false;
		}
	}

	// 加载 skill 内容
	$effect(() => {
		if (skillName) {
			loadSkillContent();
		}
	});

	// 处理文件内容变化
	function handleFileChange(path: string, content: string) {
		const newMap = new SvelteMap(changedFiles);
		newMap.set(path, content);
		changedFiles = newMap;

		if (path === skillMdFilePath) {
			formData.content = content;
		}
	}

	// 监听 formData.content 变化，同步更新 changedFiles
	$effect(() => {
		if (skillMdFilePath && formData.content !== prevFormContent) {
			const newMap = new SvelteMap(changedFiles);
			newMap.set(skillMdFilePath, formData.content);
			changedFiles = newMap;
			prevFormContent = formData.content;
		}
	});

	async function handleSave() {
		if (!manualFormRef?.validate()) return;

		isSaving = true;
		try {
			// 写入所有修改的文件到临时目录
			for (const [path, content] of changedFiles) {
				await writeFile(path, content);
			}

			const result = await updateSkill({
				name: formData.name,
				dirPath: skillRootDir,
			});

			if (result.success) {
				toast.success(m.skills_create_success?.() || "Skill saved successfully");
				onRefresh?.();
				skillsPanelState.pop();
			} else {
				toast.error(result.message || m.skills_load_failed?.() || "Failed to save skill");
			}
		} catch (error) {
			console.error("Failed to save skill:", error);
			toast.error(m.skills_load_failed?.() || "Failed to save skill");
		} finally {
			isSaving = false;
		}
	}

	function handleCancel() {
		skillsPanelState.pop();
	}
</script>

<div class="flex flex-col h-full">
	{#if isLoading}
		<div class="flex h-[400px] items-center justify-center">
			<LdrsLoader type="dot-pulse" size={40} />
		</div>
	{:else}
		<div class="flex-1 min-h-0">
			<SkillManualForm
				bind:formData
				bind:this={manualFormRef}
				rootPath={skillRootDir}
				readOnly={isBuiltin}
				{changedFiles}
				onFileChange={handleFileChange}
			/>
		</div>

		<div class="shrink-0 flex gap-3 border-t px-6 py-4">
			<Button variant="outline" class="flex-1" onclick={handleCancel} disabled={isSaving}>
				{m.text_button_cancel()}
			</Button>
			<Button
				class="flex-1 bg-violet-500 hover:bg-violet-600"
				onclick={handleSave}
				disabled={isLoading || isSaving || isBuiltin}
			>
				{#if isSaving}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				{m.text_button_save?.() || "Save"}
			</Button>
		</div>
	{/if}
</div>
