<script context="module" lang="ts">
	import { createCommand, type LexicalCommand } from "lexical";

	export const UPDATE_CONTENT_COMMAND: LexicalCommand<string> =
		createCommand("UPDATE_CONTENT_COMMAND");
</script>

<script lang="ts">
	import { COMMAND_PRIORITY_EDITOR } from "lexical";
	import { onMount } from "svelte";
	import { getEditor } from "svelte-lexical";

	const editor = getEditor();

	onMount(() => {
		return editor.registerCommand(
			UPDATE_CONTENT_COMMAND,
			(value: string) => {
				const parsed = editor.parseEditorState(value);
				editor.setEditorState(parsed);
				return true;
			},
			COMMAND_PRIORITY_EDITOR,
		);
	});
</script>
