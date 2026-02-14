import { generateContextSummary } from "$lib/api/context-summary-generation";
import { generateSuggestions } from "$lib/api/suggestions-generation";
import { generateTitle, type FallbackModelConfig } from "$lib/api/title-generation";
import { emitter, EventNames } from "$lib/event/emitter";
import { m } from "$lib/paraglide/messages";
import { generalSettings } from "$lib/stores/general-settings.state.svelte";
import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
import { persistedProviderState } from "$lib/stores/provider-state.svelte";
import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
import type { ChatMessage } from "$lib/types/chat";
import type { ModelProvider } from "@shared/storage/provider";
import type { Model, ThreadParmas } from "@shared/types";

type PersistedStateLike<T> = {
	current: T;
	flush: () => Promise<void>;
};

export type AfterChatFinishedChatState = {
	isStreaming: boolean;
	isSubmitted: boolean;
	isGeneratingTitle: boolean;
	shouldApplyCompression: boolean;
	selectedModel: Model | null;
	currentProvider: ModelProvider | null;
	createTitleAbortController: () => AbortSignal;
	createSummaryAbortController: () => AbortSignal;
	createSuggestionsAbortController: () => AbortSignal;
	messages: ChatMessage[];
	contextSummary: string | undefined;
	compressedMessageCount: number | undefined;
	lastCompressionMessageId: string | undefined;
};

type AfterChatFinishedContext = {
	messages: ChatMessage[];
	chatState: AfterChatFinishedChatState;
	persistedChatParamsState: PersistedStateLike<ThreadParmas>;
	persistedMessagesState: PersistedStateLike<ChatMessage[]>;
};

function buildFallbackConfigIfNeeded(
	primaryProvider: ModelProvider | undefined,
	chatState: Pick<AfterChatFinishedChatState, "selectedModel" | "currentProvider">,
): FallbackModelConfig | undefined {
	if (primaryProvider) return;
	if (!chatState.selectedModel || !chatState.currentProvider) return;
	return { model: chatState.selectedModel, provider: chatState.currentProvider };
}

function findProviderForModel(model: Model | null | undefined): ModelProvider | undefined {
	if (!model) return undefined;
	return persistedProviderState.current.find((provider) => provider.id === model.providerId);
}

function isPostProcessInterrupted(
	chatState: Pick<AfterChatFinishedChatState, "isStreaming" | "isSubmitted">,
	signal?: AbortSignal,
): boolean {
	return !!signal?.aborted || chatState.isStreaming || chatState.isSubmitted;
}

async function handleTitleGeneration(context: AfterChatFinishedContext): Promise<void> {
	const { messages, chatState, persistedChatParamsState } = context;
	const { broadcastService } = window.electronAPI;

	const titleTiming = preferencesSettings.titleGenerationTiming;
	const titleModel = preferencesSettings.titleGenerationModel;
	const isFirstMessage = messages.length === 2;
	const currentTitle = persistedChatParamsState.current.title;
	const localizedDefaultTitle = m.title_new_chat();
	const isDefaultTitle =
		!currentTitle ||
		currentTitle === localizedDefaultTitle ||
		currentTitle === "New Chat" ||
		currentTitle === "新对话" ||
		currentTitle === "新会话";

	const shouldGenerateTitleWithModel =
		titleTiming !== "off" &&
		((titleTiming === "firstTime" && isFirstMessage && isDefaultTitle) ||
			(titleTiming === "everyTime" && messages.length >= 2));

	try {
		if (shouldGenerateTitleWithModel && titleModel) {
			const abortSignal = chatState.createTitleAbortController();
			const provider = findProviderForModel(titleModel);
			const fallbackConfig = buildFallbackConfigIfNeeded(provider, chatState);
			const previousSummary = persistedChatParamsState.current.incrementalSummary;
			let messagesToSend: ChatMessage[];
			if (isFirstMessage) {
				messagesToSend = messages.filter((message) => message.role === "user").slice(0, 1);
			} else {
				const userMessages = messages.filter((message) => message.role === "user");
				const assistantMessages = messages.filter((message) => message.role === "assistant");
				const lastUserMessage = userMessages.at(-1);
				const previousAssistantMessage = assistantMessages.at(-1);
				messagesToSend = [previousAssistantMessage, lastUserMessage].filter(
					Boolean,
				) as ChatMessage[];
			}
			const serverPort = window.app?.serverPort ?? 8089;

			try {
				chatState.isGeneratingTitle = true;
				const result = await generateTitle(
					messagesToSend,
					titleModel,
					provider,
					serverPort,
					previousSummary,
					isFirstMessage,
					fallbackConfig,
					abortSignal,
				);

				if (isPostProcessInterrupted(chatState, abortSignal)) {
					console.log("[Title] Skipped: request was aborted or new stream in progress");
					return;
				}
				if (!result) return;

				persistedChatParamsState.current.title = result.title;
				persistedChatParamsState.current.incrementalSummary = result.summary;

				emitter.emit(EventNames.THREAD_TITLE_UPDATED, { title: result.title });
				await tabBarState.updateTabTitle(persistedChatParamsState.current.id, result.title);
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					console.log("[Title] Generation cancelled");
					return;
				}
				console.error("Failed to generate title:", error);
			} finally {
				chatState.isGeneratingTitle = false;
			}
		} else if (isFirstMessage && isDefaultTitle && titleTiming !== "off") {
			const firstUserMessage = messages.find((message) => message.role === "user");
			const textPart = firstUserMessage?.parts.find((part) => part.type === "text");
			if (textPart && "text" in textPart) {
				const fallbackTitle = [...textPart.text.trim()].slice(0, 10).join("");
				if (fallbackTitle) {
					persistedChatParamsState.current.title = fallbackTitle;
					await tabBarState.updateTabTitle(persistedChatParamsState.current.id, fallbackTitle);
				}
			}
		}
	} finally {
		persistedChatParamsState.current.updatedAt = new Date();
		// Preserve existing non-blocking flush behavior.
		persistedChatParamsState.flush();
		await broadcastService.broadcastToAll("thread-list-updated", {});
	}
}

