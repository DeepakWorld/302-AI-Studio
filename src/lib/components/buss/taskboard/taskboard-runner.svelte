<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import * as m from "$lib/paraglide/messages";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { cn } from "$lib/utils.js";

	// Derived states from store
	const isRunning = $derived(codeAgentTaskboardState.taskboardStatus === "running");
	const isWaitingToStop = $derived(codeAgentTaskboardState.taskboardStatus === "waiting_to_stop");
	const currentTask = $derived(
		codeAgentTaskboardState.tasklist.find((t) => t.status === "in_progress"),
	);
	const currentTaskContent = $derived(currentTask?.content ?? "—");
	const buttonText = $derived(codeAgentTaskboardState.buttonText);

	function handleRun() {
		codeAgentTaskboardState.startAutoExecution();
	}
</script>

<div class="p-3">
	<div class={cn("flex flex-col gap-2 p-3 rounded-xl border", "bg-input")}>
		<!-- Row 1: Status indicators & buttons (wrap on narrow) -->
		<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
			<!-- Status indicator -->
			<div class="flex items-center gap-2 text-sm">
				{#if isWaitingToStop}
					<span class="flex items-center gap-1.5 text-yellow-500">
						<span class="size-2 rounded-full bg-yellow-500 animate-pulse"></span>
						{m.taskboard_status_waiting_to_stop()}
					</span>
				{:else if isRunning}
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
					disabled={!codeAgentTaskboardState.canStart &&
						!isRunning &&
						!isWaitingToStop &&
						!currentTask}
					onclick={handleRun}
				>
					{buttonText}
				</Button>
			</div>
		</div>
	</div>
</div>
