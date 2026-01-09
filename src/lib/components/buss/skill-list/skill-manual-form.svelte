<script lang="ts">
	import CodeMirrorEditor from "$lib/components/buss/editor/codemirror-editor.svelte";
	import SkillFileExplorer from "$lib/components/buss/skill-list/skill-file-tree/skill-file-explorer.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { Loader2 } from "@lucide/svelte";
	import { mode } from "mode-watcher";
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
		onRootPathChange?: (newRootPath: string) => void; // 根目录重命名回调（外部传入 rootPath 时使用）
		onFileRename?: (oldPath: string, newPath: string) => void; // 文件/文件夹重命名回调
	}

	let {
		formData = $bindable(),
		rootPath,
		readOnly = true,
		changedFiles,
		onFileChange,
		enableManualFileTree = false,
		onRootPathChange,
		onFileRename,
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

	// 处理手动模式下的文件/文件夹重命名
	function handleManualFileRename(oldPath: string, newPath: string) {
		// 更新 changedFiles 中的路径（处理文件和文件夹重命名）
		const newChangedFiles = new SvelteMap<string, string>();
		for (const [path, content] of manualChangedFiles) {
			if (path === oldPath) {
				newChangedFiles.set(newPath, content);
			} else if (path.startsWith(oldPath + "/") || path.startsWith(oldPath + "\\")) {
				const newFilePath = path.replace(oldPath, newPath);
				newChangedFiles.set(newFilePath, content);
			} else {
				newChangedFiles.set(path, content);
			}
		}
		manualChangedFiles = newChangedFiles;

		// 如果重命名的是 SKILL.md，更新 manualSkillMdPath
		if (oldPath === manualSkillMdPath) {
			manualSkillMdPath = newPath;
		} else if (
			manualSkillMdPath &&
			(manualSkillMdPath.startsWith(oldPath + "/") || manualSkillMdPath.startsWith(oldPath + "\\"))
		) {
			manualSkillMdPath = manualSkillMdPath.replace(oldPath, newPath);
		}

		onFileRename?.(oldPath, newPath);
	}

	// 处理根目录重命名
	function handleRootPathChange(newRootPath: string) {
		// 手动模式：更新 manualRootPath 和 manualChangedFiles
		if (!rootPath && manualRootPath) {
			const oldRootPath = manualRootPath;

			// 更新 manualChangedFiles 中所有文件的路径
			const newChangedFiles = new SvelteMap<string, string>();
			for (const [path, content] of manualChangedFiles) {
				if (path.startsWith(oldRootPath)) {
					const newPath = path.replace(oldRootPath, newRootPath);
					newChangedFiles.set(newPath, content);
				} else {
					newChangedFiles.set(path, content);
				}
			}
			manualChangedFiles = newChangedFiles;

			// 更新 manualSkillMdPath（如果存在）
			if (manualSkillMdPath && manualSkillMdPath.startsWith(oldRootPath)) {
				manualSkillMdPath = manualSkillMdPath.replace(oldRootPath, newRootPath);
			}

			manualRootPath = newRootPath;
		}
		// 外部 rootPath 模式：通知父组件
		else if (rootPath && onRootPathChange) {
			onRootPathChange(newRootPath);
		}
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

	// 同步 formData.name 到临时目录名称
	let isRenaming = $state(false);
	$effect(() => {
		const newName = formData.name.trim() || "new-skill";
		// 只在手动模式且有临时目录时执行重命名
		if (manualRootPath && !isRenaming) {
			const currentDirName = manualRootPath.split(/[/\\]/).pop() || "";
			if (newName !== currentDirName) {
				// 捕获当前路径值
				const oldRootPath = manualRootPath;
				const parentPath = oldRootPath.substring(0, oldRootPath.length - currentDirName.length - 1);
				const newRootPath = `${parentPath}/${newName}`;

				isRenaming = true;
				// 使用 setTimeout 避免在 effect 中直接执行异步操作
				setTimeout(async () => {
					try {
						await window.electronAPI.appService.renameFile(oldRootPath, newRootPath);
						handleRootPathChange(newRootPath);
					} catch (error) {
						console.error("Failed to rename directory:", error);
					} finally {
						isRenaming = false;
					}
				}, 0);
			}
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

<div class="flex h-full flex-col gap-4 px-6 py-6">
	<div class="shrink-0 space-y-2">
		<Label for="skill-name" class="text-sm font-medium">
			{m.skills_form_name()} <span class="text-destructive">*</span>
		</Label>
		<Input
			id="skill-name"
			bind:value={formData.name}
			placeholder={m.skills_form_name_placeholder()}
			class="dark:border-[#3d3d3d]"
		/>
	</div>

	<div class="shrink-0 space-y-2">
		<Label for="skill-desc" class="text-sm font-medium">
			{m.skills_form_desc()} <span class="text-destructive">*</span>
		</Label>
		<Input
			id="skill-desc"
			bind:value={formData.description}
			placeholder={m.skills_form_desc_placeholder()}
			class="dark:border-[#3d3d3d]"
		/>
	</div>

	<div class="flex min-h-0 flex-1 flex-col space-y-2">
		<!-- Label with toggle buttons -->
		<div class="flex shrink-0 items-center justify-between">
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
			<div class="min-h-0 flex-1 overflow-hidden rounded-md border">
				<CodeMirrorEditor
					value={formData.content}
					language="md"
					theme={mode.current === "dark" ? "dark" : "light"}
					readOnly={false}
					onChange={(value) => (formData.content = value)}
				/>
			</div>
			<p class="shrink-0 text-muted-foreground text-xs">{m.skills_form_content_hint()}</p>
		{:else if effectiveRootPath}
			<div class="min-h-0 flex-1 overflow-hidden rounded-md">
				<SkillFileExplorer
					rootPath={effectiveRootPath}
					readOnly={rootPath ? readOnly : false}
					defaultExpandAll={true}
					changedFiles={effectiveChangedFiles}
					onFileChange={rootPath ? onFileChange : handleManualFileChange}
					onRootPathChange={rootPath && onRootPathChange ? onRootPathChange : handleRootPathChange}
					onFileRename={rootPath ? onFileRename : handleManualFileRename}
				/>
			</div>
		{/if}
	</div>
</div>
