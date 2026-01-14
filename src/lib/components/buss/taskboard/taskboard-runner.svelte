<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as m from "$lib/paraglide/messages";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { cn } from "$lib/utils.js";
	import { Pause, Play } from "@lucide/svelte";

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
		// codeAgentTaskboardState.taskboardStatus = "running";
		if (!codeAgentTaskboardState.canStart) return;
		codeAgentTaskboardState.startAutoExecution();
	}

	function handlePauseResume() {
		if (isRunning) {
			codeAgentTaskboardState.taskboardStatus = "idle";
		} else {
			codeAgentTaskboardState.taskboardStatus = "running";
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
			<div class="flex items-center gap-2">
				<Button
					variant="default"
					size="sm"
					disabled={isRunning || !hasOpenTasks}
					onclick={handleRun}
				>
					{m.taskboard_button_run()}
				</Button>
				<Button
					variant="outline"
					size="icon"
					class="rounded-full size-9"
					disabled={!hasOpenTasks && !isRunning}
					onclick={handlePauseResume}
				>
					{#if isRunning}
						<Pause class="size-4" />
					{:else}
						<Play class="size-4" />
					{/if}
				</Button>
			</div>
		</div>

		<!-- Row 2: Current task -->
		<div class="flex items-center gap-2 text-sm min-w-0">
			<span class="text-muted-foreground shrink-0">{m.taskboard_label_current()}</span>
			<span class="truncate font-medium">{currentTaskContent}</span>
		</div>
	</div>
</div>
