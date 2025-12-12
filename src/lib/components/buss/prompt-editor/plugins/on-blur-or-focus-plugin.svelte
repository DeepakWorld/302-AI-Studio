<script lang="ts">
	import { BLUR_COMMAND, COMMAND_PRIORITY_LOW, FOCUS_COMMAND } from "lexical";
	import { onMount } from "svelte";
	import { getEditor } from "svelte-lexical";

	interface Props {
		onFocus?: () => void;
		onBlur?: () => void;
	}

	let { onFocus, onBlur }: Props = $props();

	const editor = getEditor();

	onMount(() => {
		const unregisterFocus = editor.registerCommand(
			FOCUS_COMMAND,
			() => {
				onFocus?.();
				return false;
			},
			COMMAND_PRIORITY_LOW,
		);

		const unregisterBlur = editor.registerCommand(
			BLUR_COMMAND,
			() => {
				onBlur?.();
				return false;
			},
			COMMAND_PRIORITY_LOW,
		);

		return () => {
			unregisterFocus();
			unregisterBlur();
		};
	});
</script>
