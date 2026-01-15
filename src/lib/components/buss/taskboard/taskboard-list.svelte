<script lang="ts" module>
	import type { DndEvent } from "svelte-dnd-action";

	type TaskDndEvent = DndEvent<Task>;
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";
	import * as m from "$lib/paraglide/messages";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { cn } from "$lib/utils.js";
	import { GripVertical, SquarePen, Trash2 } from "@lucide/svelte";
	import type { Task } from "@shared/types";
	import { dndzone, SHADOW_PLACEHOLDER_ITEM_ID, TRIGGERS } from "svelte-dnd-action";
	import { flip } from "svelte/animate";
	import { scale } from "svelte/transition";
	import TaskEditDialog from "./task-edit-dialog.svelte";

	interface Props {
		filter?: "all" | "open" | "done";
	}

	let { filter = "all" }: Props = $props();

	let draggedElementId = $state<string | null>(null);
	let isDndFinalizing = $state(false);

	// Local copy of tasks for dnd manipulation (only active tasks)
	let localTasks = $state<Task[]>([]);

	// Edit dialog state
	let editDialogOpen = $state(false);
	let editingTask = $state<Task | null>(null);

	// Status priority for sorting: in_progress > pending > done
	const statusPriority: Record<Task["status"], number> = {
		in_progress: 0,
		pending: 1,
		done: 2,
	};

	// Filtered and sorted tasks based on filter prop
	const filteredTasks = $derived(() => {
		const tasks = codeAgentTaskboardState.tasklist;
		let filtered: Task[];
		if (filter === "open") {
			filtered = tasks.filter((t) => t.status !== "done");
		} else if (filter === "done") {
			filtered = tasks.filter((t) => t.status === "done");
		} else {
			filtered = tasks;
		}
		// Sort by status priority: in_progress > pending > done
		return filtered.toSorted((a, b) => statusPriority[a.status] - statusPriority[b.status]);
	});

	// Split filtered tasks into active (draggable) and done (static)
	const visibleActiveTasks = $derived(() => filteredTasks().filter((t) => t.status !== "done"));
	const visibleDoneTasks = $derived(() => filteredTasks().filter((t) => t.status === "done"));

	// Sync local tasks with store (only when not dragging)
	$effect(() => {
		if (!draggedElementId && !isDndFinalizing) {
			localTasks = [...visibleActiveTasks()];
		}
	});

	function handleDelete(task: Task) {
		const updatedTasklist = codeAgentTaskboardState.tasklist.filter((t) => t.id !== task.id);
		codeAgentTaskboardState.updateTasklist(updatedTasklist);
	}

	function handleEdit(task: Task) {
		editingTask = task;
		editDialogOpen = true;
	}

	function handleEditSave(updatedContent: string) {
		if (!editingTask) return;

		const updatedTasklist = codeAgentTaskboardState.tasklist.map((t) =>
			t.id === editingTask!.id ? { ...t, content: updatedContent } : t,
		);
		codeAgentTaskboardState.updateTasklist(updatedTasklist);
		editingTask = null;
	}

	function handleEditClose() {
		editingTask = null;
	}

	function handleDndConsider(e: CustomEvent<TaskDndEvent>) {
		const { info, items: newItems } = e.detail;

		if (info.trigger === TRIGGERS.DRAG_STARTED) {
			draggedElementId = info.id;
		}

		// Only update if we're actively dragging
		if (draggedElementId) {
			// Check if order changed within the active tasks
			const hasOrderChanged = newItems.some((item, index) => item.id !== localTasks[index]?.id);
			if (hasOrderChanged) localTasks = newItems;
		}
	}

	function handleDndFinalize(e: CustomEvent<TaskDndEvent>) {
		isDndFinalizing = true;

		try {
			draggedElementId = null;
			const newActiveItems = e.detail.items;

			localTasks = newActiveItems;

			// Rebuild full tasklist:
			// 1. New Active Items (reordered)
			// 2. All Done Tasks (preserve order from store, always at bottom)
			const allDoneTasks = codeAgentTaskboardState.tasklist.filter((t) => t.status === "done");

			// If filter is "open" or "all", we have all active tasks in newActiveItems.
			// If filter is "done", we wouldn't be dragging.
			// So safely combine:
			codeAgentTaskboardState.updateTasklist([...newActiveItems, ...allDoneTasks]);
		} catch (error) {
			console.error("Error finalizing drag operation:", error);
		} finally {
			queueMicrotask(() => {
				isDndFinalizing = false;
			});
		}
	}

	function transformDraggedElement(element?: HTMLElement) {
		if (!element) return;

		try {
			element.style.outline = "none";
			element.style.borderRadius = "0.75rem";
			element.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
		} catch (error) {
			console.warn("Error transforming dragged element:", error);
		}
	}

	const isEmpty = $derived(localTasks.length === 0 && visibleDoneTasks().length === 0);
	const isLoading = $derived(codeAgentTaskboardState.isLoading);
