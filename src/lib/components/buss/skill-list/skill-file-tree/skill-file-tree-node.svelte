<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import Input from "$lib/components/ui/input/input.svelte";
	import * as Popover from "$lib/components/ui/popover";
	import { m } from "$lib/paraglide/messages";
	import { cn } from "$lib/utils";
	import {
		ChevronRight,
		File,
		FilePlus,
		Folder,
		FolderOpen,
		FolderPlus,
		Pencil,
		Trash2,
	} from "@lucide/svelte";
	import type { FileNode } from "@shared/types";
	import { tick } from "svelte";
	import type { SvelteSet } from "svelte/reactivity";
	import SkillFileTreeNode from "./skill-file-tree-node.svelte";

	interface Props {
		node: FileNode;
		level?: number;
		selectedPath?: string;
		expandedPaths?: SvelteSet<string>;
		readOnly?: boolean;
		onSelect?: (node: FileNode) => void;
		onCreateFile?: (parentPath: string) => void;
		onCreateFolder?: (parentPath: string) => void;
		onRenameConfirm?: (node: FileNode, newName: string) => void;
		onDelete?: (node: FileNode) => void;
		onToggleExpand?: (path: string, expanded: boolean) => void;
	}

	let {
		node,
		level = 0,
		selectedPath = "",
		expandedPaths,
		readOnly = false,
		onSelect,
		onCreateFile,
		onCreateFolder,
		onRenameConfirm,
		onDelete,
		onToggleExpand,
	}: Props = $props();

	let isOpen = $derived(expandedPaths?.has(node.path) ?? false);
	let isEditing = $state(false);
	let editValue = $state("");
	let inputRef = $state<HTMLInputElement | null>(null);

	function handleSelect(e: MouseEvent) {
		e.stopPropagation();
		if (isEditing) return;
		if (node.type === "directory") {
			onToggleExpand?.(node.path, !isOpen);
		} else {
			onSelect?.(node);
		}
	}

	function handleCreateFile() {
		onCreateFile?.(node.path);
	}

	function handleCreateFolder() {
		onCreateFolder?.(node.path);
	}

	async function handleRename() {
		editValue = node.name;
		// 延迟打开 popover，等待 context menu 完全关闭
		await new Promise((resolve) => setTimeout(resolve, 100));
		isEditing = true;
		await tick();
		inputRef?.focus();
		inputRef?.select();
	}

	function handleDelete() {
		onDelete?.(node);
	}

	function confirmRename() {
		const trimmed = editValue.trim();
		if (trimmed && trimmed !== node.name) {
			onRenameConfirm?.(node, trimmed);
		}
		isEditing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			confirmRename();
		} else if (e.key === "Escape") {
			e.preventDefault();
			isEditing = false;
		}
	}
</script>

