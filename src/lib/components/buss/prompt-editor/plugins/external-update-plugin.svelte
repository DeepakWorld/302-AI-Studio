<script context="module" lang="ts">
	import { createCommand, type LexicalCommand } from "lexical";

	// Create the command (module-level export)
	export const UPDATE_CONTENT_COMMAND: LexicalCommand<string | null> =
		createCommand("UPDATE_CONTENT_COMMAND");
</script>

<script lang="ts">
	import { getEditor } from "svelte-lexical";
	import {
		$getRoot as getRoot,
		$createParagraphNode as createParagraphNode,
		COMMAND_PRIORITY_EDITOR,
	} from "lexical";
	import { onMount } from "svelte";
	import { textJsonToEditorState } from "../utils";

	const editor = getEditor();

	onMount(() => {
		return editor.registerCommand(
			UPDATE_CONTENT_COMMAND,
			(payload: string | null) => {
				editor.update(() => {
					const root = getRoot();
					root.clear();

					if (payload) {
						const newState = textJsonToEditorState(payload);
						if (newState) {
							const newEditorState = editor.parseEditorState(newState);
							editor.setEditorState(newEditorState);
						}
					} else {
						const paragraph = createParagraphNode();
						root.append(paragraph);
					}
				});
				return true;
			},
			COMMAND_PRIORITY_EDITOR,
		);
	});
</script>