</script>

{#snippet taskItem(task: Task)}
	<div
		class={cn(
			"group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200",
			"bg-white dark:bg-zinc-900 border-border/60 hover:border-primary hover:shadow-md",
			task.status === "done" && "opacity-80 hover:opacity-100 cursor-default",
			task.status !== "done" && "cursor-grab active:cursor-grabbing",
		)}
	>
		<!-- Drag handle -->
		<div
			class={cn(
				"shrink-0",
				task.status === "done" && "opacity-40 cursor-not-allowed",
				task.status !== "done" && "cursor-grab active:cursor-grabbing",
			)}
		>
			<GripVertical class="size-4 text-muted-foreground" />
		</div>

		<!-- Task content -->
		<div class="flex-1 min-w-0">
			<span
				class={cn(
					"text-sm truncate block",
					task.status === "pending" && "font-medium text-foreground",
					task.status === "in_progress" && "font-medium text-blue-700 dark:text-blue-300",
					task.status === "done" && "line-through text-muted-foreground",
				)}
			>
				{task.content}
			</span>
		</div>

		<!-- Action buttons -->
		<div class="flex items-center shrink-0">
			{#if task.status === "in_progress"}
				<span
					class="text-xs text-blue-600 dark:text-blue-400 font-medium px-2 py-1 bg-blue-100/50 dark:bg-blue-900/30 rounded-lg"
				>
					{m.taskboard_status_running()}
				</span>
			{:else if task.status === "done"}
				<span
					class="text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2 py-1 bg-emerald-100/50 dark:bg-emerald-900/30 rounded-lg"
				>
					{m.taskboard_filter_done()}
				</span>
			{:else}
				<span class="text-xs text-muted-foreground font-medium px-2 py-1 bg-muted/50 rounded-lg">
					{m.taskboard_filter_open()}
				</span>
			{/if}

			<div
				class="flex items-center overflow-hidden max-w-0 group-hover:max-w-20 transition-all duration-300 ease-in-out"
			>
				<div class="flex items-center gap-1 pl-2">
					{#if task.status === "pending"}
						<Button
							variant="ghost"
							size="icon"
							class="size-7 text-muted-foreground/60 hover:text-primary hover:bg-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
							onclick={() => handleEdit(task)}
						>
							<SquarePen class="size-3.5" />
						</Button>
					{/if}

					<Button
						variant="ghost"
						size="icon"
						class={cn(
							"size-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
							task.status === "in_progress"
								? "text-muted-foreground/40 cursor-not-allowed"
								: "text-muted-foreground/60 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-100/50 dark:hover:bg-rose-900/30",
						)}
						disabled={task.status === "in_progress"}
						onclick={() => handleDelete(task)}
					>
						<Trash2 class="size-3.5" />
					</Button>
				</div>
			</div>
		</div>
	</div>
{/snippet}

{#snippet loadingSkeleton()}
	<div class="flex flex-col gap-2">
		{#each Array(3) as _, i (i)}
			<div
				class="flex items-center gap-3 px-4 py-3 rounded-xl border bg-white dark:bg-zinc-900 border-border/60"
			>
				<Skeleton class="size-4 shrink-0" />
				<Skeleton class="h-4 flex-1" />
				<Skeleton class="h-6 w-14 rounded-lg" />
			</div>
		{/each}
	</div>
{/snippet}

<div class="flex flex-col gap-2 p-3">
	{#if isLoading}
		{@render loadingSkeleton()}
	{:else if isEmpty}
		<div class="flex items-center justify-center py-12 text-muted-foreground">
			{m.taskboard_empty()}
		</div>
	{:else}
		<!-- Active Tasks (Draggable) -->
		<div
			class="flex flex-col gap-2"
			use:dndzone={{
				items: localTasks,
				flipDurationMs: 200,
				dropTargetStyle: {},
				transformDraggedElement,
				morphDisabled: true,
				autoAriaDisabled: false,
			}}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
		>
			{#each localTasks as task (task.id)}
				<div
					class={cn(task.id === SHADOW_PLACEHOLDER_ITEM_ID && "!hidden")}
					animate:flip={{ duration: 200 }}
					in:scale={draggedElementId || isDndFinalizing
						? { duration: 0 }
						: { duration: 150, start: 0.9 }}
				>
					{@render taskItem(task)}
				</div>
			{/each}
		</div>

		<!-- Done Tasks (Static) -->
		{#if visibleDoneTasks().length > 0}
			<div class="flex flex-col gap-2">
				{#each visibleDoneTasks() as task (task.id)}
					<div animate:flip={{ duration: 200 }}>
						{@render taskItem(task)}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- Edit Task Dialog -->
<TaskEditDialog
	bind:open={editDialogOpen}
	task={editingTask}
	onSave={handleEditSave}
	onClose={handleEditClose}
/>
