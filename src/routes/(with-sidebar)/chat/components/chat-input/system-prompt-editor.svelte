<script lang="ts" module>
	export const PRESET_SYSTEM_PROMPT = [
		{
			key: "custom-type",
			text: m.text_custom_type(),
		},
		{
			key: "universal-type",
			text: m.text_universal_type(),
		},
		{
			key: "terse-and-effective-type",
			text: m.text_terse_and_effective_type(),
		},
		{
			key: "deep-thinking-type",
			text: m.text_deep_thinking_type(),
		},
	];
</script>

<script lang="ts">
	import PromptEditor from "$lib/components/buss/prompt-editor/prompt-editor.svelte";
	import * as Select from "$lib/components/ui/select/index.js";
	import { m } from "$lib/paraglide/messages";

	let value = $state<string>("custom-type");
</script>

{#snippet right()}
	<Select.Root type="single" bind:value>
		<Select.Trigger>{PRESET_SYSTEM_PROMPT.find((item) => item.key === value)?.text}</Select.Trigger>
		<Select.Content>
			{#each PRESET_SYSTEM_PROMPT as item (item.key)}
				<Select.Item value={item.key} label={item.text} />
			{/each}
		</Select.Content>
	</Select.Root>
{/snippet}

<PromptEditor class="min-h-[300px]" label={m.text_system_prompt()} {right} />
