<script lang="ts">
	import {
		CLICK_COMMAND,
		COMMAND_PRIORITY_LOW,
		$getNodeByKey as getNodeByKey,
		$getSelection as getSelection,
		$isNodeSelection as isNodeSelection,
		KEY_BACKSPACE_COMMAND,
		KEY_DELETE_COMMAND,
		type LexicalEditor,
	} from "lexical";
	import { onMount } from "svelte";
	import { isVariableValueNode } from "./nodes/variable-value-node";

	interface Props {
		variable: string;
		nodeKey: string;
		editor: LexicalEditor;
	}

	let { variable, nodeKey, editor }: Props = $props();

	let isSelected = $state(false);

	function updateSelectionState() {
		editor.getEditorState().read(() => {
			const selection = getSelection();
			if (isNodeSelection(selection)) {
				const node = getNodeByKey(nodeKey);
				isSelected = node !== null && selection.getNodes().includes(node);
			} else {
				isSelected = false;
			}
		});
	}

	function onDelete(event: KeyboardEvent): boolean {
		const selection = getSelection();
		if (isNodeSelection(selection)) {
			const nodes = selection.getNodes();
			const node = getNodeByKey(nodeKey);
			if (node && nodes.includes(node)) {
				event.preventDefault();
				node.remove();
				return true;
			}
		}
		return false;
	}

	onMount(() => {
		// Listen to selection changes to update selected state
		const unregisterUpdate = editor.registerUpdateListener(() => {
			updateSelectionState();
		});

		const unregisterClick = editor.registerCommand(
			CLICK_COMMAND,
			(event: MouseEvent) => {
				const target = event.target as HTMLElement;
				const chipElement = target.closest(`[data-node-key="${nodeKey}"]`);

				if (chipElement) {
					event.preventDefault();
					editor.update(() => {
						const node = getNodeByKey(nodeKey);
						if (node && isVariableValueNode(node)) {
							node.selectNext();
						}
					});
					isSelected = true;
					return true;
				}
				return false;
			},
			COMMAND_PRIORITY_LOW,
		);

		const unregisterBackspace = editor.registerCommand(
			KEY_BACKSPACE_COMMAND,
			onDelete,
			COMMAND_PRIORITY_LOW,
		);

		const unregisterDelete = editor.registerCommand(
			KEY_DELETE_COMMAND,
			onDelete,
			COMMAND_PRIORITY_LOW,
		);

		return () => {
			unregisterUpdate();
			unregisterClick();
			unregisterBackspace();
			unregisterDelete();
		};
	});
</script>

<span
	class="mx-0.5 inline-flex items-center rounded-xs px-0.5 text-primary"
	class:ring-1={isSelected}
	class:ring-ring={isSelected}
	data-node-key={nodeKey}
	contenteditable="false"
>
	{`{{${variable}}}`}
</span>
