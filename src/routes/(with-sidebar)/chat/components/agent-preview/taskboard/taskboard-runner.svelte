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
	<div class={cn("flex items-center gap-3 p-3 rounded-xl border", "bg-input")}>
		<!-- Left: Status & Current Task -->
		<div class="flex-1 min-w-0 flex flex-col gap-1">
			<!-- Status indicators -->
			<div class="flex items-center gap-3 text-sm">
				<span
					class={cn(
						"flex items-center gap-1.5",
						isRunning ? "text-primary" : "text-muted-foreground",
					)}
				>
					<span
						class={cn(
							"size-2 rounded-full",
							isRunning ? "bg-primary animate-pulse" : "bg-muted-foreground/50",
						)}
					></span>
					{m.taskboard_status_running()}
				</span>
				<span class="text-muted-foreground/30">/</span>
				<span
					class={cn(
						"flex items-center gap-1.5",
						!isRunning ? "text-destructive" : "text-muted-foreground",
					)}
				>
					<span
						class={cn(
							"size-2 rounded-full",
							!isRunning ? "bg-destructive" : "bg-muted-foreground/50",
						)}
					></span>
					{m.taskboard_button_stop()}
				</span>
			</div>

			<!-- Current task -->
			<div class="flex items-center gap-2 text-sm">
				<span class="text-muted-foreground shrink-0">{m.taskboard_label_current()}</span>
				<span class="truncate font-medium">{currentTaskContent}</span>
			</div>
		</div>

		<!-- Right: Run button & Pause button -->
		<div class="flex items-center gap-2 shrink-0">
			<Button variant="default" size="sm" disabled={isRunning || !hasOpenTasks} onclick={handleRun}>
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
</div>
