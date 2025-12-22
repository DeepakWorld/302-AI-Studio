<script lang="ts" module>
</script>

<script lang="ts">
	import { $createVariableValueNode as createVariableValueNode } from "$lib/components/buss/prompt-editor/nodes/variable-value-node";
	import PromptEditor from "$lib/components/buss/prompt-editor/prompt-editor.svelte";
	import { m } from "$lib/paraglide/messages";
	import { chatParameters } from "$lib/stores/chat-paramters/chat-parameters.svelte";
	import {
		$createParagraphNode as createParagraphNode,
		$getRoot as getRoot,
		type LexicalEditor,
	} from "lexical";

	function handleEditorReady(editor: LexicalEditor) {
		chatParameters.setUserPromptTemplateEditorRef(editor);
	}

	function handleReset() {
		const DEFAULT_INPUT_VARIABLE_NAME = "input";
		const editor = chatParameters.userPromptTemplateEditorRef;
		if (!editor) return;

		editor.update(() => {
			const root = getRoot();
			root.clear();

			const p = createParagraphNode();
			const variableNode = createVariableValueNode(DEFAULT_INPUT_VARIABLE_NAME);

			p.append(variableNode);
			root.append(p);

			variableNode.selectNext();
		});

		editor.focus();
	}
</script>

<PromptEditor
	bind:value={chatParameters.userPromptTemplateRawJson}
	class="min-h-[150px]"
	label={m.text_user_prompt_tempalte()}
	onEditorReady={handleEditorReady}
	canReset
	onReset={handleReset}
	onchange={(content, rawJson) => chatParameters.handleEditorChange(content, rawJson, false)}
/>
