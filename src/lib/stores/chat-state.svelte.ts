import { generateSuggestions } from "$lib/api/suggestions-generation";
import { generateTitle, type FallbackModelConfig } from "$lib/api/title-generation";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages.js";
import {
	clearPendingResultMetadata,
	DynamicChatTransport,
	pendingResultMetadata,
} from "$lib/transport/dynamic-chat-transport";
import type { ChatMessage, MessageMetadata } from "$lib/types/chat";
import {
	convertAttachmentsToMessageParts,
	type MessagePart,
} from "$lib/utils/attachment-converter";
import { clone } from "$lib/utils/clone";
import { ChatErrorHandler, type ChatError } from "$lib/utils/error-handler";
import { replaceCodeBlockAt } from "$lib/utils/markdown-code-block";
import { Chat } from "@ai-sdk/svelte";
import type { ModelProvider } from "@shared/storage/provider";
import type { AttachmentFile, MCPServer, Model, ThreadParmas } from "@shared/types";
import { hashApiKey } from "@shared/utils/hash";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";

import { chatParameters } from "$lib/stores/chat-paramters/chat-parameters.svelte";

import { emitter, EventNames } from "$lib/event/emitter";
import { claudeCodeAgentState } from "$lib/stores/code-agent/claude-code-state.svelte";
import { resolvePrompt } from "@shared/utils/chat-parameters";
import { claudeCodeSandboxState, codeAgentGlobalConfigsState, codeAgentState } from "./code-agent";
import { codeAgentTaskboardState } from "./code-agent/code-agent-taskboard-state.svelte";
import { generalSettings } from "./general-settings.state.svelte";
import { mcpState } from "./mcp-state.svelte";
import { notificationState } from "./notification-state.svelte";
import { preferencesSettings } from "./preferences-settings.state.svelte";
import {
	persistedModelState,
	persistedProviderState,
	providerState,
} from "./provider-state.svelte";
import { sessionState } from "./session-state.svelte";
import { tabBarState } from "./tab-bar-state.svelte";

const { broadcastService, threadService, storageService, pluginService } = window.electronAPI;

export interface Thread {
	id: string;
}

const tab = window?.tab ?? null;
// Ensure we have a valid threadId, even if window.tab is corrupted or missing after reload
const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

// Check if window.thread has valid data (not just an empty object from failed temp file load)
// A valid thread should have at least an 'id' property that matches our threadId
const hasValidThreadData =
	window?.thread &&
	typeof window.thread === "object" &&
	"id" in window.thread &&
	window.thread.id === threadId;

// Use window data if valid (first load with temp files), otherwise use defaults
// PersistedState will restore from storage if available, overriding these initial values
const initialMessages: ChatMessage[] = Array.isArray(window?.messages)
	? clone(window.messages)
	: [];

const initialThread: ThreadParmas = hasValidThreadData
	? clone(window.thread as ThreadParmas)
	: {
			id: threadId,
			title: "New Chat",
			inputValue: "",
			attachments: [],
			mcpServers: [],
			mcpServerIds: [],
			isThinkingActive: false,
			isOnlineSearchActive: false,
			isMCPActive: false,
			isPrivateChatActive: false,
			selectedModel: null,
			temperature: null,
			topP: null,
			maxTokens: null,
			frequencyPenalty: null,
			presencePenalty: null,
			updatedAt: new Date(),
		};

export const persistedMessagesState = new PersistedState<ChatMessage[]>(
	"app-chat-messages:" + threadId,
	initialMessages,
);
export const persistedChatParamsState = new PersistedState<ThreadParmas>(
	"app-thread:" + threadId,
	initialThread,
);

$effect.root(() => {
	$effect(() => {
		// Avoid clearing too early (e.g. before persisted states are hydrated)
		if (!persistedChatParamsState.isHydrated || !persistedModelState.isHydrated) {
			return;
		}

		const selected = persistedChatParamsState.current.selectedModel;
		if (!selected) return;

		const exists = persistedModelState.current.some(
			(m) => m.id === selected.id && m.providerId === selected.providerId,
		);
		if (!exists) {
			console.log(
				`[ChatState] Clearing selectedModel ${selected.providerId}:${selected.id} (model not found)`,
			);
			persistedChatParamsState.current.selectedModel = null;
		}
	});

	// Clean up mcpServerIds when MCP servers are deleted
	$effect(() => {
		// Avoid running too early
		if (!persistedChatParamsState.isHydrated || !mcpState.isHydrated) {
			return;
		}

		const currentServerIds = persistedChatParamsState.current.mcpServerIds;
		if (!currentServerIds || currentServerIds.length === 0) {
			return;
		}

		// Get IDs of all existing servers
		const existingServerIds = new Set(mcpState.servers.map((s) => s.id));

		// Filter out IDs that no longer exist
		const validServerIds = currentServerIds.filter((id) => existingServerIds.has(id));

		// If some IDs were removed, update the state
		if (validServerIds.length !== currentServerIds.length) {
			console.log(
				`[ChatState] Cleaning up deleted MCP server IDs: ${currentServerIds.length - validServerIds.length} removed`,
			);
			persistedChatParamsState.current = {
				...persistedChatParamsState.current,
				mcpServerIds: validServerIds,
				isMCPActive: validServerIds.length > 0,
			};
		}
	});
});

class ChatState {
	private lastError: ChatError | null = $state(null);
	private retryInProgress = $state(false);
	private hydrateCheckInterval: ReturnType<typeof setInterval> | null = null;

	// AbortController for canceling pending suggestions generation
	private suggestionsAbortController: AbortController | null = null;

	// Track loading state for attachments (not persisted)
	loadingAttachmentIds = $state(new Set<string>());
	isParametersOpen = $state(false);
	isCreateSkillMode = $state(false);

	async handleSendMessage() {}

	/**
	 * Cancel any pending suggestions generation request.
	 * Should be called before sending a new message to avoid race conditions.
	 */
	cancelPendingSuggestions() {
		if (this.suggestionsAbortController) {
			this.suggestionsAbortController.abort();
			this.suggestionsAbortController = null;
			console.log("[Suggestions] Cancelled pending suggestions generation");
		}
	}

	/**
	 * Create a new AbortController for suggestions generation.
	 * Returns the AbortSignal to be passed to the fetch request.
	 */
	createSuggestionsAbortController(): AbortSignal {
		// Cancel any existing pending request first
		this.cancelPendingSuggestions();
		this.suggestionsAbortController = new AbortController();
		return this.suggestionsAbortController.signal;
	}

