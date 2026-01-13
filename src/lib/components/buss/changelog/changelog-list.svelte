<script lang="ts" module>
	import type { ChangelogVersion } from "$lib/api/changelog";

	interface Props {
		versions: ChangelogVersion[];
		currentVersion?: string;
		loading?: boolean;
		error?: string | null;
		onViewMore?: () => void;
		showViewMore?: boolean;
	}
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import semver from "semver";
	import ChangelogItem from "./changelog-item.svelte";

	const {
		versions,
		currentVersion = "",
		loading = false,
		error = null,
		onViewMore,
		showViewMore = false,
	}: Props = $props();

	function isCurrentVersion(version: string): boolean {
		if (!currentVersion) return false;
		try {
			const v = version.replace(/^v/, "");
			const current = currentVersion.replace(/^v/, "");
			return semver.eq(v, current);
		} catch {
			return version === currentVersion;
		}
	}
</script>

<div class="flex flex-col gap-3">
	{#if loading}
		<div class="flex flex-col gap-3">
			{#each Array(3) as _, i (i)}
				<Skeleton class="h-14 w-full rounded-settings-item" />
			{/each}
		</div>
	{:else if error}
		<div class="text-center text-muted-foreground py-4">
			<p class="text-sm">{m.changelog_load_failed()}</p>
		</div>
	{:else if versions.length === 0}
		<div class="text-center text-muted-foreground py-4">
			<p class="text-sm">{m.changelog_empty()}</p>
		</div>
	{:else}
		{#each versions as version, index (version.version)}
			<ChangelogItem
				{version}
				isCurrentVersion={isCurrentVersion(version.version)}
				defaultOpen={index === 0}
			/>
		{/each}

		{#if showViewMore && onViewMore}
			<Button variant="link" class="self-start text-sm p-0 h-auto" onclick={onViewMore}>
				{m.changelog_view_full()}
				<ChevronRightIcon class="size-4 ml-1" />
			</Button>
		{/if}
	{/if}
</div>
