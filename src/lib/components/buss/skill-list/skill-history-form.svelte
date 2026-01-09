<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible/index.js";
	import { Input } from "$lib/components/ui/input";
	import { m } from "$lib/paraglide/messages";
	import { claudeCodeSandboxState } from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { ChevronDown, Search } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { SvelteSet } from "svelte/reactivity";

	// Get grouped sessions from the actual store
	const groupedSessions = $derived(claudeCodeSandboxState.groupedSessions);

	let selectedId = $state<string | null>(null);
	let expandedSandboxes = $state<Set<string>>(new Set());
	let searchQuery = $state("");

	// Filter groups based on search query
	const filteredGroups = $derived.by(() => {
		if (!searchQuery.trim()) {
			return groupedSessions.groups;
		}
		const query = searchQuery.toLowerCase();
		return groupedSessions.groups
			.map((group) => ({
				...group,
				items: group.items.filter(
					(session) =>
						session.label.toLowerCase().includes(query) ||
						group.groupLabel.toLowerCase().includes(query),
				),
			}))
			.filter((group) => group.items.length > 0);
	});

	// Initialize expanded state - default to collapsed
	// expandedSandboxes starts as empty Set, so all groups are collapsed by default

	function toggleSandbox(sandboxId: string) {
		const newSet = new SvelteSet(expandedSandboxes);
		if (newSet.has(sandboxId)) {
			newSet.delete(sandboxId);
		} else {
			newSet.add(sandboxId);
		}
		expandedSandboxes = newSet;
	}

	export function validate(): boolean {
		if (!selectedId) {
			toast.warning(m.skills_history_select_required());
			return false;
		}
		return true;
	}

	export function getSelectedConversation() {
		for (const group of groupedSessions.groups) {
			const session = group.items.find((s) => s.value === selectedId);
			if (session) {
				return {
					sessionId: session.value,
					title: session.label,
					sandboxId: group.groupKey,
					sandboxLabel: group.groupLabel,
					extra: session.extra,
				};
			}
		}
		return null;
	}
</script>

<div class="flex flex-col px-6 py-6">
	<!-- Search box -->
	<div class="relative w-full mb-4">
		<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			type="text"
			placeholder={m.placeholder_input_search()}
			bind:value={searchQuery}
			class="pl-9 h-10 rounded-lg dark:border-[#3d3d3d]"
		/>
	</div>

	<!-- Grouped conversation list -->
	<div class="flex w-full flex-col gap-1 max-h-[350px] overflow-y-auto">
		{#if filteredGroups.length === 0}
			<div class="text-muted-foreground text-center text-sm py-8">
				{searchQuery ? m.no_search_results() : m.no_sessions()}
			</div>
		{:else}
			{#each filteredGroups as group (group.groupKey)}
				{@const isExpanded = expandedSandboxes.has(group.groupKey)}
				<Collapsible.Root open={isExpanded} onOpenChange={() => toggleSandbox(group.groupKey)}>
					<!-- Sandbox header (collapsible trigger) -->
					<Collapsible.Trigger
						class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
					>
						<ChevronDown
							class="text-muted-foreground h-3.5 w-3.5 transition-transform duration-200 {isExpanded
								? ''
								: '-rotate-90'}"
						/>
						<span class="text-foreground text-sm font-medium">{group.groupLabel}</span>
						<span class="text-muted-foreground text-xs">({group.items.length})</span>
					</Collapsible.Trigger>

					<!-- Sessions list -->
					<Collapsible.Content class="ml-5 mt-0.5 flex flex-col gap-0.5">
						{#each group.items as session (session.value)}
							{@const isSelected = selectedId === session.value}
							<button
								type="button"
								class="w-full rounded-md px-3 py-2 text-left transition-all {isSelected
									? 'bg-primary/10 text-primary'
									: 'hover:bg-muted/50'}"
								onclick={() => {
									selectedId = session.value;
								}}
							>
								<div class="flex items-center justify-between gap-3">
									<span class="text-sm truncate {isSelected ? 'font-medium' : ''}"
										>{session.label}</span
									>
									{#if session.extra}
										<span class="text-muted-foreground text-xs whitespace-nowrap">
											{new Date(session.extra).toLocaleString(undefined, {
												month: "2-digit",
												day: "2-digit",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
									{/if}
								</div>
							</button>
						{/each}
					</Collapsible.Content>
				</Collapsible.Root>
			{/each}
		{/if}
	</div>
</div>
