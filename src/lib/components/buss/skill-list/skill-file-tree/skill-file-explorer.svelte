<script lang="ts">
	import CodeMirrorEditor from "$lib/components/buss/editor/codemirror-editor.svelte";
	import * as Resizable from "$lib/components/ui/resizable";
	import { mode } from "mode-watcher";
	import SkillFileTree from "./skill-file-tree.svelte";

	interface Props {
		rootPath: string;
		readOnly?: boolean;
		lineWrapping?: boolean;
		defaultExpandAll?: boolean;
		autoSelectPriority?: string[];
		changedFiles?: Map<string, string>; // 已修改的文件内容
		onFileChange?: (path: string, content: string) => void;
		onRootPathChange?: (newRootPath: string) => void; // 根目录重命名时通知父组件
		onFileRename?: (oldPath: string, newPath: string) => void; // 文件/文件夹重命名时通知父组件
	}

	let {
		rootPath,
		readOnly = true,
		lineWrapping = true,
		defaultExpandAll = false,
		autoSelectPriority,
		changedFiles,
		onFileChange,
		onRootPathChange,
		onFileRename,
	}: Props = $props();
	let fileContent = $state("");
	let filePath = $state("");

	function handleFileSelect(file: { path: string; content: string }) {
		// 优先使用 changedFiles 中的内容（支持从默认视图切换过来时显示已修改的内容）
		const modifiedContent = changedFiles?.get(file.path);
		fileContent = modifiedContent !== undefined ? modifiedContent : file.content;
		filePath = file.path;
	}

	function handleContentChange(newContent: string) {
		fileContent = newContent;
		if (filePath && onFileChange) {
			onFileChange(filePath, newContent);
		}
	}

	// 监听 changedFiles 中当前选中文件的内容变化（form → 文件树联动）
	$effect(() => {
		if (filePath && changedFiles) {
			const modifiedContent = changedFiles.get(filePath);
			if (modifiedContent !== undefined && modifiedContent !== fileContent) {
				fileContent = modifiedContent;
			}
		}
	});

	// Determine language from file extension
	let language = $derived(filePath.split(".").pop() || "txt");
</script>

<div class="h-full w-full">
	<Resizable.PaneGroup direction="horizontal" class="h-full w-full rounded-lg border">
		<Resizable.Pane defaultSize={25} minSize={15} maxSize={40}>
			<div class="h-full p-2">
				<SkillFileTree
					{rootPath}
					{readOnly}
					{defaultExpandAll}
					{autoSelectPriority}
					onSelect={handleFileSelect}
					{onRootPathChange}
					{onFileRename}
				/>
			</div>
		</Resizable.Pane>
		<Resizable.Handle />
		<Resizable.Pane defaultSize={75}>
			<div class="h-full border-l bg-background">
				{#if filePath}
					<CodeMirrorEditor
						value={fileContent}
						{language}
						theme={mode.current === "dark" ? "dark" : "light"}
						{readOnly}
						{lineWrapping}
						onChange={handleContentChange}
					/>
				{:else}
					<div class="flex h-full items-center justify-center text-muted-foreground">
						Select a file to view content
					</div>
				{/if}
			</div>
		</Resizable.Pane>
	</Resizable.PaneGroup>
</div>
