<script lang="ts">
	import * as m from "$lib/paraglide/messages";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";

	type FilterValue = "all" | "open" | "done";

	interface Props {
		filter?: FilterValue;
		onFilterChange?: (filter: FilterValue) => void;
	}

	let { filter = "all", onFilterChange }: Props = $props();

	const filterOptions = [
		{ key: "all", label: m.taskboard_filter_all() },
		{ key: "open", label: m.taskboard_filter_open() },
		{ key: "done", label: m.taskboard_filter_done() },
	];

	function handleFilterChange(key: string) {
		onFilterChange?.(key as FilterValue);
	}
</script>

<div class="p-3">
	<SegButton options={filterOptions} selectedKey={filter} onSelect={handleFilterChange} />
</div>
