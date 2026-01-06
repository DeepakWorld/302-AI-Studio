<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { cn } from "$lib/utils";
	import { ChevronRight, File, Folder, FolderOpen } from "@lucide/svelte";
	import type { FileNode } from "@shared/types";
	import SkillFileTreeNode from "./skill-file-tree-node.svelte";

	interface Props {
		node: FileNode;
		level?: number;
		selectedPath?: string;
		onSelect?: (node: FileNode) => void;
	}

	let { node, level = 0, selectedPath = "", onSelect }: Props = $props();

	let isOpen = $state(false);

	function handleSelect(e: MouseEvent) {
		e.stopPropagation();
		if (node.type === "directory") {
			isOpen = !isOpen;
		} else {
			onSelect?.(node);
		}
	}
</script>

{#if node.type === "directory"}
	<Collapsible.Root open={isOpen} onOpenChange={(open) => (isOpen = open)}>
		<Collapsible.Trigger
			class={cn(
				"flex w-full items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent hover:text-accent-foreground",
				selectedPath === node.path && "bg-accent text-accent-foreground",
			)}
			style="padding-left: {level * 12 + 8}px"
		>
			<ChevronRight
				class={cn("size-4 shrink-0 transition-transform duration-200", isOpen && "rotate-90")}
			/>
			{#if isOpen}
				<FolderOpen class="size-4 shrink-0 text-blue-500" />
			{:else}
				<Folder class="size-4 shrink-0 text-blue-500" />
			{/if}
			<span class="truncate text-sm">{node.name}</span>
		</Collapsible.Trigger>
		<Collapsible.Content>
			{#if node.children}
				{#each node.children as child (child.path)}
					<SkillFileTreeNode node={child} level={level + 1} {selectedPath} {onSelect} />
				{/each}
			{/if}
		</Collapsible.Content>
	</Collapsible.Root>
{:else}
	<button
		onclick={handleSelect}
		class={cn(
			"flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground",
			selectedPath === node.path && "bg-accent text-accent-foreground",
		)}
		style="padding-left: {level * 12 + 28}px"
	>
		<File class="size-4 shrink-0 text-muted-foreground" />
		<span class="truncate text-sm">{node.name}</span>
	</button>
{/if}
