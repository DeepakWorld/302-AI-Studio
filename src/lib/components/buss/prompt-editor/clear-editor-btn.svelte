<script lang="ts">
	import { getEditor } from "svelte-lexical";
	import { $getRoot as getRoot } from "lexical";
	import { Button } from "$lib/components/ui/button";
	import { RotateCcw } from "@lucide/svelte";
	import * as m from "$lib/paraglide/messages.js";

	const editor = getEditor();

	function handleClear() {
		editor.update(() => {
			const root = getRoot();
			root.clear();
		});
	}
</script>

<Button
	variant="ghost"
	size="sm"
	class="h-7 px-2 text-xs"
	onclick={handleClear}
	title={m.prompt_editor_clear()}
>
	<RotateCcw class="h-3.5 w-3.5" />
</Button>
