import type { EditorConfig, SerializedTextNode } from "lexical";
import { $createTextNode, TextNode } from "lexical";

export class CustomTextNode extends TextNode {
	static getType(): string {
		return "custom-text";
	}

	static clone(node: CustomTextNode): CustomTextNode {
		return new CustomTextNode(node.__text, node.__key);
	}

	createDOM(config: EditorConfig): HTMLElement {
		return super.createDOM(config);
	}

	static importJSON(serializedNode: SerializedTextNode): TextNode {
		const node = $createTextNode(serializedNode.text);
		node.setFormat(serializedNode.format);
		node.setDetail(serializedNode.detail);
		node.setMode(serializedNode.mode);
		node.setStyle(serializedNode.style);
		return node;
	}

	exportJSON(): SerializedTextNode {
		return {
			detail: this.getDetail(),
			format: this.getFormat(),
			mode: this.getMode(),
			style: this.getStyle(),
			text: this.getTextContent(),
			type: "custom-text",
			version: 1,
		};
	}

	isSimpleText(): boolean {
		return (this.__type === "text" || this.__type === "custom-text") && this.__mode === 0;
	}
}

export function $createCustomTextNode(text: string): CustomTextNode {
	return new CustomTextNode(text);
}
