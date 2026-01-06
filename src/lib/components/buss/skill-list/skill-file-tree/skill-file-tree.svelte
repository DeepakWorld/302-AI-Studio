<script lang="ts">
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import type { FileNode } from "@shared/types";
	import SkillFileTreeNode from "./skill-file-tree-node.svelte";

	interface Props {
		rootPath: string;
		onSelect?: (file: { path: string; content: string }) => void;
	}

	let { rootPath, onSelect }: Props = $props();
	let tree = $state<FileNode | null>(null);
	let selectedPath = $state("");
	let loading = $state(false);

	const { scanDirectory, readFile } = window.electronAPI.appService;

	async function loadTree(path: string) {
		if (!path) return;
		loading = true;
		try {
			tree = await scanDirectory(path);
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
</script>

<div class="h-full w-full rounded-md border bg-background">
	<ScrollArea class="h-full">
		<div class="p-2">
			{#if loading}
				<div class="p-2 text-sm text-muted-foreground">Loading...</div>
			{:else if tree}
				<SkillFileTreeNode node={tree} {selectedPath} onSelect={handleNodeSelect} />
			{:else}
				<div class="p-2 text-sm text-muted-foreground">No files found</div>
			{/if}
		</div>
	</ScrollArea>
</div>