	constructor() {
		// Watch for PersistedState hydration and sync messages to chat
		// This handles the case where reload happens before hydration completes
		this.hydrateCheckInterval = setInterval(() => {
			if (persistedMessagesState.isHydrated && persistedChatParamsState.isHydrated) {
				this.syncPersistedStatesToChat();
				if (this.hydrateCheckInterval) {
					clearInterval(this.hydrateCheckInterval);
					this.hydrateCheckInterval = null;
				}
			}
		}, 50);

		// Also clear after 5 seconds to prevent infinite checking
		setTimeout(() => {
			if (this.hydrateCheckInterval) {
				clearInterval(this.hydrateCheckInterval);
				this.hydrateCheckInterval = null;
			}
		}, 5000);

		// Listen for models-deleted events and clear selectedModel if it was deleted
		// (or if the whole provider's models were cleared)
		window.electronAPI.onModelsDeleted(({ deletedModelIds, providerId }) => {
			const currentModel = this.selectedModel;
			const shouldClear =
				!!currentModel &&
				(deletedModelIds.includes(currentModel.id) ||
					(!!providerId && currentModel.providerId === providerId));
			if (shouldClear) {
				console.log(
					`[ChatState] Clearing selectedModel ${currentModel?.providerId}:${currentModel?.id} (models deleted)`,
				);
				this.selectedModel = null;
			}
		});
	}

	private syncPersistedStatesToChat() {
		const persistedMessages = persistedMessagesState.snapshot;
		const currentChatMessages = chat.messages;

		// Sync messages if persisted state has data but chat doesn't (e.g., after reload/hydration)
		if (persistedMessages.length > 0 && currentChatMessages.length === 0) {
			chat.messages = persistedMessages;
		}
	}

	private resetChat() {
		persistedChatParamsState.current = {
			...(persistedChatParamsState.current ?? initialThread),
			inputValue: "",
			attachments: [],
		};
	}

	get id(): string {
		return persistedChatParamsState.current.id;
	}

	get inputValue(): string {
		return persistedChatParamsState.current.inputValue;
	}
	set inputValue(value: string) {
		persistedChatParamsState.current.inputValue = value;
	}

	get attachments(): AttachmentFile[] {
		return persistedChatParamsState.current.attachments;
	}
	set attachments(value: AttachmentFile[]) {
		persistedChatParamsState.current.attachments = value;
	}

	get messages(): ChatMessage[] {
		return chat.messages;
	}

	set messages(value: ChatMessage[]) {
		chat.messages = value;
	}

	get mcpServers(): MCPServer[] {
		return persistedChatParamsState.current.mcpServers;
	}
	set mcpServers(value: MCPServer[]) {
		persistedChatParamsState.current.mcpServers = value;
	}

	get mcpServerIds(): string[] {
		return persistedChatParamsState.current.mcpServerIds;
	}
	set mcpServerIds(value: string[]) {
		persistedChatParamsState.current.mcpServerIds = value;
	}

	get isThinkingActive(): boolean {
		return persistedChatParamsState.current.isThinkingActive;
	}
	set isThinkingActive(value: boolean) {
		persistedChatParamsState.current.isThinkingActive = value;
	}

	get isOnlineSearchActive(): boolean {
		return persistedChatParamsState.current.isOnlineSearchActive;
	}
	set isOnlineSearchActive(value: boolean) {
		persistedChatParamsState.current.isOnlineSearchActive = value;
	}

	get isMCPActive(): boolean {
		return persistedChatParamsState.current.isMCPActive;
	}
	set isMCPActive(value: boolean) {
		persistedChatParamsState.current.isMCPActive = value;
	}

	get selectedModel(): Model | null {
		return persistedChatParamsState.current.selectedModel;
	}
	set selectedModel(value: Model | null) {
		persistedChatParamsState.current.selectedModel = value;
	}

	get isPrivateChatActive(): boolean {
		return persistedChatParamsState.current.isPrivateChatActive;
	}
	set isPrivateChatActive(value: boolean) {
		persistedChatParamsState.current.isPrivateChatActive = value;
	}

	get title(): string {
		return persistedChatParamsState.current.title;
	}
	set title(value: string) {
		persistedChatParamsState.current.title = value;
	}

	// Chat Parameters
	get temperature(): number | null {
		return persistedChatParamsState.current.temperature;
	}
	set temperature(value: number | null) {
		persistedChatParamsState.current.temperature = value;
	}

	get topP(): number | null {
		return persistedChatParamsState.current.topP;
	}
	set topP(value: number | null) {
		persistedChatParamsState.current.topP = value;
	}

	get frequencyPenalty(): number | null {
		return persistedChatParamsState.current.frequencyPenalty;
	}
	set frequencyPenalty(value: number | null) {
		persistedChatParamsState.current.frequencyPenalty = value;
	}

	get presencePenalty(): number | null {
		return persistedChatParamsState.current.presencePenalty;
	}
	set presencePenalty(value: number | null) {
		persistedChatParamsState.current.presencePenalty = value;
	}

	get maxTokens(): number | null {
		return persistedChatParamsState.current.maxTokens;
	}
	set maxTokens(value: number | null) {
		persistedChatParamsState.current.maxTokens = value;
	}

	get clearScreenMessageId(): string | undefined {
		return persistedChatParamsState.current.clearScreenMessageId;
	}
	set clearScreenMessageId(value: string | undefined) {
		persistedChatParamsState.current.clearScreenMessageId = value;
	}

	providerType = $derived<string | null>(
		this.selectedModel
			? (providerState.getProvider(this.selectedModel.providerId)?.apiType ?? null)
			: null,
	);
	currentProvider = $derived<ModelProvider | null>(
		this.selectedModel ? providerState.getProvider(this.selectedModel.providerId) : null,
	);

	isStreaming = $derived(chat.status === "streaming");
	isSubmitted = $derived(chat.status === "submitted");
	isReady = $derived(chat.status === "ready");
	isError = $derived(chat.status === "error");

	sendMessageEnabled = $derived<boolean>(
		(this.inputValue.trim() !== "" || this.attachments.length > 0) &&
			!!this.selectedModel &&
			!this.isStreaming &&
			!this.isSubmitted &&
			this.loadingAttachmentIds.size === 0, // 确保没有附件正在加载
	);
	hasMessages = $derived(this.messages.length > 0);

	/**
	 * Messages visible to the user after applying clear screen filter.
	 * Messages up to and including clearScreenMessageId are hidden.
	 */
	visibleMessages = $derived.by(() => {
		const clearId = this.clearScreenMessageId;
		if (!clearId) {
			return this.messages;
		}
		const clearIndex = this.messages.findIndex((msg) => msg.id === clearId);
		if (clearIndex === -1) {
			return this.messages;
		}
		return this.messages.slice(clearIndex + 1);
	});

	/**
	 * Whether clear screen is active (has hidden messages)
	 */
	hasClearScreen = $derived(
		!!this.clearScreenMessageId &&
			this.messages.findIndex((msg) => msg.id === this.clearScreenMessageId) !== -1,
	);

	/**
	 * Whether there are visible messages (after applying clear screen filter)
	 */
	hasVisibleMessages = $derived(this.visibleMessages.length > 0);

