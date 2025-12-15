<script lang="ts">
	import { cn } from "$lib/utils";
	import { $getRoot as getRoot, TextNode, type LexicalEditor } from "lexical";
	import { onMount } from "svelte";
	import { Composer, ContentEditable, HistoryPlugin, RichTextPlugin } from "svelte-lexical";

	import LabelWithTips from "$lib/components/buss/label-with-tips/label-with-tips.svelte";
	import { Label } from "$lib/components/ui/label";
	import ClearEditorBtn from "./clear-editor-btn.svelte";
	import { CustomTextNode } from "./nodes/custom-text-node";
	import { VariableValueNode } from "./nodes/variable-value-node";
	import ExternalUpdatePlugin from "./plugins/external-update-plugin.svelte";
	import OnBlurOrFocusPlugin from "./plugins/on-blur-or-focus-plugin.svelte";
	import OnChangePlugin from "./plugins/on-change-plugin.svelte";
	import VariablePlugin from "./plugins/variable-plugin.svelte";
	import { textJsonToEditorState } from "./utils";

	interface Props {
		label: string;
		tips?: string;
		value?: string | null;
		isSystemPrompt?: boolean;
		wrapperClass?: string;
		class?: string;
		canReset?: boolean;
		onchange?: (value: string) => void;
		onEditorReady?: (editor: LexicalEditor) => void;
		onFocus?: () => void;
		onBlur?: () => void;
		right?: import("svelte").Snippet;
	}

	let {
		label,
		tips,
		value = $bindable(null),
		isSystemPrompt = false,
		wrapperClass = "",
		class: className = "",
		canReset = false,
		onchange,
		onEditorReady,
		onFocus,
		onBlur,
		right,
	}: Props = $props();

	let composer: Composer | undefined = $state();
	let editorReady = $state(false);

	const initialConfig = {
		namespace: "prompt-editor",
		nodes: [
			VariableValueNode,
			CustomTextNode,
			{
				replace: TextNode,
				with: (node: TextNode) => new CustomTextNode(node.__text),
			},
		],
		editorState: textJsonToEditorState(value),
		onError: (error: Error) => {
			console.error("Lexical error:", error);
		},
	};

	function handleChange() {
		if (!composer || !editorReady) return;
		const editor = composer.getEditor();
		if (!editor) return;

		const text = editor.getEditorState().read(() => {
			return getRoot()
				.getChildren()
				.map((p) => p.getTextContent())
				.join("\n");
		});

		value = text;
		onchange?.(text);
	}

	onMount(() => {
		// Wait for composer to be ready
		const checkReady = setInterval(() => {
			if (composer) {
				const editor = composer.getEditor();
				if (editor) {
					clearInterval(checkReady);
					editorReady = true;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					onEditorReady?.(editor as any);
				}
			}
		}, 50);

		return () => {
			clearInterval(checkReady);
		};
	});
</script>

<Composer {initialConfig} bind:this={composer}>
	<div class="flex flex-col">
		<div class="flex items-center justify-between gap-2">
			{#if tips}
				<LabelWithTips {label} {tips} tooltipPlacement="right" />
			{:else}
				<Label class="text-label-fg">{label}</Label>
			{/if}
			<div class="flex flex-row gap-x-2">
				{#if right}
					{@render right()}
				{/if}
				{#if canReset}
					<ClearEditorBtn />
				{/if}
			</div>
		</div>

		<div
			class={cn(
				"relative rounded-lg border bg-input transition-colors focus-within:ring-2 focus-within:ring-primary",
				wrapperClass,
			)}
		>
			<ContentEditable
				className={cn(
					"h-[150px] w-full resize-none overflow-auto px-3 py-2 text-sm leading-relaxed focus:outline-none",
					"[&_p]:m-0 [&_p]:min-h-[1.5em]",
					className,
				)}
			/>
			<RichTextPlugin />
			<HistoryPlugin />

			<!-- Custom plugins -->
			<VariablePlugin {isSystemPrompt} />
			<ExternalUpdatePlugin />
			<OnBlurOrFocusPlugin {onFocus} {onBlur} />

			<!-- onChange listener -->
			<OnChangePlugin onChange={handleChange} />
		</div>
	</div>
</Composer>

<style>
	:global(.variable-chip-wrapper) {
		display: inline-flex;
		vertical-align: middle;
	}
</style>
