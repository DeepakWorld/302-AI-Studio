<script lang="ts" module>
</script>

<script lang="ts">
	import PromptEditor from "$lib/components/buss/prompt-editor/prompt-editor.svelte";
	import { m } from "$lib/paraglide/messages";
</script>

<PromptEditor wrapperClass="h-full" label={m.text_user_prompt_tempalte()} />