	canTogglePrivacy = $derived(!this.hasMessages);
	canRegenerate = $derived(
		(this.isReady || this.isError) &&
			this.hasMessages &&
			!!this.selectedModel &&
			this.messages.some((msg) => msg.role === "assistant"),
	);
	lastAssistantMessage = $derived(this.messages.findLast((msg) => msg.role === "assistant"));

	isLastMessageStreaming = $derived(this.isStreaming && this.hasMessages);

	get hasError(): boolean {
		return this.lastError !== null;
	}

	get canRetry(): boolean {
		return (
			this.hasError &&
			!this.retryInProgress &&
			this.lastError !== null &&
			ChatErrorHandler.isRetryable(this.lastError) &&
			notificationState.canRetry
		);
	}

	private handleChatError = async (error: unknown) => {
		const chatError = ChatErrorHandler.createError(error, {
			provider: this.currentProvider?.name,
			model: this.selectedModel?.id,
			action: "send_message",
			retryable: true,
		});

		this.lastError = chatError;

		// Execute error hook
		try {
			const errorContext = {
				source: "send_message" as const,
				provider: this.currentProvider || undefined,
				model: this.selectedModel || undefined,
				metadata: {
					errorType: chatError.type,
					statusCode: chatError.statusCode,
				},
			};

			const hookResult = await pluginService.executeErrorHook(
				{
					message:
						chatError.originalError instanceof Error
							? chatError.originalError.message
							: String(chatError.originalError),
					stack:
						chatError.originalError instanceof Error ? chatError.originalError.stack : undefined,
					name: chatError.originalError instanceof Error ? chatError.originalError.name : "Error",
				},
				errorContext,
			);

			if (hookResult.handled) {
				console.log("[ChatState] Error handled by plugin hook");

				// If plugin suggests custom message, use it
				if (hookResult.message) {
					notificationState.setError({
						...chatError,
						message: hookResult.message,
					});
				} else {
					notificationState.setError(chatError);
				}

				// If plugin suggests retry
				if (hookResult.retry) {
					const retryDelay = hookResult.retryDelay || 0;
					if (retryDelay > 0) {
						await new Promise((resolve) => setTimeout(resolve, retryDelay));
					}
					await this.retryLastMessage();
					return;
				}
			} else {
				// Default error handling
				notificationState.setError(chatError);
				ChatErrorHandler.showErrorNotification(chatError);
			}
		} catch (hookError) {
			console.error("[ChatState] Error hook failed:", hookError);
			// Fallback to default error handling
			notificationState.setError(chatError);
			ChatErrorHandler.showErrorNotification(chatError);
		}
	};

	private resetError = () => {
		this.lastError = null;
		notificationState.clearError();
	};

	retryLastMessage = async () => {
		if (!this.canRetry || !this.lastError) {
			return;
		}

		this.retryInProgress = true;
		notificationState.incrementRetryCount();

		try {
			const retryDelay = ChatErrorHandler.getRetryDelay(this.lastError);
			if (retryDelay > 0) {
				await new Promise((resolve) => setTimeout(resolve, retryDelay));
			}

			this.resetError();

			if (this.hasMessages && this.messages.length > 0) {
				await this.regenerateMessage();
			}
		} catch (error) {
			this.handleChatError(error);
		} finally {
			this.retryInProgress = false;
		}
	};

	sendMessage = async () => {
		if (this.sendMessageEnabled) {
			// Cancel any pending suggestions generation to avoid race conditions
			this.cancelPendingSuggestions();

			try {
				const currentModel = this.selectedModel!;
				const currentAttachments = [...this.attachments];
				const currentInputValue = this.inputValue;

				// Ensure session association is recorded for tabs created at app boot
				// (boot-created initial tabs may not have apiKeyHash until the first real send)
				if (currentModel.providerId === "302AI") {
					persistedChatParamsState.current.apiKeyHash = this.get302AIApiKeyHash();
				}

				this.resetError();

				// Execute before send message hook
				try {
					const messageContext = {
						messages: this.messages,
						userMessage: this.messages.at(-1),
						model: currentModel,
						provider: this.currentProvider!,
						parameters: {
							temperature: this.temperature,
							topP: this.topP,
							maxTokens: this.maxTokens,
							frequencyPenalty: this.frequencyPenalty,
							presencePenalty: this.presencePenalty,
						},
						options: {
							isThinkingActive: this.isThinkingActive,
							isOnlineSearchActive: this.isOnlineSearchActive,
							isMCPActive: this.isMCPActive,
							mcpServerIds: this.mcpServerIds,
							autoParseUrl: preferencesSettings.autoParseUrl,
							speedOptions: {
								enabled: preferencesSettings.streamOutputEnabled,
								speed: preferencesSettings.streamSpeed,
							},
						},
					};

					// Serialize context to remove Svelte Proxy objects
					const serializedContext = JSON.parse(JSON.stringify(messageContext));

					const modifiedContext =
						await pluginService.executeBeforeSendMessageHook(serializedContext);

					// Check if hook cancelled the message
					if (
						modifiedContext &&
						typeof modifiedContext === "object" &&
						"stop" in modifiedContext &&
						modifiedContext.stop === true
					) {
						console.log("[ChatState] Message sending cancelled by plugin hook");
						return;
					}

					console.log("[ChatState] Before send message hook executed successfully");
				} catch (hookError) {
					console.error("[ChatState] Before send message hook failed:", hookError);
					// Continue with message sending even if hook fails
				}

				const { parts: attachmentParts, metadataList: attachmentMetadata } =
					await convertAttachmentsToMessageParts(currentAttachments, {
						enableZipSupport: codeAgentState.enabled,
					});

				const textParts = attachmentParts.filter(
					(part): part is { type: "text"; text: string } => part.type === "text",
				);
				const fileParts = attachmentParts.filter(
					(part): part is import("ai").FileUIPart => part.type === "file",
				);

				if (fileParts.length > 0 && textParts.length > 0) {
					const fileContent = textParts.map((part) => part.text).join("\n\n");

					chat.sendMessage(
						{
							parts: [
								...fileParts,
								{ type: "text" as const, text: fileContent },
								{ type: "text" as const, text: currentInputValue },
							],
							metadata: {
								attachments: attachmentMetadata,
								fileContentPartIndex: fileParts.length,
							},
						},
						{
							body: {
								model: currentModel.id,
								apiKey: this.getApiKey(currentModel.providerId),
							},
						},
					);
				} else if (fileParts.length > 0) {
					chat.sendMessage(
						{
							text: currentInputValue,
							files: fileParts,
							metadata: { attachments: attachmentMetadata },
						},
						{
							body: {
								model: currentModel.id,
								apiKey: this.getApiKey(currentModel.providerId),
							},
						},
					);
				} else if (textParts.length > 0) {
					const fileContent = textParts.map((part) => part.text).join("\n\n");

					chat.sendMessage(
						{
							parts: [
								{ type: "text" as const, text: fileContent },
								{ type: "text" as const, text: currentInputValue },
							],
							metadata: {
								attachments: attachmentMetadata,
								fileContentPartIndex: 0,
							},
						},
						{
							body: {
								model: currentModel.id,
								apiKey: this.getApiKey(currentModel.providerId),
							},
						},
					);
				} else {
					chat.sendMessage(
						{ text: currentInputValue },
						{
							body: {
								model: currentModel.id,
								apiKey: this.getApiKey(currentModel.providerId),
							},
						},
					);
				}

				await threadService.addThread(threadId);

				await broadcastService.broadcastToAll("thread-list-updated", { threadId });

				this.resetChat();
			} catch (error) {
				this.handleChatError(error);
			}
		}
	};

