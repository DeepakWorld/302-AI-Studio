<script lang="ts">
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages";
	import { toast } from "svelte-sonner";

	let githubUrl = $state("");

	export function validate(): boolean {
		if (!githubUrl.trim()) {
			toast.warning(m.skills_github_url_required());
			return false;
		}
		return true;
	}

	export function getGitHubUrl(): string {
		return githubUrl.trim();
	}

	export function reset() {
		githubUrl = "";
	}
</script>

<div class="space-y-4 px-6 py-6">
	<div class="space-y-2">
		<Label for="github-url">{m.skills_github_url_label()}</Label>
		<Input
			id="github-url"
			type="url"
			placeholder={m.skills_github_url_placeholder()}
			bind:value={githubUrl}
			class="dark:border-[#3d3d3d]"
		/>
		<p class="text-muted-foreground text-xs">{m.skills_github_url_desc()}</p>
	</div>
</div>
