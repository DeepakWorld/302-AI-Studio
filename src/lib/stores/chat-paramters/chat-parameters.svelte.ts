import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type {
	ChatParameters as ChatParametersType,
	ChatVariable,
} from "@shared/storage/chat-parameters";
import type { LexicalEditor } from "lexical";

// Get threadId from window.tab (same logic as chat-state.svelte.ts)
const tab = window?.tab ?? null;
const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

const initialChatParameters: ChatParametersType = {
	systemPromptVariables: [],
	systemPromptMap: {},
	systemPromptContent: "",
	systemPromptPresetType: "custom-type",
	systemPromptRawJson: "",
};

export const persistedChatParametersState = new PersistedState<ChatParametersType>(
	"app-chat-parameters:" + threadId,
	initialChatParameters,
);

class ChatParameters {
	// Editor reference for external updates (in-memory only)
	systemPromptEditorRef = $state<LexicalEditor | null>(null);

	// Temporary flag to distinguish preset selection from manual editing (in-memory only)
	#isPresetUpdate = $state(false);

	systemPromptVariables = $derived.by(
		() => persistedChatParametersState.current.systemPromptVariables,
	);
	systemPromptMap = $derived.by(() => persistedChatParametersState.current.systemPromptMap);
	systemPromptContent = $derived.by(() => persistedChatParametersState.current.systemPromptContent);
	systemPromptPresetType = $derived.by(
		() => persistedChatParametersState.current.systemPromptPresetType || "custom-type",
	);
	systemPromptRawJson = $derived.by(() => persistedChatParametersState.current.systemPromptRawJson);

	/**
	 * Update the persistent state
	 */
	private updateState(partial: Partial<ChatParametersType>): void {
		persistedChatParametersState.current = {
			...persistedChatParametersState.current,
			...partial,
		};
	}

	/**
	 * Set the editor reference
	 */
	setSystemPromptEditorRef(editor: LexicalEditor | null) {
		this.systemPromptEditorRef = editor;
	}

	/**
	 * Update system prompt raw JSON (editor state)
	 */
	updateSystemPromptRawJson(rawJson: string) {
		this.updateState({ systemPromptRawJson: rawJson });
	}

	/**
	 * Update system prompt content and raw JSON together
	 */
	updateSystemPromptContent(content: string, rawJson?: string) {
		const updates: Partial<ChatParametersType> = { systemPromptContent: content };
		if (rawJson !== undefined) {
			updates.systemPromptRawJson = rawJson;
		}
		this.updateState(updates);
	}

	/**
	 * Update system prompt preset type
	 */
	updateSystemPromptPresetType(type: string) {
		this.updateState({ systemPromptPresetType: type });
	}

	/**
	 * Update system prompt map with new cached values
	 * Merges new values with existing map
	 */
	updateSystemPromptMap(newValues: Record<string, string>) {
		const currentMap = persistedChatParametersState.current.systemPromptMap;
		this.updateState({
			systemPromptMap: { ...currentMap, ...newValues },
		});
	}

	/**
	 * Clear system prompt map (reset cache)
	 */
	clearSystemPromptMap() {
		this.updateState({ systemPromptMap: {} });
	}

	/**
	 * Start a preset change - updates preset type and marks as preset update
	 */
	startPresetChange(type: string) {
		// Set in-memory flag first (before editor triggers onchange)
		this.#isPresetUpdate = true;
		// Then persist the preset type
		this.updateState({ systemPromptPresetType: type });
	}

	/**
	 * Extract variables from rawJson (Lexical editor state)
	 */
	private extractVariablesFromRawJson(rawJson: string): ChatVariable[] {
		try {
			const parsed = JSON.parse(rawJson);
			const variables: ChatVariable[] = [];

			// Recursively find all variable-value nodes
			const findVariables = (node: unknown) => {
				if (!node || typeof node !== "object") return;

				if (
					"type" in node &&
					node.type === "variable-value" &&
					"variable" in node &&
					typeof node.variable === "string"
				) {
					variables.push(node.variable as ChatVariable);
				}

				if ("children" in node && Array.isArray(node.children)) {
					for (const child of node.children) {
						findVariables(child);
					}
				}
			};

			findVariables(parsed.root);
			return variables;
		} catch {
			return [];
		}
	}

	/**
	 * Handle editor content change
	 * If the change is from a preset selection, consume the flag
	 * Otherwise, switch to "custom-type" if not already
	 * Also resets systemPromptMap to clear frozen variable values
	 */
	handleEditorChange(content: string, rawJson: string) {
		const updates: Partial<ChatParametersType> = {
			systemPromptContent: content,
			systemPromptRawJson: rawJson,
			systemPromptVariables: this.extractVariablesFromRawJson(rawJson),
			// Reset cached variable map when content changes
			systemPromptMap: {},
		};

		if (this.#isPresetUpdate) {
			// Consume the in-memory flag
			this.#isPresetUpdate = false;
		} else {
			// User manually edited, switch to custom
			if (this.systemPromptPresetType !== "custom-type") {
				updates.systemPromptPresetType = "custom-type";
			}
		}

		// Single unified write to avoid concurrent writes corrupting the file
		this.updateState(updates);
	}

	/**
	 * Reset system prompt state to defaults
	 */
	resetSystemPrompt() {
		this.#isPresetUpdate = false;
		this.updateState({ systemPromptPresetType: "custom-type" });
	}
}

export const chatParameters = new ChatParameters();