	regenerateMessage = async (messageId?: string) => {
		if (!this.canRegenerate) {
			console.warn("Cannot regenerate: chat is not ready or no model selected");
			return;
		}

		// Cancel any pending suggestions generation to avoid race conditions
		this.cancelPendingSuggestions();

		const currentModel = this.selectedModel!;

		try {
			this.resetError();

			let regenerateMessageId = messageId;

			// If messageId is provided, remove messages to prevent duplicates when regenerating
			if (messageId) {
				const messageIndex = this.messages.findIndex((msg) => msg.id === messageId);
				if (messageIndex !== -1) {
					const message = this.messages[messageIndex];

					if (message.role === "assistant") {
						// If regenerating an assistant message, find the previous user message
						// and remove the assistant message and all messages after it
						let userMessageId: string | undefined;
						for (let i = messageIndex - 1; i >= 0; i--) {
							if (this.messages[i].role === "user") {
								userMessageId = this.messages[i].id;
								break;
							}
						}

						// Remove the assistant message and all messages after it
						const messagesToKeep = this.messages.slice(0, messageIndex);
						chat.messages = messagesToKeep;
						persistedMessagesState.current = messagesToKeep;

						// Use the user message ID for regeneration
						regenerateMessageId = userMessageId;
					} else if (message.role === "user") {
						// If regenerating a user message, remove all messages after it (including assistant messages)
						const messagesToKeep = this.messages.slice(0, messageIndex + 1);
						const messagesAfter = this.messages.slice(messageIndex + 1);
						const hasAssistantAfter = messagesAfter.some((msg) => msg.role === "assistant");

						if (hasAssistantAfter) {
							chat.messages = messagesToKeep;
							persistedMessagesState.current = messagesToKeep;
						}
					}
				}
			}

			await chat.regenerate({
				...(regenerateMessageId && { messageId: regenerateMessageId }),
				body: {
					model: currentModel.id,
					apiKey: this.getApiKey(currentModel.providerId),
				},
			});
		} catch (error) {
			console.error("Failed to regenerate message:", error);
			this.handleChatError(error);
		}
	};

	stopGeneration = () => {
		if (
			codeAgentTaskboardState.taskboardStatus === "running" ||
			codeAgentTaskboardState.taskboardStatus === "waiting_to_stop"
		) {
			codeAgentTaskboardState.stopExecution();
		}
		chat.stop();
	};

	clearMessages() {
		this.messages = [];
		persistedMessagesState.current = [];
	}

	/**
	 * Clear screen by marking the last message as the clear point.
	 * Messages up to and including this message will be hidden from view,
	 * but preserved in history.
	 */
	clearScreen() {
		const lastMessage = this.messages[this.messages.length - 1];
		if (lastMessage) {
			this.clearScreenMessageId = lastMessage.id;
		}
	}

	/**
	 * Restore all hidden messages by removing the clear screen marker.
	 */
	restoreClearScreen() {
		this.clearScreenMessageId = undefined;
	}

	updateMessage(messageId: string, content: string) {
		const updatedMessages = this.messages.map((msg) => {
			if (msg.id === messageId) {
				return {
					...msg,
					parts: msg.parts.map((part) =>
						part.type === "text" ? { ...part, text: content } : part,
					),
				};
			}
			return msg;
		});

		chat.messages = updatedMessages;
	}

	updateMessageFeedback(messageId: string, feedback: "like" | "dislike" | null) {
		const updatedMessages = this.messages.map((msg) => {
			if (msg.id === messageId) {
				return {
					...msg,
					metadata: {
						...msg.metadata,
						feedback: feedback || undefined,
					},
				};
			}
			return msg;
		});

		chat.messages = updatedMessages;
		persistedMessagesState.current = updatedMessages;
	}

	updateMessageCodeBlock(
		messageId: string,
		messagePartIndex: number,
		blockId: string,
		code: string,
		language?: string | null,
		meta?: string | null,
	) {
		const blockIndex = Number(blockId.replace("code-", ""));
		if (!Number.isFinite(blockIndex) || Number.isNaN(blockIndex)) {
			return false;
		}

		const messageIndex = this.messages.findIndex((msg) => msg.id === messageId);
		if (messageIndex === -1) {
			return false;
		}

		const targetMessage = this.messages[messageIndex];
		const targetPart = targetMessage.parts?.[messagePartIndex];
		if (!targetPart || targetPart.type !== "text") {
			return false;
		}

		const updatedContent = replaceCodeBlockAt(targetPart.text, blockIndex, {
			code,
			language,
			meta,
		});

		if (updatedContent === null) {
			return false;
		}

		const updatedMessages = this.messages.map((msg, idx) => {
			if (idx !== messageIndex) {
				return msg;
			}
			return {
				...msg,
				parts: msg.parts.map((part, partIdx) => {
					if (partIdx === messagePartIndex && part.type === "text") {
						return {
							...part,
							text: updatedContent,
						};
					}
					return part;
				}),
			};
		});

		chat.messages = updatedMessages;
		persistedMessagesState.current = updatedMessages;
		return true;
	}

	deleteMessage(messageId: string) {
		const updatedMessages = this.messages.filter((msg) => msg.id !== messageId);
		chat.messages = updatedMessages;
		persistedMessagesState.current = updatedMessages;
	}

	rerunToolCall = async (messageId: string, toolCallId: string) => {
		if (!this.canRegenerate) {
			console.warn("Cannot rerun tool: chat is not ready or no model selected");
			return;
		}

		const messageIndex = this.messages.findIndex((msg) => msg.id === messageId);
		if (messageIndex === -1) {
			throw new Error("Message not found");
		}

		const message = this.messages[messageIndex];
		if (!message) {
			throw new Error("Message not found");
		}

		const toolCallPartIndex = message.parts.findIndex(
			(part) => part.type === "dynamic-tool" && part.toolCallId === toolCallId,
		);

		if (toolCallPartIndex === -1) {
			throw new Error("Tool call not found");
		}
		const updatedParts = message.parts.slice(0, toolCallPartIndex);
		const updatedMessage = { ...message, parts: updatedParts };
		const updatedMessages = [...this.messages.slice(0, messageIndex), updatedMessage];

		chat.messages = updatedMessages;
		persistedMessagesState.current = updatedMessages;

		const currentModel = this.selectedModel!;

		try {
			this.resetError();
			await chat.sendMessage(undefined, {
				body: {
					model: currentModel.id,
					apiKey: this.getApiKey(currentModel.providerId),
				},
			});
		} catch (error) {
			console.error("Failed to rerun tool call:", error);
			this.handleChatError(error);
		}
	};

