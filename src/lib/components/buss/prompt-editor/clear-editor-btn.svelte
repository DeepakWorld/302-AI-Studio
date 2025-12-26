<script lang="ts" module>
	export interface Props {
		reset?: () => void;
	}
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as m from "$lib/paraglide/messages.js";
	import { RotateCcw } from "@lucide/svelte";
	import {
		$createParagraphNode as createParagraphNode,
		$createTextNode as createTextNode,
		$getRoot as getRoot,
	} from "lexical";
	import { getEditor } from "svelte-lexical";

	const editor = getEditor();

	let { reset }: Props = $props();

	function handleClear() {
		if (reset) {
			reset();
			return;
		}

		// Default behavior: clear and create valid empty state
		editor.update(() => {
			const root = getRoot();
			root.clear();

			// Create a valid empty state with an empty paragraph
			const p = createParagraphNode();
			const textNode = createTextNode("");
			p.append(textNode);
			root.append(p);

			textNode.select();
		});

		editor.focus();
	}
</script>

<Button
	class="hover:!bg-chat-action-hover"
	variant="ghost"
	size="icon-sm"
	onclick={handleClear}
	title={m.prompt_editor_clear()}
>
	<RotateCcw />
</Button>