async function handleContextSummaryGeneration(context: AfterChatFinishedContext): Promise<void> {
	const { messages, chatState, persistedChatParamsState } = context;

	if (!chatState.shouldApplyCompression) return;

	const compressionLimit = preferencesSettings.contextCompressionLimit;
	if (messages.length <= compressionLimit) return;

	const summaryModel = preferencesSettings.titleGenerationModel;
	if (!summaryModel) return;

	const existingCompressed = chatState.compressedMessageCount ?? 0;
	const keepRecentCount = Math.min(compressionLimit, messages.length);
	const newCompressionEnd = messages.length - keepRecentCount;
	if (newCompressionEnd <= existingCompressed) return;

	const messagesToCompress = messages.slice(existingCompressed, newCompressionEnd);
	if (messagesToCompress.length < 2) return;

	const abortSignal = chatState.createSummaryAbortController();
	const provider = findProviderForModel(summaryModel);
	const fallbackConfig = buildFallbackConfigIfNeeded(provider, chatState);
	const serverPort = window.app?.serverPort ?? 8089;

	try {
		const summaryResult = await generateContextSummary(
			messagesToCompress,
			summaryModel,
			provider,
			serverPort,
			chatState.contextSummary,
			generalSettings.language,
			fallbackConfig,
			abortSignal,
		);

		if (isPostProcessInterrupted(chatState, abortSignal)) {
			console.log("[ContextSummary] Skipped: aborted or stream in progress");
			return;
		}
		if (!summaryResult) return;

		chatState.contextSummary = summaryResult;
		chatState.compressedMessageCount = newCompressionEnd;
		chatState.lastCompressionMessageId = messages[newCompressionEnd - 1]?.id;
		persistedChatParamsState.flush();
		console.log(`[ContextSummary] Updated: ${newCompressionEnd} messages compressed`);
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			console.log("[ContextSummary] Generation cancelled");
			return;
		}
		console.error("[ContextSummary] Failed:", error);
	}
}

async function handleSuggestionsGeneration(context: AfterChatFinishedContext): Promise<void> {
	const { messages, chatState, persistedMessagesState } = context;
	const suggestionsModel = preferencesSettings.titleGenerationModel;

	if (
		!preferencesSettings.suggestionsEnabled ||
		preferencesSettings.suggestionsTiming !== "auto" ||
		!suggestionsModel
	) {
		return;
	}

	const lastMessage = messages.at(-1);
	if (!lastMessage || lastMessage.role !== "assistant") return;

	const provider = findProviderForModel(suggestionsModel);
	const fallbackConfig = buildFallbackConfigIfNeeded(provider, chatState);
	const serverPort = window.app?.serverPort ?? 8089;
	const abortSignal = chatState.createSuggestionsAbortController();
	const targetMessageId = lastMessage.id;

	try {
		const suggestions = await generateSuggestions(
			messages,
			suggestionsModel,
			provider,
			generalSettings.language,
			preferencesSettings.suggestionsCount,
			serverPort,
			fallbackConfig,
			abortSignal,
		);

		if (isPostProcessInterrupted(chatState, abortSignal)) {
			console.log("[Suggestions] Skipped: request was aborted or new stream in progress");
			return;
		}
		if (suggestions.length === 0) return;

		const currentMessages = persistedMessagesState.current;
		const messageIndex = currentMessages.findIndex((message) => message.id === targetMessageId);
		if (messageIndex === -1) return;

		const hasSuggestions = currentMessages[messageIndex].parts.some(
			(part) => part.type === "data-suggestions",
		);
		if (hasSuggestions) return;

		const updatedMessages = [...currentMessages];
		updatedMessages[messageIndex] = {
			...currentMessages[messageIndex],
			parts: [
				...currentMessages[messageIndex].parts,
				{
					type: "data-suggestions" as const,
					data: { suggestions },
				},
			],
		};

		persistedMessagesState.current = updatedMessages;
		if (!chatState.isStreaming && !chatState.isSubmitted) {
			chatState.messages = updatedMessages;
			console.log("[Suggestions] Successfully added to message");
			return;
		}

		console.log(
			"[Suggestions] Saved to persisted state, skipped chat.messages update due to active stream",
		);
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") return;
		console.error("[Suggestions] Failed to generate:", error);
	}
}

export async function afterChatFinished(args: {
	messages: ChatMessage[];
	chatState: AfterChatFinishedChatState;
	persistedChatParamsState: PersistedStateLike<ThreadParmas>;
	persistedMessagesState: PersistedStateLike<ChatMessage[]>;
}): Promise<void> {
	const context: AfterChatFinishedContext = args;

	const [titleResult, summaryResult, suggestionsResult] = await Promise.allSettled([
		handleTitleGeneration(context),
		handleContextSummaryGeneration(context),
		handleSuggestionsGeneration(context),
	]);

	if (titleResult.status === "rejected") {
		console.error("[afterChatFinished] Title post-process failed:", titleResult.reason);
	}
	if (summaryResult.status === "rejected") {
		console.error("[afterChatFinished] Context summary post-process failed:", summaryResult.reason);
	}
	if (suggestionsResult.status === "rejected") {
		console.error("[afterChatFinished] Suggestions post-process failed:", suggestionsResult.reason);
	}
}
