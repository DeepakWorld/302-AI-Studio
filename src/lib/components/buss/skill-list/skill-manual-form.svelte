<script lang="ts">
	import SkillFileExplorer from "$lib/components/buss/skill-list/skill-file-tree/skill-file-explorer.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import { Label } from "$lib/components/ui/label";
	import Textarea from "$lib/components/ui/textarea/textarea.svelte";
	import { m } from "$lib/paraglide/messages";
	import { Loader2 } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { SvelteMap } from "svelte/reactivity";

	export interface SkillFormData {
		name: string;
		description: string;
		content: string;
	}

	interface Props {
		formData: SkillFormData;
		rootPath?: string; // 文件树根路径，传入时显示切换按钮
		readOnly?: boolean; // 是否只读模式
		changedFiles?: Map<string, string>; // 已修改的文件内容
		onFileChange?: (path: string, content: string) => void; // 文件内容变化回调
		enableManualFileTree?: boolean; // 启用手动模式的文件树预览
	}

	let {
		formData = $bindable(),
		rootPath,
		readOnly = true,
		changedFiles,
		onFileChange,
		enableManualFileTree = false,
	}: Props = $props();

	let viewMode = $state<"default" | "tree">("default");

	// 手动模式的临时目录状态
	let manualRootPath = $state<string | undefined>(undefined);
	let manualSkillMdPath = $state<string | undefined>(undefined);
	let manualChangedFiles: SvelteMap<string, string> = new SvelteMap();
	let isCreatingTempDir = $state(false);

	// 有效的 rootPath（来自 prop 或手动模式）
	const effectiveRootPath = $derived(rootPath || manualRootPath);
	const effectiveChangedFiles = $derived(rootPath ? changedFiles : manualChangedFiles);

	// 切换视图模式
	async function handleViewModeChange(mode: "default" | "tree") {
		if (mode === "tree" && !effectiveRootPath && enableManualFileTree) {
			// 首次切换到文件树视图时创建临时目录
			isCreatingTempDir = true;
			try {
				const skillName = formData.name.trim() || "new-skill";
				const result = await window.electronAPI.appService.createSkillTempDir(skillName);
				manualRootPath = result.rootPath;
				manualSkillMdPath = result.skillMdPath;

				// 初始化 changedFiles，写入当前内容
				manualChangedFiles = new SvelteMap([[result.skillMdPath, formData.content]]);
			} catch (error) {
				console.error("Failed to create temp directory:", error);
				toast.error(m.skills_create_temp_dir_failed());
				return; // 保持在默认视图
			} finally {
				isCreatingTempDir = false;
			}
		}
		viewMode = mode;
	}

	// 处理手动模式下的文件修改
	function handleManualFileChange(path: string, content: string) {
		manualChangedFiles.set(path, content);

		// 如果修改的是 SKILL.md，同步回 formData
		if (path === manualSkillMdPath) {
			formData.content = content;
		}

		onFileChange?.(path, content);
	}

	// 同步 formData.content 到 manualChangedFiles
	$effect(() => {
		if (
			manualSkillMdPath &&
			!rootPath &&
			formData.content !== manualChangedFiles.get(manualSkillMdPath)
		) {
			manualChangedFiles.set(manualSkillMdPath, formData.content);
		}
	});

	// 清理临时目录
	export async function cleanup(): Promise<void> {
		if (manualRootPath) {
			try {
				await window.electronAPI.appService.deleteTempDir(manualRootPath);
			} catch (error) {
				console.error("Failed to cleanup temp directory:", error);
			}
			manualRootPath = undefined;
			manualSkillMdPath = undefined;
			manualChangedFiles = new SvelteMap();
		}
	}

	// 获取手动模式的根路径
	export function getManualRootPath(): string | undefined {
		return manualRootPath;
	}

	// 写入修改的文件到临时目录
	export async function writeChangedFiles(): Promise<void> {
		for (const [path, content] of manualChangedFiles) {
			await window.electronAPI.appService.writeFile(path, content);
		}
	}

	// 重置状态
	export function reset(): void {
		viewMode = "default";
		manualRootPath = undefined;
		manualSkillMdPath = undefined;
		manualChangedFiles = new SvelteMap();
	}

	// 解析 front matter
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

	// 生成 front matter
	function stringifyFrontMatter(data: Record<string, string>, body: string): string {
		const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
		return `---\n${lines.join("\n")}\n---\n${body}`;
	}

	// 用于追踪上一次的值，避免循环更新
	let prevName = $state(formData.name);
	let prevDesc = $state(formData.description);
	let prevContent = $state(formData.content);

	// 监听 name/description 变化，同步到 content
	$effect(() => {
		const nameChanged = formData.name !== prevName;
		const descChanged = formData.description !== prevDesc;

		if (nameChanged || descChanged) {
			// textarea 为空时，自动生成带 front matter 的模板
			if (!formData.content.trim()) {
				if (formData.name || formData.description) {
					const newContent = stringifyFrontMatter(
						{
							name: formData.name,
							description: formData.description,
							license: "Complete terms in LICENSE.txt",
						},
						"",
					);
					formData.content = newContent;
					prevContent = newContent;
				}
			} else {
				// textarea 有内容时，更新 front matter
				const parsed = parseFrontMatter(formData.content);
				if (
					parsed.data.name !== formData.name ||
					parsed.data.description !== formData.description
				) {
					parsed.data.name = formData.name;
					parsed.data.description = formData.description;
					const newContent = stringifyFrontMatter(parsed.data, parsed.body);
					formData.content = newContent;
					prevContent = newContent;
				}
			}
		}
		prevName = formData.name;
		prevDesc = formData.description;
	});

	// 监听 content 变化，同步到 name/description
	$effect(() => {
		if (formData.content !== prevContent) {
			// textarea 被清空时，清空 form
			if (!formData.content.trim()) {
				formData.name = "";
				formData.description = "";
				prevName = "";
				prevDesc = "";
			} else {
				const parsed = parseFrontMatter(formData.content);
				if (parsed.data.name !== undefined && parsed.data.name !== formData.name) {
					formData.name = parsed.data.name;
					prevName = parsed.data.name;
				}
				if (
					parsed.data.description !== undefined &&
					parsed.data.description !== formData.description
				) {
					formData.description = parsed.data.description;
					prevDesc = parsed.data.description;
				}
			}
			prevContent = formData.content;
		}
	});

	export function validate(): boolean {
		if (!formData.name.trim()) {
			toast.warning(m.skills_form_name_required());
			return false;
		}
		if (!formData.description.trim()) {
			toast.warning(m.skills_form_desc_required());
			return false;
		}
		if (!formData.content.trim()) {
			toast.warning(m.skills_form_content_required());
			return false;
		}
		return true;
	}
