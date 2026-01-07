<script lang="ts">
	import { listSkills } from "$lib/api/skills/base-apis";
	import { SkillList } from "$lib/components/buss/skill-list";
	import { m } from "$lib/paraglide/messages";
	import type { Skill } from "@shared/types";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	let builtinSkills = $state<Skill[]>([]);
	let userSkills = $state<Skill[]>([]);
	let loading = $state(true);

	async function loadSkills() {
		loading = true;
		try {
			const response = await listSkills({});
			builtinSkills = response.builtin_skills;
			userSkills = [...response.user_skills, ...response.project_skills];
		} catch (e) {
			console.error("Failed to load skills:", e);
			toast.error(m.skills_load_failed());
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadSkills();
	});
</script>

<div class="pb-settings-layout-pb">
	<SkillList title={m.skills_title()} {builtinSkills} {userSkills} {loading} />
</div>