	async generateTitleManually(): Promise<void> {
		const titleModel = preferencesSettings.titleGenerationModel;

		if (!titleModel) {
			console.warn("No title generation model configured");
			toast.warning(m.toast_no_title_generation_model());
			return;
		}

		if (this.messages.length < 2) {
			console.warn("Not enough messages to generate title");
			toast.warning(m.toast_empty_message());
			return;
		}

		try {
			const provider = persistedProviderState.current.find((p) => p.id === titleModel.providerId);
			const serverPort = window.app?.serverPort ?? 8089;

			// Get previous summary and determine if first generation
			const previousSummary = persistedChatParamsState.current.incrementalSummary;
			const isFirstGeneration = this.messages.length === 2;

			// Prepare messages for incremental generation
			let messagesToSend: ChatMessage[];
			if (isFirstGeneration) {
				// First generation: only send the first user message
				messagesToSend = this.messages.filter((m) => m.role === "user").slice(0, 1);
			} else {
				// Incremental: send previous assistant message + latest user message
				const userMessages = this.messages.filter((m) => m.role === "user");
				const assistantMessages = this.messages.filter((m) => m.role === "assistant");
				const lastUserMsg = userMessages.at(-1);
				const prevAssistantMsg = assistantMessages.at(-1);
				messagesToSend = [prevAssistantMsg, lastUserMsg].filter(Boolean) as ChatMessage[];
			}

			// 准备兜底配置：如果 provider 未配置，使用当前聊天模型
			let fallbackConfig: FallbackModelConfig | undefined;
			if (!provider && this.selectedModel && this.currentProvider) {
				fallbackConfig = {
					model: this.selectedModel,
					provider: this.currentProvider,
				};
			}

			const result = await generateTitle(
				messagesToSend,
				titleModel,
				provider,
				serverPort,
				previousSummary,
				isFirstGeneration,
				fallbackConfig,
			);

			if (result) {
				persistedChatParamsState.current.title = result.title;
				persistedChatParamsState.current.incrementalSummary = result.summary;
				await tabBarState.updateTabTitle(persistedChatParamsState.current.id, result.title);

				// Force flush to ensure all changes are persisted before broadcasting
				persistedChatParamsState.flush();

				// Broadcast update event to trigger sidebar refresh
				await broadcastService.broadcastToAll("thread-list-updated", {});

				// 如果是 code agent 类型，同步备注到 302.AI
				// 使用 handleThreadTitleUpdated 以正确检查 isManualNote 标志
				if (codeAgentState.enabled) {
					try {
						await claudeCodeAgentState.handleThreadTitleUpdated({ title: result.title });
						console.log("[ChatState] Session note synced to 302.AI");
					} catch (syncError) {
						console.error("[ChatState] Failed to sync session note:", syncError);
						// 不阻塞主流程，只记录错误
					}
				}

				toast.success(m.toast_title_generation_success());
			} else {
				toast.error(m.toast_title_generation_failed());
			}
		} catch (error) {
			console.error("Failed to generate title manually:", error);
			toast.error(m.toast_title_generation_failed());
		}
	}

	/**
	 * Get the API key for a specific provider
	 */
	getApiKey(providerId: string): string | undefined {
		// const codeAgentEnabled = codeAgentState.enabled;
		// if (codeAgentEnabled) {
		// 	return codeAgentGlobalConfigsState.apiKey;
		// }

		const apiKey = persistedProviderState.current.find((p) => p.id === providerId)?.apiKey;
		return apiKey;
	}

	/**
	 * Get the current 302.AI provider's API key hash for session tracking
	 */
	private get302AIApiKeyHash(): string | undefined {
		const provider = providerState.getProvider("302AI");
		return hashApiKey(provider?.apiKey);
	}

	async createBranch(upToMessageId: string): Promise<string | null> {
		try {
			// 1. find the target message index
			const messageIndex = this.messages.findIndex((msg) => msg.id === upToMessageId);
			if (messageIndex === -1) {
				console.error("Message not found:", upToMessageId);
				return null;
			}

			// 2. slice messages
			const branchMessages = clone(this.messages.slice(0, messageIndex + 1));

			// 3. generate threadId
			const newThreadId = nanoid();

			// 4. clone thread data
			const newThread: ThreadParmas = clone({
				id: newThreadId,
				title: `${this.title}`,
				inputValue: "",
				attachments: [],
				mcpServers: this.mcpServers,
				mcpServerIds: persistedChatParamsState.current.mcpServerIds || [],
				isThinkingActive: this.isThinkingActive,
				isOnlineSearchActive: this.isOnlineSearchActive,
				isMCPActive: this.isMCPActive,
				isPrivateChatActive: this.isPrivateChatActive,
				selectedModel: this.selectedModel,
				temperature: this.temperature,
				topP: this.topP,
				maxTokens: this.maxTokens,
				frequencyPenalty: this.frequencyPenalty,
				presencePenalty: this.presencePenalty,
				updatedAt: new Date(),
				apiKeyHash: this.get302AIApiKeyHash(),
			});

			// 5. save thread data
			await storageService.setItem(`app-thread:${newThreadId}`, newThread);
			await storageService.setItem(`app-chat-messages:${newThreadId}`, branchMessages);

			// 6. add to thread list
			await threadService.addThread(newThreadId);

			// 7. broadcast thread list update
			await broadcastService.broadcastToAll("thread-list-updated", {});

			return newThreadId;
		} catch (error) {
			console.error("Failed to create branch:", error);
			return null;
		}
	}

