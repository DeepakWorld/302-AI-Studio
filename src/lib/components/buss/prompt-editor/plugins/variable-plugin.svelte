<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { computePosition, flip, offset, shift } from "@floating-ui/dom";
	import {
		$getSelection as getSelection,
		$insertNodes as insertNodes,
		$isRangeSelection as isRangeSelection,
		TextNode,
	} from "lexical";
	import { onMount, tick } from "svelte";
	import { getEditor } from "svelte-lexical";
	import { CustomTextNode } from "../nodes/custom-text-node";
	import { createVariableValueNode } from "../nodes/variable-value-node";
	import PromptMenuItem from "../prompt-menuItem.svelte";

	interface Props {
		isSystemPrompt?: boolean;
	}

	let { isSystemPrompt = false }: Props = $props();

	const editor = getEditor();

	// Preset variables
	const PRESET_VARIABLES = [
		{ key: "input", labelKey: "input" },
		{ key: "date", labelKey: "date" },
		{ key: "time", labelKey: "time" },
		{ key: "datetime", labelKey: "datetime" },
		{ key: "now", labelKey: "now" },
		{ key: "model_id", labelKey: "model_id" },
	] as const;

	let isOpen = $state(false);
	let selectedIndex = $state(0);
	let menuPosition = $state({ x: 0, y: 0 });
	let triggerMatch: {
		leadOffset: number;
		matchingString: string;
		replaceableString: string;
	} | null = $state(null);
	let menuRef: HTMLElement | undefined = $state();
	// Flag to prevent update listener from interfering during selection
	let isSelecting = $state(false);

	const options = $derived(
		PRESET_VARIABLES.filter((v) => {
			if (isSystemPrompt) return v.key !== "input";
			return true;
		}),
	);

	function getVariableLabel(key: string): string {
		const labels: Record<string, string> = {
			input: m.prompt_variable_input(),
			date: m.prompt_variable_date(),
			time: m.prompt_variable_time(),
			datetime: m.prompt_variable_datetime(),
			now: m.prompt_variable_now(),
			model_id: m.prompt_variable_model_id(),
		};
		return labels[key] || key;
	}

	function triggerMatchForDoubleBrace(text: string): {
		leadOffset: number;
		matchingString: string;
		replaceableString: string;
	} | null {
		const triggerIndex = text.lastIndexOf("{{");
		if (triggerIndex === -1) return null;

		const afterTrigger = text.slice(triggerIndex + 2);
		// Check if there's a closing brace, which means it's already completed
		if (afterTrigger.includes("}}")) return null;

		// Close menu if there are any characters after {{ (including spaces)
		// Only show menu when user just typed {{
		if (afterTrigger.length > 0) return null;

		return {
			leadOffset: triggerIndex,
			matchingString: afterTrigger,
			replaceableString: text.slice(triggerIndex),
		};
	}

	function checkForTrigger() {
		// Don't check during selection process
		if (isSelecting) return;

		editor.getEditorState().read(() => {
			const selection = getSelection();
			if (!isRangeSelection(selection) || !selection.isCollapsed()) {
				closeMenu();
				return;
			}

			const anchor = selection.anchor;
			const anchorNode = anchor.getNode();

			if (!(anchorNode instanceof TextNode)) {
				closeMenu();
				return;
			}

			const textContent = anchorNode.getTextContent();
			const anchorOffset = anchor.offset;
			const textBeforeCursor = textContent.slice(0, anchorOffset);

			const match = triggerMatchForDoubleBrace(textBeforeCursor);
			if (match) {
				triggerMatch = match;
				openMenu();
			} else {
				closeMenu();
			}
		});
	}

	async function openMenu() {
		isOpen = true;
		selectedIndex = 0;

		// Calculate menu position
		const domSelection = window.getSelection();
		if (domSelection && domSelection.rangeCount > 0) {
			const range = domSelection.getRangeAt(0);
			const rect = range.getBoundingClientRect();

			// Create virtual reference element
			const virtualEl = {
				getBoundingClientRect: () => rect,
			};

			await tick();

			if (menuRef) {
				const { x, y } = await computePosition(virtualEl as Element, menuRef, {
					placement: "bottom-start",
					middleware: [offset(4), flip(), shift({ padding: 8 })],
				});
				menuPosition = { x, y };
			}
		}
	}

	function closeMenu() {
		isOpen = false;
		triggerMatch = null;
	}

	function selectOption(variableKey: string) {
		// Save triggerMatch before any updates
		const savedTriggerMatch = triggerMatch;
		if (!savedTriggerMatch) return;

		// Set flag to prevent update listener interference
		isSelecting = true;

		editor.update(() => {
			const selection = getSelection();
			if (!isRangeSelection(selection)) return;

			const anchor = selection.anchor;
			const anchorNode = anchor.getNode();

			if (!(anchorNode instanceof TextNode)) return;

			// Remove the trigger characters
			const textContent = anchorNode.getTextContent();
			const beforeTrigger = textContent.slice(0, savedTriggerMatch.leadOffset);
			const afterCursor = textContent.slice(anchor.offset);

			if (beforeTrigger || afterCursor) {
				anchorNode.setTextContent(beforeTrigger + afterCursor);
				// Set selection after the remaining text before trigger
				anchorNode.select(beforeTrigger.length, beforeTrigger.length);
			} else {
				anchorNode.remove();
			}

			// Insert the variable node
			insertNodes([createVariableValueNode(variableKey)]);
		});

		closeMenu();
		// Reset flag after a short delay to allow updates to complete
		setTimeout(() => {
			isSelecting = false;
		}, 0);
	}

	onMount(() => {
		const unregisterUpdate = editor.registerUpdateListener(() => {
			checkForTrigger();
		});

		const unregisterTransform = editor.registerNodeTransform(CustomTextNode, (node) => {
			const textContent = node.getTextContent();
			// Regex to match {{#variableName#}}
			const regex = /\{\{#([a-zA-Z0-9_]+)#\}\}/;
			const match = regex.exec(textContent);

			if (!match) return;

			const [fullMatch, variableName] = match;
			const startIndex = match.index;

			let targetNode: TextNode = node;
			if (startIndex > 0) {
				targetNode = node.splitText(startIndex)[1];
			}

			let nodeToReplace = targetNode;
			if (fullMatch.length < targetNode.getTextContent().length) {
				nodeToReplace = targetNode.splitText(fullMatch.length)[0];
			}

			const variableNode = createVariableValueNode(variableName);
			nodeToReplace.replace(variableNode);
		});

		// Use DOM event listener to capture arrow keys before Lexical processes them
		const rootElement = editor.getRootElement();
		const handleKeyDown = (event: KeyboardEvent) => {
			if (!isOpen) return;

			switch (event.key) {
				case "ArrowDown":
					event.preventDefault();
					event.stopPropagation();
					selectedIndex = (selectedIndex + 1) % options.length;
					break;
				case "ArrowUp":
					event.preventDefault();
					event.stopPropagation();
					selectedIndex = (selectedIndex - 1 + options.length) % options.length;
					break;
				case "Enter":
					event.preventDefault();
					event.stopPropagation();
					selectOption(options[selectedIndex].key);
					break;
				case "Tab":
					event.preventDefault();
					event.stopPropagation();
					selectOption(options[selectedIndex].key);
					break;
				case "Escape":
					event.preventDefault();
					event.stopPropagation();
					closeMenu();
					break;
			}
		};

		rootElement?.addEventListener("keydown", handleKeyDown, true);

		return () => {
			unregisterUpdate();
			unregisterTransform();
			rootElement?.removeEventListener("keydown", handleKeyDown, true);
		};
	});
</script>

{#if isOpen}
	<div
		bind:this={menuRef}
		class="fixed z-50 min-w-48 rounded-xl border bg-overlay p-1 text-overlay-fg shadow-lg"
		style="left: {menuPosition.x}px; top: {menuPosition.y}px;"
	>
		{#each options as option, index (option.key)}
			<PromptMenuItem
				title={getVariableLabel(option.key)}
				isSelected={selectedIndex === index}
				onclick={() => selectOption(option.key)}
				onmouseenter={() => (selectedIndex = index)}
			/>
		{/each}
	</div>
{/if}
