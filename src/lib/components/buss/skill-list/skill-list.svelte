<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import { m } from "$lib/paraglide/messages";
	import { Plus, Search } from "@lucide/svelte";
	import type { Skill } from "@shared/types";
	import SkillCard from "./skill-card.svelte";
	import SkillDetailDialog from "./skill-detail-dialog.svelte";

	interface SkillWithSource {
		skill: Skill;
		isBuiltin: boolean;
	}

	interface Props {
		userSkills: Skill[];
		builtinSkills: Skill[];
		title?: string;
		showSearch?: boolean;
		onNew?: () => void;
		onUse?: (skill: Skill) => void;
		onEdit?: (skill: Skill) => void;
		onDownload?: (skill: Skill) => void;
		onDelete?: (skill: Skill) => void;
	}

	const {
		userSkills,
		builtinSkills,
		title = m.skills_title(),
		showSearch = true,
		onNew,
		onUse,
		onEdit,
		onDownload,
		onDelete,
	}: Props = $props();

	let searchQuery = $state("");
	let detailDialogOpen = $state(false);
	let selectedSkill = $state<Skill | null>(null);

	// Combine skills with source flag
	const allSkills = $derived<SkillWithSource[]>([
		...builtinSkills.map((skill) => ({ skill, isBuiltin: true })),
		...userSkills.map((skill) => ({ skill, isBuiltin: false })),
	]);

	const filteredSkills = $derived(
		allSkills.filter(
			(item) =>
				item.skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.skill.description.toLowerCase().includes(searchQuery.toLowerCase()),
		),
	);

	function handleSelectSkill(skill: Skill) {
		selectedSkill = skill;
		detailDialogOpen = true;
	}
</script>

<div class="flex flex-col gap-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-semibold">{title}</h1>
	</div>

	<!-- Search and New Button -->
	{#if showSearch || onNew}
		<div class="flex items-center gap-3">
			{#if showSearch}
				<div class="relative flex-1">
					<Search class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
					<Input
						type="text"
						placeholder={m.skills_search_placeholder()}
						class="pl-9"
						bind:value={searchQuery}
					/>
				</div>
			{/if}
			{#if onNew}
				<Button class="gap-2 bg-violet-500 hover:bg-violet-600" onclick={onNew}>
					<Plus class="h-4 w-4" />
					{m.skills_new()}
				</Button>
			{/if}
		</div>
	{/if}

	<!-- Skills Grid -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		{#each filteredSkills as item (item.skill.name)}
			<SkillCard
				skill={item.skill}
				isBuiltin={item.isBuiltin}
				onSelect={handleSelectSkill}
				{onUse}
				{onEdit}
				{onDownload}
				{onDelete}
			/>
		{/each}
	</div>

	<!-- Empty State -->
	{#if filteredSkills.length === 0}
		<div class="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
			<p>{m.no_search_results()}</p>
		</div>
	{/if}
</div>

<!-- Detail Dialog -->
<SkillDetailDialog
	bind:open={detailDialogOpen}
	skill={selectedSkill}
	{onUse}
	{onEdit}
	{onDownload}
/>
