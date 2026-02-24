import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { chatState } from "$lib/stores/chat-state.svelte";
import type { ChatUIStateData } from "$lib/types/chat-ui";

const tab = window?.tab ?? null;
const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

export const persistedChatUIState = new PersistedState<ChatUIStateData>(
	"app-chat-ui-state:" + threadId,
	{
		reasoningState: {},
	},
);

class ChatUIState {
	constructor() {
		// Clean up reasoning state when messages are deleted
		$effect.root(() => {
			$effect(() => {
				if (!persistedChatUIState.isHydrated) return;

				const currentMessages = chatState.messages;
				const messageIds = new Set(currentMessages.map((msg) => msg.id));
				const currentReasoningState = persistedChatUIState.current.reasoningState;
				let hasChanges = false;

				// Remove state for deleted messages
				const newState = { ...currentReasoningState };
				for (const msgId in newState) {
					if (!messageIds.has(msgId)) {
						delete newState[msgId];
						hasChanges = true;
					}
				}

				if (hasChanges) {
					persistedChatUIState.current.reasoningState = newState;
				}
			});
		});
	}

	getReasoningState(messageId: string, partIndex: number): boolean | undefined {
		return persistedChatUIState.current.reasoningState[messageId]?.[partIndex.toString()];
	}

	setReasoningState(messageId: string, partIndex: number, isExpanded: boolean) {
		const currentState = persistedChatUIState.current;
		const messageState = currentState.reasoningState[messageId] || {};

		persistedChatUIState.current = {
			...currentState,
			reasoningState: {
				...currentState.reasoningState,
				[messageId]: {
					...messageState,
					[partIndex.toString()]: isExpanded,
				},
			},
		};
	}
}

export const chatUIState = new ChatUIState();