	async createBranchAndSend(
		upToMessageId: string,
		userInput: string,
		userAttachments: AttachmentFile[],
	): Promise<string | null> {
		try {
			// 1. find the target message index
			const messageIndex = this.messages.findIndex((msg) => msg.id === upToMessageId);
			if (messageIndex === -1) {
				console.error("Message not found:", upToMessageId);
				return null;
			}

			// 2. slice messages up to and including the target message
			const branchMessages = clone(this.messages.slice(0, messageIndex + 1));

			// 3. convert attachments to message parts
			const { parts: attachmentParts, metadataList: attachmentMetadata } =
				await convertAttachmentsToMessageParts(userAttachments, {
					enableZipSupport: codeAgentState.enabled,
				});

			// 4. Separate text and file parts
			const textParts = attachmentParts.filter(
				(part): part is { type: "text"; text: string } => part.type === "text",
			);
			const fileParts = attachmentParts.filter(
				(part): part is import("ai").FileUIPart => part.type === "file",
			);

			// 5. Build message parts array - always include at least the user input as a text part
			let messageParts: MessagePart[] = [];
			let fileContentPartIndex: number | undefined = undefined;

			if (fileParts.length > 0 && textParts.length > 0) {
				// Has both files and text content from files
				const fileContent = textParts.map((part) => part.text).join("\n\n");
				messageParts = [
					...fileParts,
					{ type: "text" as const, text: fileContent },
					{ type: "text" as const, text: userInput },
				];
				fileContentPartIndex = fileParts.length;
			} else if (fileParts.length > 0) {
				// Has only files
				messageParts = [...fileParts, { type: "text" as const, text: userInput }];
			} else if (textParts.length > 0) {
				// Has only text content from files
				const fileContent = textParts.map((part) => part.text).join("\n\n");
				messageParts = [
					{ type: "text" as const, text: fileContent },
					{ type: "text" as const, text: userInput },
				];
				fileContentPartIndex = 0;
			} else {
				// No attachments, just user input
				messageParts = [{ type: "text" as const, text: userInput }];
			}

			// 6. Create user message with proper structure
			const userMessage: ChatMessage = {
				id: nanoid(),
				role: "user",
				parts: messageParts,
				metadata: {
					createdAt: new Date().toISOString(),
					attachments: attachmentMetadata,
					...(fileContentPartIndex !== undefined && { fileContentPartIndex }),
				},
			};

			// 7. add user message to branch messages
			branchMessages.push(userMessage);

			// 8. generate threadId
			const newThreadId = nanoid();

			// 9. clone thread data with autoSendOnLoad flag
			const newThread: ThreadParmas = clone({
				id: newThreadId,
				title: `${this.title}`,
				inputValue: "", // Keep input empty
				attachments: [], // Keep attachments empty
				mcpServers: this.mcpServers,
				mcpServerIds: persistedChatParamsState.current.mcpServerIds || [],
				isThinkingActive: this.isThinkingActive,
				isOnlineSearchActive: this.isOnlineSearchActive,
				isMCPActive: this.isMCPActive,
				isPrivateChatActive: this.isPrivateChatActive,
				selectedModel: this.selectedModel,
				temperature: this.temperature,
				topP: this.topP,
				maxTokens: this.maxTokens,
				frequencyPenalty: this.frequencyPenalty,
				presencePenalty: this.presencePenalty,
				updatedAt: new Date(),
				autoSendOnLoad: true, // Set flag to trigger AI reply on load
				apiKeyHash: this.get302AIApiKeyHash(),
			});

			// 8. save thread data and messages
			await storageService.setItem(`app-thread:${newThreadId}`, newThread);
			await storageService.setItem(`app-chat-messages:${newThreadId}`, branchMessages);

			// 9. add to thread list
			await threadService.addThread(newThreadId);

			// 10. broadcast thread list update
			await broadcastService.broadcastToAll("thread-list-updated", {});

			return newThreadId;
		} catch (error) {
			console.error("Failed to create branch and send:", error);
			return null;
		}
	}

	addAttachment(attachment: AttachmentFile) {
		this.attachments = [...this.attachments, attachment];
	}

	addAttachments(attachments: AttachmentFile[]) {
		this.attachments = [...this.attachments, ...attachments];
	}

	updateAttachment(id: string, updates: Partial<AttachmentFile>) {
		this.attachments = this.attachments.map((att) =>
			att.id === id ? { ...att, ...updates } : att,
		);
	}

	removeAttachment(id: string) {
		this.attachments = this.attachments.filter((att) => att.id !== id);
		// Also remove from loading state if present
		this.loadingAttachmentIds.delete(id);
	}

	setAttachmentLoading(id: string, isLoading: boolean) {
		if (isLoading) {
			this.loadingAttachmentIds.add(id);
		} else {
			this.loadingAttachmentIds.delete(id);
		}
	}

	isAttachmentLoading(id: string): boolean {
		return this.loadingAttachmentIds.has(id);
	}

	handleThinkingActiveChange(active: boolean) {
		this.isThinkingActive = active;
	}

	handleOnlineSearchActiveChange(active: boolean) {
		this.isOnlineSearchActive = active;
	}

	handleMCPActiveChange(active: boolean) {
		this.isMCPActive = active;
	}

	handleMCPServerIdsChange(serverIds: string[]) {
		this.mcpServerIds = serverIds;
	}

	/**
	 * Update MCP server IDs and active state in a single operation to avoid race conditions
	 */
	handleMCPServerChange(serverIds: string[]) {
		persistedChatParamsState.current = {
			...persistedChatParamsState.current,
			mcpServerIds: serverIds,
			isMCPActive: serverIds.length > 0,
		};
	}

	handleSelectedModelChange(model: Model | null) {
		this.selectedModel = model;
	}

	handlePrivateChatActiveChange(active: boolean) {
		this.isPrivateChatActive = active;
	}

	handleTemperatureChange(value: number | null) {
		this.temperature = value;
	}

	handleTopPChange(value: number | null) {
		this.topP = value;
	}

	handleFrequencyPenaltyChange(value: number | null) {
		this.frequencyPenalty = value;
	}

	handlePresencePenaltyChange(value: number | null) {
		this.presencePenalty = value;
	}

	handleMaxTokensChange(value: number | null) {
		this.maxTokens = value;
	}
}

export const chatState = new ChatState();

