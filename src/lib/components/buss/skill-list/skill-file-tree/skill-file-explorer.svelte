<script lang="ts">
	import CodeMirrorEditor from "$lib/components/buss/editor/codemirror-editor.svelte";
	import * as Resizable from "$lib/components/ui/resizable";
	import { mode } from "mode-watcher";
	import SkillFileTree from "./skill-file-tree.svelte";

	interface Props {
		rootPath: string;
	}

	let { rootPath }: Props = $props();
	let fileContent = $state("");
	let filePath = $state("");

	function handleFileSelect(file: { path: string; content: string }) {
		fileContent = file.content;
		filePath = file.path;
	}

	// Determine language from file extension
	let language = $derived(filePath.split(".").pop() || "txt");
</script>

<div class="h-full w-full">
	<Resizable.PaneGroup direction="horizontal" class="h-full w-full rounded-lg border">
		<Resizable.Pane defaultSize={25} minSize={15} maxSize={40}>
			<div class="h-full p-2">
				<SkillFileTree {rootPath} onSelect={handleFileSelect} />
			</div>
		</Resizable.Pane>
		<Resizable.Handle />
		<Resizable.Pane defaultSize={75}>
			<div class="h-full border-l bg-background">
				{#if fileContent}
					<CodeMirrorEditor
						value={fileContent}
						{language}
						theme={mode.current === "dark" ? "dark" : "light"}
						readOnly={true}
					/>
				{:else}
					<div class="flex h-full items-center justify-center text-muted-foreground">
						Select a file to view content
					</div>
				{/if}
			</div>
		</Resizable.Pane>
	</Resizable.PaneGroup>
</div>
