<script lang="ts" module>
	import type { ChangelogVersion } from "$lib/api/changelog";

	interface Props {
		version: ChangelogVersion;
		isCurrentVersion?: boolean;
		defaultOpen?: boolean;
	}
</script>

<script lang="ts">
	import { Badge } from "$lib/components/ui/badge/index.js";
	import * as Collapsible from "$lib/components/ui/collapsible/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";

	const { version, isCurrentVersion = false, defaultOpen = false }: Props = $props();

	let open = $state(defaultOpen);

	const hasNew = $derived((version.changes.new?.length ?? 0) > 0);
	const hasImproved = $derived((version.changes.improved?.length ?? 0) > 0);
	const hasFixed = $derived((version.changes.fixed?.length ?? 0) > 0);
</script>

<Collapsible.Root bind:open class="rounded-settings-item bg-settings-item-bg">
	<Collapsible.Trigger
		class="flex w-full cursor-pointer items-center justify-between px-4 py-3 hover:bg-muted/50 rounded-settings-item transition-colors"
	>
		<div class="flex items-center gap-2">
			<span class="font-medium">{version.version}</span>
			{#if isCurrentVersion}
				<Badge class="bg-primary text-primary-foreground text-xs"
					>{m.changelog_current_version()}</Badge
				>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<span class="text-muted-foreground text-sm">{version.date}</span>
			<ChevronDownIcon
				class="size-4 text-muted-foreground transition-transform duration-200 {open
					? 'rotate-180'
					: ''}"
			/>
		</div>
	</Collapsible.Trigger>

	<Collapsible.Content class="px-4 pb-4">
		<div class="flex flex-col gap-3 pt-2">
			{#if hasNew}
				<div class="flex flex-col gap-1.5">
					<span class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
						{m.changelog_new()}:
					</span>
					<ul class="list-inside list-disc space-y-1 pl-1">
						{#each version.changes.new ?? [] as item, i (i)}
							<li class="text-sm text-muted-foreground">
								{item}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if hasImproved}
				<div class="flex flex-col gap-1.5">
					<span class="text-sm font-medium text-blue-600 dark:text-blue-400">
						{m.changelog_improved()}:
					</span>
					<ul class="list-inside list-disc space-y-1 pl-1">
						{#each version.changes.improved ?? [] as item, i (i)}
							<li class="text-sm text-muted-foreground">
								{item}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if hasFixed}
				<div class="flex flex-col gap-1.5">
					<span class="text-sm font-medium text-orange-600 dark:text-orange-400">
						{m.changelog_fixed()}:
					</span>
					<ul class="list-inside list-disc space-y-1 pl-1">
						{#each version.changes.fixed ?? [] as item, i (i)}
							<li class="text-sm text-muted-foreground">
								{item}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</Collapsible.Content>
</Collapsible.Root>
