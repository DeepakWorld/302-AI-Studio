<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { m } from "$lib/paraglide/messages";
	import type { FileNode } from "@shared/types";
	import { SvelteSet } from "svelte/reactivity";
	import FileNameDialog from "./file-name-dialog.svelte";
	import SkillFileTreeNode from "./skill-file-tree-node.svelte";

	type DialogMode = "create-file" | "create-folder" | "rename";

	interface Props {
		rootPath: string;
		readOnly?: boolean;
		defaultExpandAll?: boolean;
		autoSelectPriority?: string[]; // File names to auto-select by priority
		onSelect?: (file: { path: string; content: string }) => void;
	}

	// Default priority for auto-selecting files
	const DEFAULT_AUTO_SELECT_PRIORITY = [
		"SKILL.md",
		"skill.md",
		"README.md",
		"readme.md",
		"index.md",
		"INDEX.md",
	];

	let {
		rootPath,
		readOnly = false,
		defaultExpandAll = false,
		autoSelectPriority = DEFAULT_AUTO_SELECT_PRIORITY,
		onSelect,
	}: Props = $props();
	let tree = $state<FileNode | null>(null);
	let selectedPath = $state("");
	let loading = $state(false);

	// Track expanded folders - persists across tree refreshes
	let expandedPaths = new SvelteSet<string>();

	// Dialog states
	let nameDialogOpen = $state(false);
	let nameDialogMode = $state<DialogMode>("create-file");
	let nameDialogInitialValue = $state("");
	let targetPath = $state("");
	let targetNode = $state<FileNode | null>(null);

	// Delete confirmation dialog
	let deleteDialogOpen = $state(false);
	let deleteNode = $state<FileNode | null>(null);

	const {
		scanDirectory,
		readFile,
		writeFile,
		createDirectory,
		deleteFile,
		deleteDirectory,
		renameFile,
	} = window.electronAPI.appService;

	// Collect all directory paths for expanding
	function collectAllDirectoryPaths(node: FileNode, paths: string[] = []): string[] {
		if (node.type === "directory") {
			paths.push(node.path);
			node.children?.forEach((child) => collectAllDirectoryPaths(child, paths));
		}
		return paths;
	}

	// Find file by priority from the file tree
	function findFileByPriority(node: FileNode, priority: string[]): FileNode | null {
		const allFiles: FileNode[] = [];

		function collectFiles(n: FileNode) {
			if (n.type === "file") {
				allFiles.push(n);
			}
			n.children?.forEach(collectFiles);
		}

		collectFiles(node);

		// Find first matching file by priority
		for (const name of priority) {
			const found = allFiles.find(
				(f) => f.name.toLowerCase() === name.toLowerCase() || f.name === name,
			);
			if (found) return found;
		}

		return null;
	}

	let hasInitialized = false;

	async function loadTree(path: string) {
		if (!path) return;
		loading = true;
		try {
			tree = await scanDirectory(path);

			// Only run initialization once
			if (tree && !hasInitialized) {
				hasInitialized = true;

				// Expand all directories if enabled
				if (defaultExpandAll) {
					const allDirs = collectAllDirectoryPaths(tree);
					allDirs.forEach((dir) => expandedPaths.add(dir));
				}

				// Auto-select priority file
				if (autoSelectPriority.length > 0) {
					const priorityFile = findFileByPriority(tree, autoSelectPriority);
					if (priorityFile) {
						handleNodeSelect(priorityFile);
					}
				}
			}
		} catch (error) {
			console.error("Failed to scan directory:", error);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadTree(rootPath);
	});

	async function handleNodeSelect(node: FileNode) {
		selectedPath = node.path;
		if (node.type === "file") {
			try {
				const content = await readFile(node.path);
				onSelect?.({ path: node.path, content });
			} catch (error) {
				console.error("Failed to read file:", error);
			}
		}
	}

	function handleCreateFile(parentPath: string) {
		targetPath = parentPath;
		nameDialogMode = "create-file";
		nameDialogInitialValue = "";
		nameDialogOpen = true;
		// Ensure parent folder is expanded
		expandedPaths.add(parentPath);
	}

	function handleCreateFolder(parentPath: string) {
		targetPath = parentPath;
		nameDialogMode = "create-folder";
		nameDialogInitialValue = "";
		nameDialogOpen = true;
		// Ensure parent folder is expanded
		expandedPaths.add(parentPath);
	}

	function handleRename(node: FileNode) {
		targetNode = node;
		nameDialogMode = "rename";
		nameDialogInitialValue = node.name;
		nameDialogOpen = true;
	}

	function handleDelete(node: FileNode) {
		deleteNode = node;
		deleteDialogOpen = true;
	}

	function handleToggleExpand(path: string, expanded: boolean) {
		if (expanded) {
			expandedPaths.add(path);
		} else {
			expandedPaths.delete(path);
		}
	}

	async function confirmNameDialog(name: string) {
		try {
			if (nameDialogMode === "create-file") {
				const filePath = joinPath(targetPath, name);
				await writeFile(filePath, "");
				// Ensure parent folder is expanded after creation
				expandedPaths.add(targetPath);
				// Auto-select the new file
				await loadTree(rootPath);
				selectedPath = filePath;
				onSelect?.({ path: filePath, content: "" });
				return;
			} else if (nameDialogMode === "create-folder") {
				const folderPath = joinPath(targetPath, name);
				await createDirectory(folderPath);
				// Ensure parent folder is expanded after creation
				expandedPaths.add(targetPath);
			} else if (nameDialogMode === "rename" && targetNode) {
				const parentPath = getParentPath(targetNode.path);
				const newPath = joinPath(parentPath, name);
				await renameFile(targetNode.path, newPath);
			}
			// Refresh tree
			await loadTree(rootPath);
		} catch (error) {
			console.error("File operation failed:", error);
		}
	}

	async function confirmDelete() {
		if (!deleteNode) return;
		try {
			if (deleteNode.type === "directory") {
				await deleteDirectory(deleteNode.path);
			} else {
				await deleteFile(deleteNode.path);
			}
			deleteDialogOpen = false;
			deleteNode = null;
			// Refresh tree
			await loadTree(rootPath);
		} catch (error) {
			console.error("Delete failed:", error);
		}
	}

	function joinPath(base: string, name: string): string {
		// Handle both Windows and Unix paths
		const separator = base.includes("\\") ? "\\" : "/";
		return base.endsWith(separator) ? base + name : base + separator + name;
	}

	function getParentPath(path: string): string {
		const separator = path.includes("\\") ? "\\" : "/";
		const parts = path.split(separator);
		parts.pop();
		return parts.join(separator);
	}
