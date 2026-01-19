<script lang="ts">
	import { ChangelogList } from "$lib/components/buss/changelog";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as ScrollArea from "$lib/components/ui/scroll-area/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { changelogState } from "$lib/stores/changelog-state.svelte";
	import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
	import { onMount } from "svelte";

	onMount(() => {
		// Fetch all changelog entries when page mounts
		changelogState.fetchAll();
	});
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center gap-2 pb-4">
		<Button variant="ghost" size="icon-sm" href="/settings/about" class="size-8">
			<ArrowLeftIcon class="size-4" />
		</Button>
		<h1 class="text-xl font-medium">{m.changelog_title()}</h1>
	</div>

	<ScrollArea.Root class="-mx-4 flex-1 px-4">
		<div class="pb-6">
			<ChangelogList
				versions={changelogState.versions}
				currentVersion={changelogState.currentVersion}
				loading={changelogState.loading}
				error={changelogState.error}
				showViewMore={false}
			/>
		</div>
	</ScrollArea.Root>
</div>
