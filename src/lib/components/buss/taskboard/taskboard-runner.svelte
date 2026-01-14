<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import * as m from "$lib/paraglide/messages";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { cn } from "$lib/utils.js";

	// Derived states from store
	const isRunning = $derived(codeAgentTaskboardState.taskboardStatus === "running");
	const currentTask = $derived(
		codeAgentTaskboardState.tasklist.find((t) => t.status === "in_progress"),
	);
	const hasOpenTasks = $derived(
		codeAgentTaskboardState.tasklist.some((t) => t.status === "pending"),
	);
	const currentTaskContent = $derived(currentTask?.content ?? "—");

	function handleRun() {
		if (isRunning) {
			// 暂停
			codeAgentTaskboardState.taskboardStatus = "idle";
		} else if (currentTask) {
			// 继续（有进行中的任务）
			codeAgentTaskboardState.taskboardStatus = "running";
		} else {
			// 启动新任务
			if (!codeAgentTaskboardState.canStart) return;
			codeAgentTaskboardState.startAutoExecution();
		}
	}
</script>

<div class="p-3">
	<div class={cn("flex flex-col gap-2 p-3 rounded-xl border", "bg-input")}>
		<!-- Row 1: Status indicators & buttons (wrap on narrow) -->
		<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
			<!-- Status indicator -->
			<div class="flex items-center gap-2 text-sm">
				{#if isRunning}
					<span class="flex items-center gap-1.5 text-primary">
						<span class="size-2 rounded-full bg-primary animate-pulse"></span>
						{m.taskboard_status_running()}
					</span>
				{:else}
					<span class="flex items-center gap-1.5 text-muted-foreground">
						<span class="size-2 rounded-full bg-muted-foreground/50"></span>
						{m.taskboard_status_idle()}
					</span>
				{/if}
			</div>

			<!-- Buttons -->
		</div>

		<!-- Row 2: Current task -->
		<div class="flex justify-between">
			<div class="flex items-center gap-2 text-sm min-w-0">
				<span class="text-muted-foreground shrink-0">{m.taskboard_label_current()}</span>
				<span class="truncate font-medium">{currentTaskContent}</span>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="default"
					size="sm"
					disabled={!hasOpenTasks && !isRunning && !currentTask}
					onclick={handleRun}
				>
					{#if isRunning}
						{m.taskboard_button_pause()}
					{:else if currentTask}
						{m.taskboard_button_resume()}
					{:else}
						{m.taskboard_button_run()}
					{/if}
				</Button>
			</div>
		</div>
	</div>
</div>
