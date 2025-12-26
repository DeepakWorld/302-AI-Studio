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
	import { UPDATE_CONTENT_COMMAND } from "$lib/components/buss/prompt-editor/plugins/external-update-plugin.svelte";
	import PromptEditor from "$lib/components/buss/prompt-editor/prompt-editor.svelte";
	import * as Select from "$lib/components/ui/select/index.js";
	import { m } from "$lib/paraglide/messages";
	import { chatParameters } from "$lib/stores/chat-paramters/chat-parameters.svelte";
	import type { LexicalEditor } from "lexical";
	// Import preset templates
	import deepThinkingType from "./preset-prompt-templates/deep-thinking-type.json";
	import terseAndEffectiveType from "./preset-prompt-templates/terse-and-effective-type.json";
	import universalType from "./preset-prompt-templates/universal-type.json";

	const PRESET_PROMPT_MAP: Record<string, string> = {
		"universal-type": JSON.stringify(universalType),
		"terse-and-effective-type": JSON.stringify(terseAndEffectiveType),
		"deep-thinking-type": JSON.stringify(deepThinkingType),
	};

	function handlePresetChange(newValue: string) {
		if (!newValue || !chatParameters.systemPromptEditorRef) return;

		const prompt = PRESET_PROMPT_MAP[newValue];

		// 1. First: mark as preset update (before editor triggers onchange)
		chatParameters.startPresetChange(newValue);

		// 2. Then: dispatch command to update editor content
		if (prompt) {
			chatParameters.systemPromptEditorRef.dispatchCommand(UPDATE_CONTENT_COMMAND, prompt);
		}
	}

	function handleEditorReady(editor: LexicalEditor) {
		chatParameters.setSystemPromptEditorRef(editor);
	}
</script>

{#snippet right()}
	<Select.Root
		type="single"
		value={chatParameters.systemPromptPresetType}
		onValueChange={handlePresetChange}
	>
		<Select.Trigger
			>{PRESET_SYSTEM_PROMPT.find((item) => item.key === chatParameters.systemPromptPresetType)
				?.text}
		</Select.Trigger>
		<Select.Content>
			{#each PRESET_SYSTEM_PROMPT as item (item.key)}
				<Select.Item value={item.key} label={item.text} />
			{/each}
		</Select.Content>
	</Select.Root>
{/snippet}

<PromptEditor
	bind:value={chatParameters.systemPromptRawJson}
	class="min-h-[150px]"
	label={m.text_system_prompt()}
	{right}
	isSystemPrompt
	onEditorReady={handleEditorReady}
	canReset
	onchange={(content, rawJson) => chatParameters.handleEditorChange(content, rawJson, true)}
/>