</script>

<div class="h-full w-full rounded-md border bg-background">
	<ScrollArea class="h-full">
		<div class="p-2">
			{#if loading}
				<div class="p-2 text-sm text-muted-foreground">Loading...</div>
			{:else if tree}
				<SkillFileTreeNode
					node={tree}
					{selectedPath}
					{expandedPaths}
					{readOnly}
					onSelect={handleNodeSelect}
					onCreateFile={handleCreateFile}
					onCreateFolder={handleCreateFolder}
					onRename={handleRename}
					onDelete={handleDelete}
					onToggleExpand={handleToggleExpand}
				/>
			{:else}
				<div class="p-2 text-sm text-muted-foreground">No files found</div>
			{/if}
		</div>
	</ScrollArea>
</div>

<!-- Name Input Dialog -->
<FileNameDialog
	bind:open={nameDialogOpen}
	mode={nameDialogMode}
	initialValue={nameDialogInitialValue}
	onConfirm={confirmNameDialog}
	onCancel={() => {}}
/>

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.file_tree_delete()}</Dialog.Title>
		</Dialog.Header>
		<Dialog.Description>
			{deleteNode?.type === "directory"
				? m.file_tree_confirm_delete_folder()
				: m.file_tree_confirm_delete()}
		</Dialog.Description>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)}>
				{m.common_cancel()}
			</Button>
			<Button variant="destructive" onclick={confirmDelete}>
				{m.file_tree_delete()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