{#if node.type === "directory"}
	{#if readOnly}
		<Collapsible.Root open={isOpen} onOpenChange={(open) => onToggleExpand?.(node.path, open)}>
			<Collapsible.Trigger
				class={cn(
					"flex w-full items-center gap-1 rounded-sm px-2 py-1 hover:bg-accent/50",
					selectedPath === node.path && "bg-primary/20 text-primary",
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
						<SkillFileTreeNode
							node={child}
							level={level + 1}
							{selectedPath}
							{expandedPaths}
							{readOnly}
							{onSelect}
							{onCreateFile}
							{onCreateFolder}
							{onRenameConfirm}
							{onDelete}
							{onToggleExpand}
						/>
					{/each}
				{/if}
			</Collapsible.Content>
		</Collapsible.Root>
	{:else}
		<ContextMenu.Root>
			<ContextMenu.Trigger class="w-full">
				<Popover.Root bind:open={isEditing}>
					<Popover.Trigger onclick={(e) => e.preventDefault()}>
						{#snippet child({ props })}
							<Collapsible.Root
								open={isOpen}
								onOpenChange={(open) => onToggleExpand?.(node.path, open)}
							>
								<Collapsible.Trigger
									{...props}
									class={cn(
										"flex w-full items-center gap-1 rounded-sm px-2 py-1 hover:bg-accent/50",
										selectedPath === node.path && "bg-primary/20 text-primary",
									)}
									style="padding-left: {level * 12 + 8}px"
								>
									<ChevronRight
										class={cn(
											"size-4 shrink-0 transition-transform duration-200",
											isOpen && "rotate-90",
										)}
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
											<SkillFileTreeNode
												node={child}
												level={level + 1}
												{selectedPath}
												{expandedPaths}
												{readOnly}
												{onSelect}
												{onCreateFile}
												{onCreateFolder}
												{onRenameConfirm}
												{onDelete}
												{onToggleExpand}
											/>
										{/each}
									{/if}
								</Collapsible.Content>
							</Collapsible.Root>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content class="w-64 p-3" align="start" side="bottom">
						<div class="flex flex-col gap-3">
							<span class="text-xs text-muted-foreground">{m.file_tree_rename_title()}</span>
							<Input
								bind:ref={inputRef}
								bind:value={editValue}
								class="h-8 dark:border-[#3d3d3d]"
								onkeydown={handleKeydown}
							/>
							<div class="flex justify-end gap-2">
								<Button variant="ghost" size="sm" onclick={() => (isEditing = false)}>
									{m.common_cancel()}
								</Button>
								<Button size="sm" onclick={confirmRename}>
									{m.text_button_save()}
								</Button>
							</div>
						</div>
					</Popover.Content>
				</Popover.Root>
			</ContextMenu.Trigger>
			<ContextMenu.Content class="w-48">
				<ContextMenu.Item onclick={handleCreateFile}>
					<FilePlus class="mr-2 h-4 w-4" />
					{m.file_tree_new_file()}
				</ContextMenu.Item>
				<ContextMenu.Item onclick={handleCreateFolder}>
					<FolderPlus class="mr-2 h-4 w-4" />
					{m.file_tree_new_folder()}
				</ContextMenu.Item>
				{#if level > 0}
					<ContextMenu.Separator />
					<ContextMenu.Item onclick={handleRename}>
						<Pencil class="mr-2 h-4 w-4" />
						{m.file_tree_rename()}
					</ContextMenu.Item>
					<ContextMenu.Item onclick={handleDelete} class="text-destructive focus:text-destructive">
						<Trash2 class="mr-2 h-4 w-4" />
						{m.file_tree_delete()}
					</ContextMenu.Item>
				{/if}
			</ContextMenu.Content>
		</ContextMenu.Root>
	{/if}
{:else if readOnly}
	<button
		onclick={handleSelect}
		class={cn(
			"flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-accent/50",
			selectedPath === node.path && "bg-primary/20 text-primary",
		)}
		style="padding-left: {level * 12 + 28}px"
	>
		<File class="size-4 shrink-0 text-muted-foreground" />
		<span class="truncate text-sm">{node.name}</span>
	</button>
{:else if level === 1 && node.name === "SKILL.md"}
	<!-- SKILL.md at root level - no context menu, stop propagation to prevent parent folder menu -->
	<button
		onclick={handleSelect}
		oncontextmenu={(e) => e.stopPropagation()}
		class={cn(
			"flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground",
			selectedPath === node.path && "bg-accent text-accent-foreground",
		)}
		style="padding-left: {level * 12 + 28}px"
	>
		<File class="size-4 shrink-0 text-muted-foreground" />
		<span class="truncate text-sm">{node.name}</span>
	</button>
{:else}
	<ContextMenu.Root>
		<ContextMenu.Trigger class="w-full">
			<Popover.Root bind:open={isEditing}>
				<Popover.Trigger onclick={(e) => e.preventDefault()}>
					{#snippet child({ props })}
						<button
							{...props}
							onclick={handleSelect}
							class={cn(
								"flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-accent/50",
								selectedPath === node.path && "bg-primary/20 text-primary",
							)}
							style="padding-left: {level * 12 + 28}px"
						>
							<File class="size-4 shrink-0 text-muted-foreground" />
							<span class="truncate text-sm">{node.name}</span>
						</button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-64 p-3" align="start" side="bottom">
					<div class="flex flex-col gap-3">
						<span class="text-xs text-muted-foreground">{m.file_tree_rename_title()}</span>
						<Input
							bind:ref={inputRef}
							bind:value={editValue}
							class="h-8 dark:border-[#3d3d3d]"
							onkeydown={handleKeydown}
						/>
						<div class="flex justify-end gap-2">
							<Button variant="ghost" size="sm" onclick={() => (isEditing = false)}>
								{m.common_cancel()}
							</Button>
							<Button size="sm" onclick={confirmRename}>
								{m.text_button_save()}
							</Button>
						</div>
					</div>
				</Popover.Content>
			</Popover.Root>
		</ContextMenu.Trigger>
		<ContextMenu.Content class="w-48">
			<ContextMenu.Item onclick={handleRename}>
				<Pencil class="mr-2 h-4 w-4" />
				{m.file_tree_rename()}
			</ContextMenu.Item>
			<ContextMenu.Item onclick={handleDelete} class="text-destructive focus:text-destructive">
				<Trash2 class="mr-2 h-4 w-4" />
				{m.file_tree_delete()}
			</ContextMenu.Item>
		</ContextMenu.Content>
	</ContextMenu.Root>
{/if}
