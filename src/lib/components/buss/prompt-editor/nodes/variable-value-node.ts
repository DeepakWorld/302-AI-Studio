import {
	$applyNodeReplacement,
	DecoratorNode,
	type DOMConversionMap,
	type DOMConversionOutput,
	type DOMExportOutput,
	type LexicalEditor,
	type LexicalNode,
	type NodeKey,
	type SerializedLexicalNode,
	type Spread,
} from "lexical";
import VariableChip from "../variable-chip.svelte";

export type SerializedVariableValueNode = Spread<
	{
		variable: string;
	},
	SerializedLexicalNode
>;

interface DecoratorResult {
	componentClass: typeof VariableChip;
	updateProps: (props: Record<string, unknown>) => void;
}

export class VariableValueNode extends DecoratorNode<DecoratorResult> {
	__variable: string;

	static getType(): string {
		return "variable-value";
	}

	static clone(node: VariableValueNode): VariableValueNode {
		return new VariableValueNode(node.__variable, node.__key);
	}

	constructor(variable: string, key?: NodeKey) {
		super(key);
		this.__variable = variable;
	}

	createDOM(): HTMLElement {
		const span = document.createElement("span");
		span.className = "variable-chip-wrapper";
		return span;
	}

	updateDOM(): false {
		return false;
	}

	decorate(editor: LexicalEditor): DecoratorResult {
		return {
			componentClass: VariableChip,
			updateProps: (props: Record<string, unknown>) => {
				props.variable = this.__variable;
				props.nodeKey = this.__key;
				props.editor = editor;
			},
		};
	}

	exportDOM(): DOMExportOutput {
		const element = document.createElement("span");
		element.textContent = `{{#${this.__variable}#}}`;
		return { element };
	}

	static importDOM(): DOMConversionMap | null {
		return {
			span: (domNode: Node) => {
				if (!(domNode instanceof HTMLSpanElement)) return null;
				const text = domNode.textContent ?? "";
				const match = /^\{\{#([^#}]+)#\}\}$/.exec(text.trim());
				if (!match) return null;

				return {
					conversion: () => {
						const output: DOMConversionOutput = {
							node: $createVariableValueNode(match[1]),
						};
						return output;
					},
					priority: 2,
				};
			},
		};
	}

	exportJSON(): SerializedVariableValueNode {
		return {
			type: "variable-value",
			version: 1,
			variable: this.__variable,
		};
	}

	getVariable(): string {
		return this.getLatest().__variable;
	}

	getTextContent(): string {
		return `{{#${this.getVariable()}#}}`;
	}

	static importJSON(serializedNode: SerializedVariableValueNode): VariableValueNode {
		return $createVariableValueNode(serializedNode.variable);
	}

	isInline(): boolean {
		return true;
	}
}

export function $createVariableValueNode(variable: string): VariableValueNode {
	return $applyNodeReplacement(new VariableValueNode(variable));
}

export function $isVariableValueNode(
	node: LexicalNode | null | undefined,
): node is VariableValueNode {
	return node instanceof VariableValueNode;
}

// Alias for Svelte 5 compatibility ($ prefix is reserved)
export const isVariableValueNode = $isVariableValueNode;
export const createVariableValueNode = $createVariableValueNode;