</script>

<div class="space-y-4 px-6 py-6">
	<div class="space-y-2">
		<Label for="skill-name" class="text-sm font-medium">
			{m.skills_form_name()} <span class="text-destructive">*</span>
		</Label>
		<Input
			id="skill-name"
			bind:value={formData.name}
			placeholder={m.skills_form_name_placeholder()}
		/>
	</div>

	<div class="space-y-2">
		<Label for="skill-desc" class="text-sm font-medium">
			{m.skills_form_desc()} <span class="text-destructive">*</span>
		</Label>
		<Input
			id="skill-desc"
			bind:value={formData.description}
			placeholder={m.skills_form_desc_placeholder()}
		/>
	</div>

	<div class="space-y-2">
		<!-- Label with toggle buttons -->
		<div class="flex items-center justify-between">
			<Label for="skill-content" class="text-sm font-medium">
				{m.skills_form_content()} <span class="text-destructive">*</span>
			</Label>
			{#if rootPath || enableManualFileTree}
				<div class="flex rounded-md border">
					<Button
						variant="ghost"
						size="sm"
						class="h-7 rounded-r-none px-3 text-xs {viewMode === 'default'
							? 'bg-violet-500 text-white hover:bg-violet-600 hover:text-white'
							: ''}"
						onclick={() => handleViewModeChange("default")}
						disabled={isCreatingTempDir}
					>
						{m.skills_form_view_default()}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="h-7 rounded-l-none px-3 text-xs {viewMode === 'tree'
							? 'bg-violet-500 text-white hover:bg-violet-600 hover:text-white'
							: ''}"
						onclick={() => handleViewModeChange("tree")}
						disabled={isCreatingTempDir}
					>
						{#if isCreatingTempDir}
							<Loader2 class="mr-1 h-3 w-3 animate-spin" />
						{/if}
						{m.skills_form_view_tree()}
					</Button>
				</div>
			{/if}
		</div>

		<!-- Content area -->
		{#if viewMode === "default"}
			<Textarea
				id="skill-content"
				bind:value={formData.content}
				class="min-h-[200px] max-h-[300px] w-full max-w-full resize-none overflow-y-auto overflow-x-hidden break-all font-mono text-sm"
			/>
			<p class="text-muted-foreground text-xs">{m.skills_form_content_hint()}</p>
		{:else if effectiveRootPath}
			<div class="h-[300px] overflow-hidden rounded-md">
				<SkillFileExplorer
					rootPath={effectiveRootPath}
					readOnly={rootPath ? readOnly : false}
					changedFiles={effectiveChangedFiles}
					onFileChange={rootPath ? onFileChange : handleManualFileChange}
				/>
			</div>
		{/if}
	</div>
</div>
