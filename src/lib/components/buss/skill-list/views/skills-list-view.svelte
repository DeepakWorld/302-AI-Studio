<script lang="ts">
	import { downloadSkill } from "$lib/api/skills";
	import { deleteSkill } from "$lib/api/skills/base-apis";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import Input from "$lib/components/ui/input/input.svelte";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import { Plus, Search } from "@lucide/svelte";
	import type { Skill } from "@shared/types";
	import { toast } from "svelte-sonner";
	import { SvelteSet } from "svelte/reactivity";
	import SkillCard from "../skill-card.svelte";

	interface Props {
		userSkills: Skill[];
		builtinSkills: Skill[];
		loading?: boolean;
		onRefresh?: () => void;
	}

	let { userSkills, builtinSkills, loading = false, onRefresh }: Props = $props();

	const usedSkills = $derived(codeAgentState.skills);

	let searchQuery = $state("");
	let deleteDialogOpen = $state(false);
	let deletingSkill = $state<Skill | null>(null);
	let isDeleting = $state(false);
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
		skillsPanelState.goToDetail(skill.name);
	}

	function handleNew() {
		skillsPanelState.goToCreateSelect();
	}

	function handleEdit(skill: Skill) {
		skillsPanelState.goToEdit(skill.name);
	}

	async function handleDownload(skill: Skill) {
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
		deletingSkill = skill;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!deletingSkill) return;

		isDeleting = true;
		const toastId = toast.loading(m.skills_deleting());

		try {
			await deleteSkill({ skill_list: [deletingSkill.name] });
			toast.dismiss(toastId);
			toast.success(m.skills_delete_success());
			deleteDialogOpen = false;
			deletingSkill = null;
			onRefresh?.();
		} catch (e) {
			console.error("Failed to delete skill:", e);
			toast.dismiss(toastId);
			toast.error(m.skills_delete_failed());
		} finally {
			isDeleting = false;
		}
	}

	function handleUse(skill: Skill) {
		codeAgentState.handleSkillsUse([skill]);
	}

	function handleRemove(skill: Skill) {
		codeAgentState.handleSkillsRemove([skill]);
	}

	function handleForceUseToggle(skill: Skill, forceUse: boolean) {
		codeAgentState.handleSkillForceUseToggle(skill.name, forceUse);
	}
</script>

<div class="flex h-full flex-col">
	<!-- Search and New Button - Fixed at top -->
	<div class="shrink-0 border-b px-6 py-4">
		<div class="flex items-center gap-3">
			<div class="relative flex-1">
				<Search class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
				<Input
					type="text"
					placeholder={m.skills_search_placeholder()}
					class="border-border bg-transparent pl-9"
					bind:value={searchQuery}
				/>
			</div>
			<Button class="gap-2 bg-violet-500 hover:bg-violet-600" onclick={handleNew}>
				<Plus class="h-4 w-4" />
				{m.skills_new()}
			</Button>
		</div>
	</div>

	<!-- Skills Grid - Scrollable -->
	<div class="flex-1 overflow-y-auto min-h-0 px-6 py-4">
		{#if loading}
			<div class="flex h-48 items-center justify-center text-primary">
				<LdrsLoader type="dot-pulse" size={40} />
			</div>
		{:else}
			<div class="flex flex-col gap-4">
				{#each filteredSkills as item, index (`${item.name}-${item.isBuiltin ? "builtin" : "user"}-${index}`)}
					{@const usedSkill = usedSkills.find((s) => s.name === item.name)}
					<SkillCard
						skill={usedSkill ?? item}
						isBuiltin={!!item.isBuiltin}
						isUsed={!!usedSkill}
						onSelect={handleSelectSkill}
						onUse={handleUse}
						onRemove={handleRemove}
						onEdit={handleEdit}
						onDownload={handleDownload}
						onDelete={handleDelete}
						downloading={downloadingSkills.has(item.name)}
						onForceUseToggle={handleForceUseToggle}
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
</div>

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.skills_confirm_delete_title()}</Dialog.Title>
		</Dialog.Header>
		<Dialog.Description>
			{m.skills_confirm_delete_message({ name: deletingSkill?.name || "" })}
		</Dialog.Description>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)} disabled={isDeleting}>
				{m.text_button_cancel()}
			</Button>
			<Button variant="destructive" onclick={confirmDelete} disabled={isDeleting}>
				{m.text_button_delete()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
