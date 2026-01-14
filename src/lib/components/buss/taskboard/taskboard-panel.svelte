<script lang="ts">
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { onMount } from "svelte";
	import TaskboardInput from "./taskboard-input.svelte";
	import TaskboardList from "./taskboard-list.svelte";
	import TaskboardRunner from "./taskboard-runner.svelte";
	import TaskboardTopbar from "./taskboard-topbar.svelte";

	type FilterValue = "all" | "open" | "done";

	let filter = $state<FilterValue>("all");

	// Sync tasklist on mount
	onMount(() => {
		codeAgentTaskboardState.syncTasklist();
	});

	function handleFilterChange(value: FilterValue) {
		filter = value;
	}
</script>

<div class="flex flex-col h-full bg-background">
	<!-- Filter Tabs -->
	<TaskboardTopbar {filter} onFilterChange={handleFilterChange} />

	<!-- Task List -->
	<div class="flex-1 overflow-auto">
		<TaskboardList {filter} />
	</div>

	<!-- Runner -->
	<TaskboardRunner />

	<!-- Bottom Input -->
	<TaskboardInput />
</div>
