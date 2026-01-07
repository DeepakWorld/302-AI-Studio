<script lang="ts">
	import { editSkillDetails } from "$lib/api/skills";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog";
	import { m } from "$lib/paraglide/messages";
	import { Loader2, X } from "@lucide/svelte";
	import type { Skill } from "@shared/types";
	import { toast } from "svelte-sonner";
	import SkillManualForm from "./skill-manual-form.svelte";

	interface Props {
		open: boolean;
		skill: Skill | null;
		onOpenChange?: (open: boolean) => void;
		onSave?: (skill: Skill, data: { name: string; description: string; content: string }) => void;
	}

	let { open = $bindable(false), skill, onOpenChange, onSave }: Props = $props();

	let isLoading = $state(false);
	let isSaving = $state(false);
	let manualFormRef = $state<SkillManualForm | undefined>();
	let extractedPath = $state("");

	let formData = $state({
		name: "",
		description: "",
		content: "",
	});

	const { readFile, scanDirectory } = window.electronAPI.appService;

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
		// 移除最后的 /SKILL.md 或 \SKILL.md
		return skillMdPath.replace(/[/\\]SKILL\.md$/i, "");
	}

	$effect(() => {
		if (open && skill) {
			loadSkillContent(skill);
		}
	});

	let skillRootDir = $state("");

	async function loadSkillContent(skill: Skill) {
		isLoading = true;
		try {
			extractedPath = await editSkillDetails({
				skillName: skill.name,
				builtin: skill.isBuiltin,
			});

			// 扫描目录找到 SKILL.md
			const tree = await scanDirectory(extractedPath);
			const skillMdPath = findSkillMd(tree);

			if (!skillMdPath) {
				throw new Error("SKILL.md not found in extracted files");
			}

			skillRootDir = getSkillRootDir(skillMdPath);
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
			handleClose();
		} finally {
			isLoading = false;
		}
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

	function resetState() {
		formData = { name: "", description: "", content: "" };
		isLoading = false;
		isSaving = false;
		extractedPath = "";
		skillRootDir = "";
	}

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		setTimeout(resetState, 150);
	}

	function handleOpenChange(v: boolean) {
		if (!v) {
			setTimeout(resetState, 150);
		}
		onOpenChange?.(v);
	}

	async function handleSave() {
		if (!manualFormRef?.validate()) return;
		if (!skill) return;

		isSaving = true;
		try {
			onSave?.(skill, { ...formData });
			toast.success(m.skills_create_success());
			handleClose();
		} catch (error) {
			console.error("Failed to save skill:", error);
			toast.error(m.skills_create_failed());
		} finally {
			isSaving = false;
		}
	}

	// 文件树的根路径
	const treeRootPath = $derived(skillRootDir || "");

	// 内置 skill 不能保存
	const isBuiltin = $derived(skill?.isBuiltin ?? false);
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="min-w-[700px] rounded-2xl p-0" showCloseButton={false}>
		<!-- Header -->
		<div class="flex items-center justify-between border-b px-4 py-3">
			<span class="text-foreground text-base font-semibold">
				{m.text_button_edit()} - {skill?.name || ""}
			</span>
			<Button variant="ghost" size="icon" class="h-8 w-8" onclick={handleClose}>
				<X class="h-4 w-4" />
			</Button>
		</div>

		<!-- Content -->
		{#if isLoading}
			<div class="flex h-[400px] items-center justify-center">
				<Loader2 class="text-primary h-8 w-8 animate-spin" />
			</div>
		{:else}
			<SkillManualForm bind:formData bind:this={manualFormRef} rootPath={treeRootPath} />
		{/if}

		<!-- Footer -->
		<div class="flex gap-3 border-t px-6 py-4">
			<Button variant="outline" class="flex-1" onclick={handleClose} disabled={isSaving}>
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
	</Dialog.Content>
</Dialog.Root>