export const chat = new Chat({
	messages: persistedMessagesState.current,
	transport: new DynamicChatTransport<ChatMessage>({
		api: () => {
			const port = window.app?.serverPort ?? 8089;

			const codeAgentEnabled = codeAgentState.enabled;

			switch (chatState.currentProvider?.apiType) {
				case "302ai": {
					if (codeAgentEnabled) {
						return `http://localhost:${port}/chat/302ai-code-agent`;
					}
					return `http://localhost:${port}/chat/302ai`;
				}
				case "openai":
					return `http://localhost:${port}/chat/openai`;
				case "anthropic":
					return `http://localhost:${port}/chat/anthropic`;
				case "gemini":
					return `http://localhost:${port}/chat/gemini`;
				default:
					return `http://localhost:${port}/chat/302`;
			}
		},
		body: () => {
			const codeAgentEnabled = codeAgentState.enabled;
			const sessionId = codeAgentEnabled
				? (() => {
						if (claudeCodeAgentState.currentSessionId) {
							return claudeCodeAgentState.currentSessionId;
						}

						// Fallback: If no session exists, generate a new one
						// This should rarely happen if the flow is controlled correctly
						const newSessionId = nanoid();
						claudeCodeAgentState.updateCurrentSessionId(newSessionId);
						return newSessionId;
					})()
				: "";

			return {
				baseUrl: codeAgentEnabled
					? codeAgentState.codeAgentCfgs.baseUrl
					: chatState.currentProvider?.baseUrl,
				temperature: persistedChatParamsState.current.temperature,
				maxTokens: persistedChatParamsState.current.maxTokens,
				frequencyPenalty: persistedChatParamsState.current.frequencyPenalty,
				presencePenalty: persistedChatParamsState.current.presencePenalty,

				isThinkingActive: persistedChatParamsState.current.isThinkingActive,
				isOnlineSearchActive: persistedChatParamsState.current.isOnlineSearchActive,
				isMCPActive: persistedChatParamsState.current.isMCPActive,
				mcpServerIds: persistedChatParamsState.current.mcpServerIds,

				autoParseUrl: preferencesSettings.autoParseUrl,
				searchProvider: preferencesSettings.searchProvider,

				speedOptions: {
					enabled: preferencesSettings.streamOutputEnabled,
					speed: preferencesSettings.streamSpeed,
				},

				language: generalSettings.language,

				threadId,
				sessionId,
				sandboxName: claudeCodeAgentState.sandboxRemark,

				// Resolved system prompt with variables substituted
				// Note: input variable is not supported for system prompts
				systemPrompt: (() => {
					if (!chatParameters.systemPromptContent) return undefined;

					const result = resolvePrompt(chatParameters.systemPromptContent, {
						modelId: chatState.selectedModel?.id ?? "",
						language: generalSettings.language,
						cachedMap: chatParameters.systemPromptMap,
						variables: chatParameters.systemPromptVariables,
					});

					// Update cache with newly computed values
					if (Object.keys(result.updatedMap).length > 0) {
						chatParameters.updateSystemPromptMap(result.updatedMap);
					}

					return result.content;
				})(),

				autoDeploy: codeAgentGlobalConfigsState.autoDeploy,
				skills: codeAgentState.skills,
				isCreateSkillMode: chatState.isCreateSkillMode,
				inPlanMode: codeAgentEnabled && codeAgentState.inPlanMode,

				inTaskOrchestrationMode:
					codeAgentEnabled && codeAgentTaskboardState.taskboardStatus === "running",
				workspacePath: codeAgentEnabled && claudeCodeSandboxState.currentSessionWorkspacePath,
			};
		},
	}),
	onError: (error) => {
		console.error("[Chat onError]", error);
	},
	onFinish: async ({ messages, isAbort, isDisconnect, isError }) => {
		console.log("更新完成", $state.snapshot(messages));
		console.debug("[onFinish] messages", JSON.stringify($state.snapshot(messages), null, 2));
		console.log("[onFinish] isAbort:", isAbort, "isDisconnect:", isDisconnect, "isError:", isError);

		const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user");
		if (lastUserMessage) {
			const updatedMessages = messages.map((msg) => {
				if (msg.id === lastUserMessage.id) {
					return {
						...msg,
						metadata: {
							...msg.metadata,
							userPromptTemplateContent: chatParameters.userPromptTemplateContent,
							userPromptTemplateVariables: chatParameters.userPromptTemplateVariables,
							userPromptTemplateMap: chatParameters.userPromptTemplateMap,
						},
					};
				}
				return msg;
			});

			// Update both messages array and persisted state
			chat.messages = updatedMessages;
			messages = updatedMessages;
		}

		// Save systemPrompt to the last assistant message
		const lastAssistantMessage = [...messages].reverse().find((msg) => msg.role === "assistant");
		if (lastAssistantMessage && chatParameters.systemPromptContent) {
			const resolvedSystemPrompt = resolvePrompt(chatParameters.systemPromptContent, {
				modelId: chatState.selectedModel?.id ?? "",
				language: generalSettings.language,
				cachedMap: chatParameters.systemPromptMap,
				variables: chatParameters.systemPromptVariables,
			});

			const updatedMessages = messages.map((msg) => {
				if (msg.id === lastAssistantMessage.id) {
					return {
						...msg,
						metadata: {
							...msg.metadata,
							systemPromptContent: resolvedSystemPrompt.content,
							systemPromptVariables: [...chatParameters.systemPromptVariables],
							systemPromptMap: { ...chatParameters.systemPromptMap },
						},
					};
				}
				return msg;
			});

			chat.messages = updatedMessages;
			messages = updatedMessages;
		}

		const codeAgentEnabled = codeAgentState.enabled;
		console.log("onFinish: async ({ messages }) pendingResultMetadata", pendingResultMetadata);
		if (codeAgentEnabled && pendingResultMetadata) {
			const lastMessage = messages[messages.length - 1];
			if (lastMessage && lastMessage.role === "assistant") {
				const currentMetadata = (lastMessage.metadata as MessageMetadata) || {};
				lastMessage.metadata = {
					...currentMetadata,
					result: pendingResultMetadata,
				};
				console.log("[ChatState] Merged result metadata into message:", pendingResultMetadata);
			}
			clearPendingResultMetadata();
		}

		console.log("onFinish: async ({ messages }) codeAgentEnabled", codeAgentEnabled);
		console.log(
			"onFinish: async ({ messages }) autoDeploy",
			codeAgentGlobalConfigsState.autoDeploy,
		);
		emitter.emit(EventNames.CHAT_FINISHED, {
			canDeploy: codeAgentEnabled && codeAgentGlobalConfigsState.autoDeploy,
			lastMessage: messages[messages.length - 1],
		});

		persistedMessagesState.current = messages;

		sessionState.latestUsedModel = chatState.selectedModel ?? null;

		// Execute after send message hook
		try {
			const lastMessage = messages[messages.length - 1];
			const userMessage = messages[messages.length - 2]; // Assuming last is AI, second-to-last is user

			if (lastMessage && userMessage && chatState.selectedModel && chatState.currentProvider) {
				const messageContext = {
					messages: messages,
					userMessage: userMessage,
					model: chatState.selectedModel,
					provider: chatState.currentProvider,
					parameters: {
						temperature: chatState.temperature,
						topP: chatState.topP,
						maxTokens: chatState.maxTokens,
						frequencyPenalty: chatState.frequencyPenalty,
						presencePenalty: chatState.presencePenalty,
					},
					options: {
						isThinkingActive: chatState.isThinkingActive,
						isOnlineSearchActive: chatState.isOnlineSearchActive,
						isMCPActive: chatState.isMCPActive,
						mcpServerIds: chatState.mcpServerIds,
						autoParseUrl: preferencesSettings.autoParseUrl,
						speedOptions: {
							enabled: preferencesSettings.streamOutputEnabled,
							speed: preferencesSettings.streamSpeed,
						},
					},
				};

				const response = {
					message: lastMessage,
					usage: undefined,
					model: chatState.selectedModel.id,
					finishReason: "stop",
					metadata: {},
				};

				// Serialize context and response to remove Svelte Proxy objects
				const serializedContext = JSON.parse(JSON.stringify(messageContext));
				const serializedResponse = JSON.parse(JSON.stringify(response));

				await pluginService.executeAfterSendMessageHook(serializedContext, serializedResponse);
				console.log("[ChatState] After send message hook executed successfully");
			}
		} catch (hookError) {
			console.error("[ChatState] After send message hook failed:", hookError);
			// Continue execution even if hook fails
		}

		const titleTiming = preferencesSettings.titleGenerationTiming;
		const titleModel = preferencesSettings.titleGenerationModel;
		const currentTitle = persistedChatParamsState.current.title;
		const isDefaultTitle =
			!currentTitle ||
			currentTitle === "New Chat" ||
			currentTitle === "新对话" ||
			currentTitle === "新会话";
		const isFirstMessage = messages.length === 2; // User message + AI response

		// // 计算当前对话轮数（一轮 = 用户消息 + 助手回复）
		// const conversationRounds = Math.floor(messages.length / 2);
		// // 每隔多少轮更新一次标题（首次对话模式下）
		// const TITLE_UPDATE_INTERVAL = 5;

		let shouldGenerateTitle = false;

		if (titleTiming === "off") {
			shouldGenerateTitle = false;
		} else if (titleTiming === "firstTime") {
			// 仅在首次对话时生成标题（当标题为默认值时）
			shouldGenerateTitle = isFirstMessage && isDefaultTitle;

			// // 首次生成 或 每隔 N 轮更新一次
			// shouldGenerateTitle =
			// 	(isFirstMessage && isDefaultTitle) ||
			// 	(conversationRounds > 1 && conversationRounds % TITLE_UPDATE_INTERVAL === 0);
		} else if (titleTiming === "everyTime") {
			shouldGenerateTitle = messages.length >= 2;
		}

		if (shouldGenerateTitle && titleModel) {
			try {
				const provider = persistedProviderState.current.find((p) => p.id === titleModel.providerId);
				const serverPort = window.app?.serverPort ?? 8089;

				// Get previous summary for incremental generation
				const previousSummary = persistedChatParamsState.current.incrementalSummary;

				// Prepare messages for incremental generation
				let messagesToSend: ChatMessage[];
				if (isFirstMessage) {
					// First generation: only send the first user message
					messagesToSend = messages.filter((m) => m.role === "user").slice(0, 1);
				} else {
					// Incremental: send previous assistant message + latest user message
					const userMessages = messages.filter((m) => m.role === "user");
					const assistantMessages = messages.filter((m) => m.role === "assistant");
					const lastUserMsg = userMessages.at(-1);
					const prevAssistantMsg = assistantMessages.at(-1);
					messagesToSend = [prevAssistantMsg, lastUserMsg].filter(Boolean) as ChatMessage[];
				}

				// 准备兜底配置：如果 302AI provider 未配置，使用当前聊天模型
				let fallbackConfig: FallbackModelConfig | undefined;
				if (!provider && chatState.selectedModel && chatState.currentProvider) {
					fallbackConfig = {
						model: chatState.selectedModel,
						provider: chatState.currentProvider,
					};
				}

				const result = await generateTitle(
					messagesToSend,
					titleModel,
					provider,
					serverPort,
					previousSummary,
					isFirstMessage,
					fallbackConfig,
				);

				if (result) {
					persistedChatParamsState.current.title = result.title;
					persistedChatParamsState.current.incrementalSummary = result.summary;

					emitter.emit(EventNames.THREAD_TITLE_UPDATED, { title: result.title });

					await tabBarState.updateTabTitle(persistedChatParamsState.current.id, result.title);
				}
			} catch (error) {
				console.error("Failed to generate title:", error);
			}
		} else if (isFirstMessage && isDefaultTitle && titleTiming !== "off") {
			// Fallback for firstTime mode when model is not configured
			const firstUserMessage = messages.find((msg) => msg.role === "user");
			if (firstUserMessage) {
				const textPart = firstUserMessage.parts.find((part) => part.type === "text");
				if (textPart && "text" in textPart) {
					const text = textPart.text.trim();
					const titleText = [...text].slice(0, 10).join("");
					if (titleText) {
						persistedChatParamsState.current.title = titleText;
						await tabBarState.updateTabTitle(persistedChatParamsState.current.id, titleText);
					}
				}
			}
		}

		// Update the updatedAt timestamp
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		persistedChatParamsState.current.updatedAt = new Date();

		// Force flush to ensure all changes are persisted before broadcasting
		persistedChatParamsState.flush();

		await broadcastService.broadcastToAll("thread-list-updated", {});

		// Generate suggestions asynchronously (non-blocking)
		// This runs in the background and updates the last message when ready
		// Check if suggestions are enabled and timing is set to auto
		if (
			preferencesSettings.suggestionsEnabled &&
			preferencesSettings.suggestionsTiming === "auto" &&
			chatState.selectedModel &&
			chatState.currentProvider
		) {
			const lastMessage = messages[messages.length - 1];
			if (lastMessage && lastMessage.role === "assistant") {
				const serverPort = window.app?.serverPort ?? 8089;
				const targetMessageId = lastMessage.id;

				// Create AbortController for this suggestions generation
				// This will be cancelled if user sends a new message
				const abortSignal = chatState.createSuggestionsAbortController();

				// Don't await - let this run in the background
				generateSuggestions(
					messages,
					chatState.selectedModel,
					chatState.currentProvider,
					generalSettings.language,
					preferencesSettings.suggestionsCount,
					serverPort,
					abortSignal,
				)
					.then((suggestions) => {
						// Check if request was aborted (user sent a new message)
						if (abortSignal.aborted) {
							console.log("[Suggestions] Skipped: request was aborted");
							return;
						}

						// Check if a new stream is in progress - don't update chat.messages
						// to avoid breaking the ongoing stream
						if (chatState.isStreaming || chatState.isSubmitted) {
							console.log("[Suggestions] Skipped: new stream in progress");
							return;
						}

						if (suggestions && suggestions.length > 0) {
							console.log("[Suggestions] Adding to message:", suggestions);

							// Find the message again (it might have changed)
							const currentMessages = persistedMessagesState.current;
							const messageIndex = currentMessages.findIndex((m) => m.id === targetMessageId);

							if (messageIndex !== -1) {
								// Check if suggestions already exist
								const hasSuggestions = currentMessages[messageIndex].parts.some(
									(part) => part.type === "data-suggestions",
								);

								if (!hasSuggestions) {
									// Create a new message object with suggestions
									const updatedMessage = {
										...currentMessages[messageIndex],
										parts: [
											...currentMessages[messageIndex].parts,
											{
												type: "data-suggestions" as const,
												data: {
													suggestions: suggestions,
												},
											},
										],
									};

									// Update the messages array
									const updatedMessages = [...currentMessages];
									updatedMessages[messageIndex] = updatedMessage;

									// Update persisted state first
									persistedMessagesState.current = updatedMessages;

									// Only update chat.messages if not streaming/submitted
									// This is a double-check since state could have changed during updates
									if (!chatState.isStreaming && !chatState.isSubmitted) {
										chat.messages = updatedMessages;
										console.log("[Suggestions] Successfully added to message");
									} else {
										console.log(
											"[Suggestions] Saved to persisted state, skipped chat.messages update due to active stream",
										);
									}
								}
							}
						}
					})
					.catch((error) => {
						// AbortError is expected when user sends a new message, don't log as error
						if (error instanceof Error && error.name === "AbortError") {
							return;
						}
						console.error("[Suggestions] Failed to generate:", error);
					});
			}
		}
	},
});
