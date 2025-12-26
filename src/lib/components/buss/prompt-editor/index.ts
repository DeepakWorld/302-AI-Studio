export { default as ClearEditorBtn } from "./clear-editor-btn.svelte";
export { default as PromptEditor } from "./prompt-editor.svelte";
export { default as PromptMenuItem } from "./prompt-menuItem.svelte";
export { default as VariableChip } from "./variable-chip.svelte";

// Nodes
export { $createCustomTextNode, CustomTextNode } from "./nodes/custom-text-node";
export {
	$createVariableValueNode,
	$isVariableValueNode,
	// Svelte 5 compatible aliases ($ prefix is reserved)
	createVariableValueNode,
	isVariableValueNode,
	VariableValueNode,
	type SerializedVariableValueNode,
} from "./nodes/variable-value-node";

// Plugins
export {
	default as ExternalUpdatePlugin,
	UPDATE_CONTENT_COMMAND,
} from "./plugins/external-update-plugin.svelte";
export { default as OnBlurOrFocusPlugin } from "./plugins/on-blur-or-focus-plugin.svelte";
export { default as OnChangePlugin } from "./plugins/on-change-plugin.svelte";
export { default as VariablePlugin } from "./plugins/variable-plugin.svelte";

// Utils
export { editorStateToText, textJsonToEditorState, triggerMatchForDoubleBrace } from "./utils";
