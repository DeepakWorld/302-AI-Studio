<script lang="ts" module>
	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}
</script>

<script lang="ts">
	import * as Sheet from "$lib/components/ui/sheet/index.js";
	import * as ScrollArea from "$lib/components/ui/scroll-area/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { changelogState } from "$lib/stores/changelog-state.svelte";
	import ChangelogList from "./changelog-list.svelte";
	import { onMount } from "svelte";
	import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
	import { Button } from "$lib/components/ui/button/index.js";

	let { open = $bindable(false), onOpenChange }: Props = $props();

	function handleOpenChange(isOpen: boolean) {
		open = isOpen;
		onOpenChange?.(isOpen);
	}

	// Fetch all changelog when sheet opens
	$effect(() => {
		if (open && changelogState.versions.length === 0) {
			changelogState.fetchAll();
		}
	});
</script>

<Sheet.Root bind:open onOpenChange={handleOpenChange}>
	<Sheet.Content side="right" class="w-full sm:max-w-md flex flex-col">
		<Sheet.Header class="flex-shrink-0">
			<div class="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon-sm"
					onclick={() => handleOpenChange(false)}
					class="size-8"
				>
					<ArrowLeftIcon class="size-4" />
				</Button>
				<Sheet.Title>{m.changelog_title()}</Sheet.Title>
			</div>
		</Sheet.Header>

		<ScrollArea.Root class="flex-1 -mx-6 px-6">
			<div class="py-4">
				<ChangelogList
					versions={changelogState.versions}
					currentVersion={changelogState.currentVersion}
					loading={changelogState.loading}
					error={changelogState.error}
					showViewMore={false}
				/>
			</div>
		</ScrollArea.Root>
	</Sheet.Content>
</Sheet.Root>
