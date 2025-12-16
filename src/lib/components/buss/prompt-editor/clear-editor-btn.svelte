<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as m from "$lib/paraglide/messages.js";
	import { RotateCcw } from "@lucide/svelte";
	import { $getRoot as getRoot } from "lexical";
	import { getEditor } from "svelte-lexical";

	const editor = getEditor();

	function handleClear() {
		editor.update(() => {
			const root = getRoot();
			root.clear();
		});
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
