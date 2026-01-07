<script lang="ts">
	import { downloadSkill } from "$lib/api/skills";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import Button from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import { m } from "$lib/paraglide/messages";
	import { Plus, Search } from "@lucide/svelte";
	import type { Skill } from "@shared/types";
	import { toast } from "svelte-sonner";
	import { SvelteSet } from "svelte/reactivity";
	import SkillCard from "./skill-card.svelte";
	import SkillCreateDialog from "./skill-create-dialog.svelte";
	import SkillDetailDialog from "./skill-detail-dialog.svelte";

	interface Props {
		userSkills: Skill[];
		builtinSkills: Skill[];
		usedSkills?: Skill[];
		title?: string;
		showSearch?: boolean;
		loading?: boolean;
		showNewButton?: boolean;
		onUse?: (skill: Skill) => void;
		onRemove?: (skill: Skill) => void;
	}

	const {
		userSkills,
		builtinSkills,
		usedSkills = [],
		title,
		showSearch = true,
		loading = false,
		showNewButton = true,
		onUse,
		onRemove,
	}: Props = $props();

	let searchQuery = $state("");
	let detailDialogOpen = $state(false);
	let createDialogOpen = $state(false);
	let selectedSkill = $state<Skill | null>(null);
	let downloadingSkills = new SvelteSet<string>();

	// Combine skills with source flag
	const allSkills = $derived<Skill[]>([...builtinSkills, ...userSkills]);

	const filteredSkills = $derived(
		allSkills.filter(
			(item) =>
				item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.description.toLowerCase().includes(searchQuery.toLowerCase()),
		),
	);

	function handleSelectSkill(skill: Skill) {
		selectedSkill = skill;
		detailDialogOpen = true;
	}

	function handleNew() {
		createDialogOpen = true;
	}

	function handleEdit(skill: Skill) {
		console.log("Edit skill:", skill.name);
	}

	async function handleDownload(skill: Skill) {
		// 防止重复点击
		if (downloadingSkills.has(skill.name)) return;

		downloadingSkills.add(skill.name);

		const toastId = toast.loading(m.skills_downloading());
		try {
			const blob = await downloadSkill(skill.name, skill.isBuiltin);

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${skill.name}.zip`;
			a.click();
			URL.revokeObjectURL(url);

			toast.dismiss(toastId);
			toast.success(m.skills_download_success());
		} catch (e) {
			console.error("Failed to download skill:", e);
			toast.dismiss(toastId);
			toast.error(m.skills_download_failed());
		} finally {
			downloadingSkills.delete(skill.name);
		}
	}

	function handleDelete(skill: Skill) {
		console.log("Delete skill:", skill.name);
	}
</script>

<div class="flex flex-col gap-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		{#if title}
			<h1 class="text-lg font-medium text-[#333333] dark:text-[#E6E6E6]">{title}</h1>
		{/if}
	</div>

	<!-- Search and New Button -->
	{#if showSearch || showNewButton}
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
			{#if showNewButton}
				<Button class="gap-2 bg-violet-500 hover:bg-violet-600" onclick={handleNew}>
					<Plus class="h-4 w-4" />
					{m.skills_new()}
				</Button>
			{/if}
		</div>
	{/if}

	<!-- Skills Grid -->
	{#if loading}
		<div class="flex h-48 items-center justify-center text-primary">
			<LdrsLoader type="dot-pulse" size={40} />
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			{#each filteredSkills as item (item.name)}
				<SkillCard
					skill={item}
					isBuiltin={!!item.isBuiltin}
					isUsed={usedSkills.some((s) => s.name === item.name)}
					onSelect={handleSelectSkill}
					{onUse}
					{onRemove}
					onEdit={handleEdit}
					onDownload={handleDownload}
					onDelete={handleDelete}
					downloading={downloadingSkills.has(item.name)}
				/>
			{/each}
		</div>
		<!-- Empty State -->
		{#if filteredSkills.length === 0}
			<div
				class="text-muted-foreground flex flex-col items-center justify-center py-12 text-center"
			>
				<p>{m.no_search_results()}</p>
			</div>
		{/if}
	{/if}
</div>

<!-- Detail Dialog -->
<SkillDetailDialog
	bind:open={detailDialogOpen}
	skill={selectedSkill}
	downloading={selectedSkill ? downloadingSkills.has(selectedSkill.name) : false}
	{onUse}
	onEdit={handleEdit}
	onDownload={handleDownload}
/>

<!-- Create Dialog -->
<SkillCreateDialog bind:open={createDialogOpen} />
