<script lang="ts">
	import Input from "$lib/components/ui/input/input.svelte";
	import { Label } from "$lib/components/ui/label";
	import Textarea from "$lib/components/ui/textarea/textarea.svelte";
	import { m } from "$lib/paraglide/messages";
	import { toast } from "svelte-sonner";

	export interface SkillFormData {
		name: string;
		description: string;
		content: string;
	}

	interface Props {
		formData: SkillFormData;
	}

	let { formData = $bindable() }: Props = $props();

	export function validate(): boolean {
		if (!formData.name.trim()) {
			toast.warning(m.skills_form_name_required());
			return false;
		}
		if (!formData.description.trim()) {
			toast.warning(m.skills_form_desc_required());
			return false;
		}
		if (!formData.content.trim()) {
			toast.warning(m.skills_form_content_required());
			return false;
		}
		return true;
	}
</script>

<div class="space-y-4 px-6 py-6">
	<div class="space-y-2">
		<Label for="skill-name" class="text-sm font-medium">
			{m.skills_form_name()} <span class="text-destructive">*</span>
		</Label>
		<Input
			id="skill-name"
			bind:value={formData.name}
			placeholder={m.skills_form_name_placeholder()}
		/>
	</div>

	<div class="space-y-2">
		<Label for="skill-desc" class="text-sm font-medium">
			{m.skills_form_desc()} <span class="text-destructive">*</span>
		</Label>
		<Input
			id="skill-desc"
			bind:value={formData.description}
			placeholder={m.skills_form_desc_placeholder()}
		/>
	</div>

	<div class="space-y-2">
		<Label for="skill-content" class="text-sm font-medium">
			{m.skills_form_content()} <span class="text-destructive">*</span>
		</Label>
		<Textarea
			id="skill-content"
			bind:value={formData.content}
			class="min-h-[200px] max-h-[300px] w-full resize-none overflow-y-auto font-mono text-sm"
		/>
		<p class="text-muted-foreground text-xs">{m.skills_form_content_hint()}</p>
	</div>
</div>
