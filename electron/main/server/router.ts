import type { SearchProvider } from "$lib/stores/preferences-settings.state.svelte";
import { createAI302 } from "@302ai/ai-sdk";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { serve } from "@hono/node-server";
import type { ModelProvider } from "@shared/storage/provider";
import type { ChatMessage, McpServer } from "@shared/types";
import {
	ToolLoopAgent as Agent,
	convertToModelMessages,
	createUIMessageStreamResponse,
	extractReasoningMiddleware,
	generateText,
	smoothStream,
	stepCountIs,
	wrapLanguageModel,
	type UIMessage,
} from "ai";
import getPort from "get-port";
import { Hono, type Context } from "hono";
import { codeAgentService, ssoService } from "../services";
import { chatParametersService } from "../services/chat-parameters-service";
import { mcpService } from "../services/mcp-service";
import { storageService } from "../services/storage-service";
import { createCitationsFetch } from "./citations-processor";
import { createClaudeCodeFetch } from "./claude-code-processor";
import {
	convertAiSdkMessagesToOpenAiMessages,
	createUIMessageStreamFromGenerator,
	isStreamingSupported,
} from "./utils";

export type RouterRequestBody = {
	baseUrl?: string;
	model?: string;
	apiKey?: string;
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	isThinkingActive?: boolean;
	isOnlineSearchActive?: boolean;
	isMCPActive?: boolean;
	mcpServerIds?: string[];
	autoParseUrl?: boolean;
	searchProvider?: SearchProvider;
	speedOptions?: {
		enabled: boolean;
		speed: "slow" | "normal" | "fast";
	};
	messages: UIMessage[];
	language?: string;
	threadId: string;
	sessionId?: string;
	systemPrompt?: string;
	mcpServers?: string[];
	sandboxName?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addDefinedParams(options: any, params: any) {
	if (params.temperature !== undefined && params.temperature !== null) {
		options.temperature = params.temperature;
	}
	if (params.topP !== undefined && params.topP !== null) {
		options.topP = params.topP;
	}
	if (params.maxTokens !== undefined && params.maxTokens !== null) {
		options.maxOutputTokens = params.maxTokens;
	}
	if (params.frequencyPenalty !== undefined && params.frequencyPenalty !== null) {
		options.frequencyPenalty = params.frequencyPenalty;
	}
	if (params.presencePenalty !== undefined && params.presencePenalty !== null) {
		options.presencePenalty = params.presencePenalty;
	}
}

// Generate suggestion prompt based on user's language preference and count
function getSuggestionsPrompt(language?: string, count: number = 3): string {
	if (language === "zh") {
		return `基于我们的对话，建议${count}个我可能会问的后续问题。只返回一个包含${count}个字符串的JSON数组，例如：["问题1？", "问题2？", "问题3？"]。不要包含其他文本。`;
	}
	// Default to English
	return `Based on our conversation, suggest ${count} follow-up questions I might ask next. Return ONLY a JSON array of ${count} strings, like: ["Question 1?", "Question 2?", "Question 3?"]. No other text.`;
}

// Add feedback information from metadata to messages
function enhanceMessagesWithFeedback(messages: UIMessage[]) {
	return messages.map((msg) => {
		// Only add feedback for assistant messages that have feedback
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const metadata = msg.metadata as any;
		if (msg.role === "assistant" && metadata?.feedback) {
			const feedbackText =
				metadata.feedback === "like"
					? "[User feedback: 👍 Liked this response]"
					: "[User feedback: 👎 Disliked this response]";

			// Add feedback as a system-like annotation
			return {
				...msg,
				parts: [
					...msg.parts,
					{
						type: "text" as const,
						text: `\n\n${feedbackText}`,
					},
				],
			};
		}
		return msg;
	});
}

function smartChunking(buffer: string): string {
	// whitespace
	const whitespaceMatch = buffer.match(/^\s+/);
	if (whitespaceMatch) {
		return whitespaceMatch[0];
	}

	// Chinese
	const chineseMatch = buffer.match(/^[\u4e00-\u9fff]/);
	if (chineseMatch) {
		return chineseMatch[0];
	}

	// English
	const wordMatch = buffer.match(/^[a-zA-Z]+\d*/);
	if (wordMatch) {
		return wordMatch[0];
	}

	// Numbers
	const numberMatch = buffer.match(/^\d+/);
	if (numberMatch) {
		return numberMatch[0];
	}

	// Punctuation
	return buffer[0];
}

function getDelayForSpeed(speed: "slow" | "normal" | "fast"): number {
	switch (speed) {
		case "slow":
			return 150;
		case "normal":
			return 50;
		case "fast":
			return 20;
		default:
			return 50;
	}
}

const app = new Hono();

app.post("/chat/302ai", async (c) => {
	const {
		baseUrl,
		model = "gpt-4o",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isThinkingActive,
		isOnlineSearchActive,
		isMCPActive,
		mcpServerIds = [],
		autoParseUrl,
		searchProvider = "search1api",
		messages,
		speedOptions,
		language: _language,
		systemPrompt,
		threadId,
	} = await c.req.json<{
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;

		isThinkingActive?: boolean;
		isOnlineSearchActive?: boolean;
		isMCPActive?: boolean;
		mcpServerIds?: string[];
		autoParseUrl?: boolean;
		searchProvider?: SearchProvider;

		speedOptions?: {
			enabled: boolean;
			speed: "slow" | "normal" | "fast";
		};

		messages: UIMessage[];
		language?: string;
		systemPrompt?: string;
		threadId: string;
	}>();
	console.log(
		baseUrl,
		model,
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isThinkingActive,
		isOnlineSearchActive,
		messages,
		speedOptions,
		systemPrompt,
		threadId,
	);

	const provider302Options: Record<string, boolean | string> = {};

	if (autoParseUrl) {
		provider302Options["file-parse"] = true;
	}

	if (isThinkingActive) {
		provider302Options["fusion"] = true;
	}

	if (isOnlineSearchActive) {
		provider302Options["web-search"] = true;
		provider302Options["search-service"] = searchProvider;
	}

	const ai302 = createAI302({
		baseURL: baseUrl || "https://api.openai.com/v1",
		apiKey: apiKey || "[REDACTED:sk-secret]",
		fetch: createCitationsFetch(provider302Options),
	});

	// Only enable thinking for DeepSeek models
	const isDeepSeekModel = model.toLowerCase().includes("deepseek");
	const modelOptions = isDeepSeekModel ? { thinking: { type: "enabled" as const } } : {};

	const wrapModel = wrapLanguageModel({
		model: ai302.chatModel(model, modelOptions),
		middleware: [
			extractReasoningMiddleware({ tagName: "think" }),
			extractReasoningMiddleware({ tagName: "thinking" }),
		],
		providerId: "302.AI",
	});

	// Get MCP tools if MCP is active
	let mcpTools = undefined;
	if (isMCPActive && mcpServerIds.length > 0) {
		try {
			const allServers = await storageService.getItemInternal("app-mcp-servers");
			if (allServers) {
				mcpTools = await mcpService.getToolsFromServerIds(mcpServerIds, allServers as McpServer[]);
				console.log(`Loaded ${mcpTools.length} tools from MCP servers`);
			}
		} catch (error) {
			console.error("Failed to load MCP tools:", error);
		}
	}
	let resolvedMessages = messages;
	console.log(
		"Resolving user prompt template variables for thread - before:",
		JSON.stringify(resolvedMessages, null, 2),
	);

	if (await chatParametersService.validateUserPromptTemplateVariables(threadId)) {
		// Find the last user message
		const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user");
		if (lastUserMessage) {
			const prevResolvedMessages = await chatParametersService.resolvePrevUserMsgsByUserPromptTemp(
				threadId,
				model,
				lastUserMessage.id, // Exclude last user message to avoid duplicate processing
			);

			const resolvedLastMessage = await chatParametersService.resolveLastUserTextByUserPromptTemp(
				threadId,
				lastUserMessage as ChatMessage,
				model,
			);
			resolvedMessages = [...prevResolvedMessages, resolvedLastMessage];
		}
	}

	console.log(
		"Resolving user prompt template variables for thread - after:",
		JSON.stringify(resolvedMessages, null, 2),
	);

	const convertedMessages = await convertToModelMessages(
		enhanceMessagesWithFeedback(resolvedMessages),
	);

	const streamTextOptions = {
		model: wrapModel,
		messages: convertedMessages,
		providerOptions: {
			"302": provider302Options,
		},
		...(systemPrompt && { system: systemPrompt }),
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	// Check if model supports streaming (image generation models don't)
	if (!isStreamingSupported(model)) {
		console.log(`[302ai] Model ${model} does not support streaming, using generateText`);

		// Use createUIMessageStreamFromGenerator for immediate start event and async content generation
		const stream = createUIMessageStreamFromGenerator(
			async () => {
				const result = await generateText(streamTextOptions);
				return result.text || "";
			},
			model,
			"ai302",
		);

		return new Response(stream, {
			status: 200,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"x-vercel-ai-ui-message-stream": "v1",
			},
		});
	}

	// Stream the main text response using Agent without waiting for suggestions
	// Note: Agent uses 'instructions' for system prompt, not 'system'
	const agentConfig = {
		model: wrapModel,
		...(systemPrompt && { instructions: systemPrompt }),
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
		stopWhen: stepCountIs(20),
		providerOptions: {
			"302": provider302Options,
		},
	};
	addDefinedParams(agentConfig, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const result = await new Agent(agentConfig).stream({
		messages: convertedMessages,
		...(speedOptions?.enabled && {
			experimental_transform: smoothStream({
				chunking: smartChunking,
				delayInMs: getDelayForSpeed(speedOptions.speed),
			}),
		}),
	});

	const stream = result.toUIMessageStream({
		messageMetadata: () => ({
			model,
			provider: "ai302",
			createdAt: new Date().toISOString(),
		}),
	});

	// 	const debugStream = stream.pipeThrough(
	// 	new TransformStream({
	// 		transform(chunk, controller) {
	// 			console.debug("Stream chunk:", chunk);
	// 			controller.enqueue(chunk);
	// 		},
	// 	}),
	// );

	// return createUIMessageStreamResponse({ stream: debugStream });

	return createUIMessageStreamResponse({ stream });
});

app.post("/chat/openai", async (c) => {
	const {
		baseUrl,
		model = "gpt-4o",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isMCPActive,
		mcpServerIds = [],
		messages,
		speedOptions,
		language: _language,
		systemPrompt,
		threadId,
	} = await c.req.json<{
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		isMCPActive?: boolean;
		mcpServerIds?: string[];
		speedOptions?: {
			enabled: boolean;
			speed: "slow" | "normal" | "fast";
		};
		messages: UIMessage[];
		language?: string;
		systemPrompt?: string;
		threadId: string;
	}>();

	const openai = createOpenAI({
		baseURL: baseUrl || "https://api.openai.com/v1",
		apiKey: apiKey || "[REDACTED:sk-secret]",
	});

	const wrapModel = wrapLanguageModel({
		model: openai.chat(model),
		middleware: [
			extractReasoningMiddleware({ tagName: "think" }),
			extractReasoningMiddleware({ tagName: "thinking" }),
		],
	});

	// Get MCP tools if MCP is active
	let mcpTools = undefined;
	if (isMCPActive && mcpServerIds.length > 0) {
		try {
			const allServers = await storageService.getItemInternal("app-mcp-servers");
			if (allServers) {
				mcpTools = await mcpService.getToolsFromServerIds(mcpServerIds, allServers as McpServer[]);
				console.log(`Loaded ${mcpTools.length} tools from MCP servers`);
			}
		} catch (error) {
			console.error("Failed to load MCP tools:", error);
		}
	}

	// Resolve user prompt template variables
	let resolvedMessages = messages;
	if (await chatParametersService.validateUserPromptTemplateVariables(threadId)) {
		// Find the last user message
		const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user");
		if (lastUserMessage) {
			// Resolve previous user messages (using metadata)
			const prevResolvedMessages = await chatParametersService.resolvePrevUserMsgsByUserPromptTemp(
				threadId,
				model,
				lastUserMessage.id, // Exclude last user message to avoid duplicate processing
			);
			// Resolve last user message (using storage)
			const resolvedLastMessage = await chatParametersService.resolveLastUserTextByUserPromptTemp(
				threadId,
				lastUserMessage as ChatMessage,
				model,
			);
			resolvedMessages = [...prevResolvedMessages, resolvedLastMessage];
		}
	}

	const convertedMessages = await convertToModelMessages(
		enhanceMessagesWithFeedback(resolvedMessages),
	);

	const streamTextOptions = {
		model: wrapModel,
		messages: convertedMessages,
		...(systemPrompt && { system: systemPrompt }),
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	// Check if model supports streaming (image generation models don't)
	if (!isStreamingSupported(model)) {
		console.log(`[openai] Model ${model} does not support streaming, using generateText`);

		// Use createUIMessageStreamFromGenerator for immediate start event and async content generation
		const stream = createUIMessageStreamFromGenerator(
			async () => {
				const result = await generateText(streamTextOptions);
				return result.text || "";
			},
			model,
			"openai",
		);

		return new Response(stream, {
			status: 200,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"x-vercel-ai-ui-message-stream": "v1",
			},
		});
	}

	// Stream the main text response using Agent
	// Note: Agent uses 'instructions' for system prompt, not 'system'
	const agentConfig = {
		model: wrapModel,
		...(systemPrompt && { instructions: systemPrompt }),
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
		stopWhen: stepCountIs(20),
	};
	addDefinedParams(agentConfig, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const result = await new Agent(agentConfig).stream({
		messages: convertedMessages,
		...(speedOptions?.enabled && {
			experimental_transform: smoothStream({
				chunking: smartChunking,
				delayInMs: getDelayForSpeed(speedOptions.speed),
			}),
		}),
	});

	const stream = result.toUIMessageStream({
		messageMetadata: () => ({
			model,
			provider: "openai",
			createdAt: new Date().toISOString(),
		}),
	});

	return createUIMessageStreamResponse({ stream });
});

app.post("/chat/anthropic", async (c) => {
	const {
		baseUrl,
		model = "claude-sonnet-4-20250514",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isMCPActive,
		mcpServerIds = [],
		messages,
		speedOptions,
		language: _language,
		systemPrompt,
		threadId,
	} = await c.req.json<{
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		isMCPActive?: boolean;
		mcpServerIds?: string[];
		speedOptions?: {
			enabled: boolean;
			speed: "slow" | "normal" | "fast";
		};
		messages: UIMessage[];
		language?: string;
		systemPrompt?: string;
		threadId: string;
	}>();

	const anthropic = createAnthropic({
		baseURL: baseUrl || "https://api.anthropic.com/v1",
		apiKey: apiKey || "[REDACTED:sk-secret]",
	});

	const wrapModel = wrapLanguageModel({
		model: anthropic.chat(model),
		middleware: [
			extractReasoningMiddleware({ tagName: "think" }),
			extractReasoningMiddleware({ tagName: "thinking" }),
		],
	});

	// Get MCP tools if MCP is active
	let mcpTools = undefined;
	if (isMCPActive && mcpServerIds.length > 0) {
		try {
			const allServers = await storageService.getItemInternal("app-mcp-servers");
			if (allServers) {
				mcpTools = await mcpService.getToolsFromServerIds(mcpServerIds, allServers as McpServer[]);
				console.log(`Loaded ${mcpTools.length} tools from MCP servers`);
			}
		} catch (error) {
			console.error("Failed to load MCP tools:", error);
		}
	}

	// Resolve user prompt template variables
	let resolvedMessages = messages;
	if (await chatParametersService.validateUserPromptTemplateVariables(threadId)) {
		// Find the last user message
		const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user");
		if (lastUserMessage) {
			// Resolve previous user messages (using metadata)
			const prevResolvedMessages = await chatParametersService.resolvePrevUserMsgsByUserPromptTemp(
				threadId,
				model,
				lastUserMessage.id, // Exclude last user message to avoid duplicate processing
			);
			// Resolve last user message (using storage)
			const resolvedLastMessage = await chatParametersService.resolveLastUserTextByUserPromptTemp(
				threadId,
				lastUserMessage as ChatMessage,
				model,
			);
			resolvedMessages = [...prevResolvedMessages, resolvedLastMessage];
		}
	}

	const convertedMessages = await convertToModelMessages(
		enhanceMessagesWithFeedback(resolvedMessages),
	);

	const streamTextOptions = {
		model: wrapModel,
		messages: convertedMessages,
		...(systemPrompt && { system: systemPrompt }),
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	// Check if model supports streaming (image generation models don't)
	if (!isStreamingSupported(model)) {
		console.log(`[anthropic] Model ${model} does not support streaming, using generateText`);

		// Use createUIMessageStreamFromGenerator for immediate start event and async content generation
		const stream = createUIMessageStreamFromGenerator(
			async () => {
				const result = await generateText(streamTextOptions);
				return result.text || "";
			},
			model,
			"anthropic",
		);

		return new Response(stream, {
			status: 200,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"x-vercel-ai-ui-message-stream": "v1",
			},
		});
	}

	// Stream the main text response using Agent
	// Note: Agent uses 'instructions' for system prompt, not 'system'
	const agentConfig = {
		model: wrapModel,
		...(systemPrompt && { instructions: systemPrompt }),
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
		stopWhen: stepCountIs(20),
	};
	addDefinedParams(agentConfig, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const result = await new Agent(agentConfig).stream({
		messages: convertedMessages,
		...(speedOptions?.enabled && {
			experimental_transform: smoothStream({
				chunking: smartChunking,
				delayInMs: getDelayForSpeed(speedOptions.speed),
			}),
		}),
	});

	const stream = result.toUIMessageStream({
		messageMetadata: () => ({
			model,
			provider: "anthropic",
			createdAt: new Date().toISOString(),
		}),
	});

	return createUIMessageStreamResponse({ stream });
});

app.post("/chat/gemini", async (c) => {
	const {
		baseUrl,
		model = "gemini-2.0-flash-exp",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isMCPActive,
		mcpServerIds = [],
		messages,
		speedOptions,
		language: _language,
		systemPrompt,
		threadId,
	} = await c.req.json<{
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		isMCPActive?: boolean;
		mcpServerIds?: string[];
		speedOptions?: {
			enabled: boolean;
			speed: "slow" | "normal" | "fast";
		};
		messages: UIMessage[];
		language?: string;
		systemPrompt?: string;
		threadId: string;
	}>();

	const google = createGoogleGenerativeAI({
		baseURL: baseUrl || "https://generativelanguage.googleapis.com/v1beta",
		apiKey: apiKey || "[REDACTED:sk-secret]",
	});

	const wrapModel = wrapLanguageModel({
		model: google.chat(model),
		middleware: [
			extractReasoningMiddleware({ tagName: "think" }),
			extractReasoningMiddleware({ tagName: "thinking" }),
		],
	});

	// Get MCP tools if MCP is active
	let mcpTools = undefined;
	if (isMCPActive && mcpServerIds.length > 0) {
		try {
			const allServers = await storageService.getItemInternal("app-mcp-servers");
			if (allServers) {
				mcpTools = await mcpService.getToolsFromServerIds(mcpServerIds, allServers as McpServer[]);
				console.log(`Loaded ${mcpTools.length} tools from MCP servers`);
			}
		} catch (error) {
			console.error("Failed to load MCP tools:", error);
		}
	}

	let resolvedMessages = messages;
	if (await chatParametersService.validateUserPromptTemplateVariables(threadId)) {
		// Find the last user message
		const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user");
		if (lastUserMessage) {
			// Resolve previous user messages (using metadata)
			const prevResolvedMessages = await chatParametersService.resolvePrevUserMsgsByUserPromptTemp(
				threadId,
				model,
				lastUserMessage.id, // Exclude last user message to avoid duplicate processing
			);
			// Resolve last user message (using storage)
			const resolvedLastMessage = await chatParametersService.resolveLastUserTextByUserPromptTemp(
				threadId,
				lastUserMessage as ChatMessage,
				model,
			);
			resolvedMessages = [...prevResolvedMessages, resolvedLastMessage];
		}
	}

	const convertedMessages = await convertToModelMessages(
		enhanceMessagesWithFeedback(resolvedMessages),
	);

	const streamTextOptions = {
		model: wrapModel,
		messages: convertedMessages,
		...(systemPrompt && { system: systemPrompt }),
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	// Check if model supports streaming (image generation models don't)
	if (!isStreamingSupported(model)) {
		console.log(`[gemini] Model ${model} does not support streaming, using generateText`);

		// Use createUIMessageStreamFromGenerator for immediate start event and async content generation
		const stream = createUIMessageStreamFromGenerator(
			async () => {
				const result = await generateText(streamTextOptions);
				return result.text || "";
			},
			model,
			"gemini",
		);

		return new Response(stream, {
			status: 200,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"x-vercel-ai-ui-message-stream": "v1",
			},
		});
	}

	// Stream the main text response using Agent
	// Note: Agent uses 'instructions' for system prompt, not 'system'
	const agentConfig = {
		model: wrapModel,
		...(systemPrompt && { instructions: systemPrompt }),
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
		stopWhen: stepCountIs(20),
	};
	addDefinedParams(agentConfig, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const result = await new Agent(agentConfig).stream({
		messages: convertedMessages,
		...(speedOptions?.enabled && {
			experimental_transform: smoothStream({
				chunking: smartChunking,
				delayInMs: getDelayForSpeed(speedOptions.speed),
			}),
		}),
	});

	const stream = result.toUIMessageStream({
		messageMetadata: () => ({
			model,
			provider: "gemini",
			createdAt: new Date().toISOString(),
		}),
	});

	return createUIMessageStreamResponse({ stream });
});

app.post("/generate-title", async (c) => {
	const {
		lastAssistantMessage,
		lastUserMessage,
		previousSummary,
		model,
		apiKey,
		baseUrl,
		providerType,
	} = await c.req.json<{
		lastAssistantMessage?: string;
		lastUserMessage: string;
		previousSummary?: string;
		model: string;
		apiKey?: string;
		baseUrl?: string;
		providerType: ModelProvider["apiType"];
	}>();

	let languageModel;
	switch (providerType) {
		case "302ai": {
			const openai = createOpenAICompatible({
				name: "302.AI",
				baseURL: baseUrl || "https://api.openai.com/v1",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = openai.chatModel(model);
			break;
		}
		case "openai": {
			const openai = createOpenAI({
				baseURL: baseUrl || "https://api.openai.com/v1",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = openai.chat(model);
			break;
		}
		case "anthropic": {
			const anthropic = createAnthropic({
				baseURL: baseUrl || "https://api.anthropic.com/v1",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = anthropic.chat(model);
			break;
		}
		case "gemini": {
			const google = createGoogleGenerativeAI({
				baseURL: baseUrl || "https://generativelanguage.googleapis.com/v1beta",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = google.chat(model);
			break;
		}
		default:
			return c.json({ error: "Invalid provider type" }, 400);
	}

	try {
		let prompt: string;

		if (!previousSummary) {
			// First time: only user's first message -> generate summary1 + title1
			prompt = `Based on the following user message, generate a JSON response with a concise title and a brief summary.

User message:
${lastUserMessage}

Requirements:
- title: A concise title (10-20 words in English, or 10-20 characters in Chinese, no punctuation)
- summary: A brief summary of the conversation so far (1-2 sentences, max 100 words)
- Return ONLY valid JSON in this format: {"title": "...", "summary": "..."}`;
		} else {
			// Subsequent times: previous summary + last AI reply + new user message -> generate new summary + title
			const contextParts: string[] = [];
			contextParts.push(`Previous summary: ${previousSummary}`);
			if (lastAssistantMessage) {
				contextParts.push(`Last AI reply: ${lastAssistantMessage}`);
			}
			contextParts.push(`New user message: ${lastUserMessage}`);

			prompt = `Based on the following context, generate an updated JSON response with a concise title and an updated summary.

${contextParts.join("\n\n")}

Requirements:
- title: A concise title reflecting the current topic (10-20 words in English, or 10-20 characters in Chinese, no punctuation)
- summary: An updated brief summary incorporating the new exchange (1-2 sentences, max 100 words)
- Return ONLY valid JSON in this format: {"title": "...", "summary": "..."}`;
		}

		const { text } = await generateText({
			model: languageModel,
			prompt,
		});

		// Parse JSON response
		let cleanText = text.trim();
		// Remove markdown code blocks if present
		if (cleanText.startsWith("```")) {
			cleanText = cleanText
				.replace(/```json?\n?/g, "")
				.replace(/```/g, "")
				.trim();
		}

		try {
			const result = JSON.parse(cleanText);
			return c.json({
				title: result.title?.trim() || "",
				summary: result.summary?.trim() || "",
			});
		} catch (parseError) {
			console.error("Failed to parse title generation JSON:", parseError, "Raw text:", text);
			// Fallback: use the raw text as title, no summary
			return c.json({
				title: cleanText.substring(0, 50),
				summary: previousSummary || "",
			});
		}
	} catch (error) {
		console.error("Title generation error:", error);
		return c.json({ error: "Failed to generate title" }, 500);
	}
});

app.post("/generate-suggestions", async (c) => {
	const {
		messages,
		model,
		apiKey,
		baseUrl,
		providerType,
		language,
		count = 3,
	} = await c.req.json<{
		messages: UIMessage[];
		model: string;
		apiKey?: string;
		baseUrl?: string;
		providerType: ModelProvider["apiType"];
		language?: string;
		count?: number;
	}>();

	let languageModel;
	switch (providerType) {
		case "302ai": {
			const openai = createOpenAICompatible({
				name: "302.AI",
				baseURL: baseUrl || "https://api.openai.com/v1",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = openai.chatModel(model);
			break;
		}
		case "openai": {
			const openai = createOpenAI({
				baseURL: baseUrl || "https://api.openai.com/v1",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = openai.chat(model);
			break;
		}
		case "anthropic": {
			const anthropic = createAnthropic({
				baseURL: baseUrl || "https://api.anthropic.com/v1",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = anthropic.chat(model);
			break;
		}
		case "gemini": {
			const google = createGoogleGenerativeAI({
				baseURL: baseUrl || "https://generativelanguage.googleapis.com/v1beta",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = google.chat(model);
			break;
		}
		default:
			return c.json({ error: "Invalid provider type" }, 400);
	}

	try {
		console.log("[Suggestions] Starting to generate suggestions...");
		const convertedMessages = await convertToModelMessages(enhanceMessagesWithFeedback(messages));
		const { text } = await generateText({
			model: languageModel,
			messages: [
				...convertedMessages,
				{
					role: "user",
					content: getSuggestionsPrompt(language, count),
				},
			],
		});

		console.log("[Suggestions] Received text:", text);

		// Parse the JSON array
		try {
			// Clean up the text - remove markdown code blocks if present
			let cleanText = text.trim();
			if (cleanText.startsWith("```")) {
				cleanText = cleanText
					.replace(/```json?\n?/g, "")
					.replace(/```/g, "")
					.trim();
			}

			const suggestions = JSON.parse(cleanText);
			if (Array.isArray(suggestions) && suggestions.length > 0) {
				console.log("[Suggestions] Parsed suggestions:", suggestions);
				return c.json({ suggestions: suggestions.slice(0, count) });
			} else {
				console.log("[Suggestions] Invalid suggestions format");
				return c.json({ suggestions: [] });
			}
		} catch (parseError) {
			console.error("[Suggestions] Failed to parse JSON:", parseError);
			return c.json({ suggestions: [] });
		}
	} catch (error) {
		console.error("[Suggestions] Failed to generate suggestions:", error);
		return c.json({ suggestions: [] });
	}
});

app.post("/chat/302ai-code-agent", async (c) => {
	const {
		baseUrl,
		model = "claude-sonnet-4-5-20250929",
		apiKey,
		messages,
		threadId,
		sessionId,
	} = await c.req.json<RouterRequestBody>();

	const { sandboxId } = await codeAgentService.getClaudeCodeSandboxId(threadId);

	console.log("[302ai-code-agent] Received request", baseUrl, sandboxId, threadId, sessionId);

	// Generate messageId upfront for immediate start event
	const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

	// Use createClaudeCodeFetch to get the transformed stream directly
	const claudeCodeFetch = createClaudeCodeFetch(messageId);

	// Build request body for 302.AI Claude Code API
	const convertedMessages = await convertToModelMessages(enhanceMessagesWithFeedback(messages));
	const lastAiSdkModelMessage = convertedMessages.at(-1);
	const openAiMessages = convertAiSdkMessagesToOpenAiMessages(
		lastAiSdkModelMessage ? [lastAiSdkModelMessage] : [],
	);

	const requestBody = {
		model: sandboxId,
		messages: openAiMessages,
		session_id: sessionId ?? "",
		structured_output: true,
	};

	console.log("[302ai-code-agent] Messages:", JSON.stringify(requestBody.messages));
	console.log("[302ai-code-agent] Sending request to 302.AI...");
	console.log("[302ai-code-agent] Request body:", JSON.stringify(requestBody).substring(0, 500));

	// Create immediate start event for optimistic UI update
	// Include messageMetadata with model and provider info so the UI shows correct icon/name
	const encoder = new TextEncoder();
	const immediateStartEvent = `data: ${JSON.stringify({
		type: "start",
		messageId,
		messageMetadata: {
			model,
			provider: "302ai-code-agent",
			createdAt: new Date().toISOString(),
		},
	})}\n\n`;

	// Make the request using the custom fetch that transforms the response
	const abortController = new AbortController();
	const responsePromise = claudeCodeFetch(
		`${baseUrl ?? "https://api.302.ai/v1"}/chat/completions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(requestBody),
			signal: abortController.signal,
		},
	);

	// Create a combined stream that sends start immediately, then pipes upstream data
	const combinedStream = new ReadableStream({
		async start(controller) {
			// Send start event immediately for optimistic UI update
			controller.enqueue(encoder.encode(immediateStartEvent));
			console.log("[302ai-code-agent] Sent immediate start event");

			try {
				const response = await responsePromise;

				if (!response.ok) {
					const errorText = await response.text();
					console.error("[302ai-code-agent] API error:", response.status, errorText);
					// Send error as text-delta so user sees it
					const errorId = `error-${Date.now()}`;
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({ type: "text-start", id: errorId })}\n\n`),
					);
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ type: "text-delta", id: errorId, delta: `**Error**: ${errorText}` })}\n\n`,
						),
					);
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({ type: "text-end", id: errorId })}\n\n`),
					);
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ type: "finish", finishReason: "error" })}\n\n`,
						),
					);
					controller.close();
					return;
				}

				console.log("[302ai-code-agent] Got response, streaming...");

				// Pipe the transformed stream from ClaudeCodeProcessor
				const reader = response.body?.getReader();
				if (!reader) {
					controller.close();
					return;
				}

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							controller.close();
							break;
						}
						try {
							controller.enqueue(value);
						} catch (_error) {
							// Client disconnected or controller closed
							console.log("[302ai-code-agent] Controller closed, stopping stream");
							reader.cancel();
							abortController.abort();
							break;
						}
					}
				} catch (error) {
					console.error("[302ai-code-agent] Reader error:", error);
					reader.cancel().catch(() => {
						// Ignore cancel errors
					});
					throw error;
				}
			} catch (error) {
				console.error("[302ai-code-agent] Stream error:", error);
				const errorId = `error-${Date.now()}`;
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type: "text-start", id: errorId })}\n\n`),
				);
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ type: "text-delta", id: errorId, delta: `**Error**: ${errorMessage}` })}\n\n`,
					),
				);
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type: "text-end", id: errorId })}\n\n`),
				);
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type: "finish", finishReason: "error" })}\n\n`),
				);
				controller.close();
			}
		},
	});

	return new Response(combinedStream, {
		status: 200,
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"x-vercel-ai-ui-message-stream": "v1",
		},
	});
});

// Helper function to render SSO callback page
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderSsoCallbackPage(c: Context<any>, apikey: string | undefined, lang: string) {
	// Simple i18n for callback page
	const i18n = {
		zh: {
			successTitle: "登录成功",
			successMessage: "您可以关闭此页面，返回应用继续使用",
			errorTitle: "登录失败",
			errorMessage: "未收到有效的 API Key",
		},
		en: {
			successTitle: "Login Successful",
			successMessage: "You can close this page and return to the app",
			errorTitle: "Login Failed",
			errorMessage: "No valid API Key received",
		},
	};

	const t = i18n[lang as "zh" | "en"] || i18n.zh;

	if (apikey) {
		// Notify SSO service
		ssoService.handleSsoCallbackFromServer(apikey);

		// Return success page
		return c.html(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>${t.successTitle}</title>
				<meta charset="utf-8">
				<style>
					body {
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
						display: flex;
						align-items: center;
						justify-content: center;
						height: 100vh;
						margin: 0;
						background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
					}
					.container {
						text-align: center;
						background: white;
						padding: 40px;
						border-radius: 20px;
						box-shadow: 0 10px 40px rgba(0,0,0,0.2);
					}
					.icon {
						font-size: 64px;
						margin-bottom: 20px;
					}
					h1 {
						color: #333;
						margin: 0 0 10px 0;
					}
					p {
						color: #666;
						margin: 0;
					}
				</style>
			</head>
			<body>
				<div class="container">
					<div class="icon">✓</div>
					<h1>${t.successTitle}</h1>
					<p>${t.successMessage}</p>
				</div>
				<script>
					setTimeout(() => window.close(), 2000);
				</script>
			</body>
			</html>
		`);
	}

	return c.html(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>${t.errorTitle}</title>
			<meta charset="utf-8">
			<style>
				body {
					font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
					display: flex;
					align-items: center;
					justify-content: center;
					height: 100vh;
					margin: 0;
					background: #f5f5f5;
				}
				.container {
					text-align: center;
					background: white;
					padding: 40px;
					border-radius: 20px;
					box-shadow: 0 10px 40px rgba(0,0,0,0.1);
				}
				.icon {
					font-size: 64px;
					margin-bottom: 20px;
					color: #f56c6c;
				}
				h1 {
					color: #333;
					margin: 0 0 10px 0;
				}
				p {
					color: #666;
					margin: 0;
				}
			</style>
		</head>
		<body>
			<div class="container">
				<div class="icon">✗</div>
				<h1>${t.errorTitle}</h1>
				<p>${t.errorMessage}</p>
			</div>
		</body>
		</html>
	`);
}

// SSO callback endpoint - language is now in path to avoid query param conflicts
// 302.AI appends ?apikey=... to redirect URL, so we use path for language
app.get("/sso/callback/:lang", async (c) => {
	const apikey = c.req.query("apikey");
	const uid = c.req.query("uid");
	const username = c.req.query("username");
	const lang = c.req.param("lang") || "zh"; // Get language from path param

	console.log("[SSO Callback] Received:", {
		apikey: apikey ? "exists" : "missing",
		uid,
		username,
		lang,
	});

	return renderSsoCallbackPage(c, apikey, lang);
});

// Backwards compatibility: handle old format with lang in query params
// Also handles malformed URLs where apikey might be embedded in lang param
app.get("/sso/callback", async (c) => {
	let apikey = c.req.query("apikey");
	const uid = c.req.query("uid");
	const username = c.req.query("username");
	let lang = c.req.query("lang") || "zh";

	// Handle malformed URL: ?lang=zh?apikey=xxx becomes lang="zh?apikey=xxx"
	// Extract apikey from lang if it contains ?apikey=
	if (!apikey && lang.includes("?apikey=")) {
		const match = lang.match(/\?apikey=([^&]+)/);
		if (match) {
			apikey = match[1];
			// Extract actual language
			lang = lang.split("?")[0] || "zh";
		}
	}

	console.log("[SSO Callback Legacy] Received:", {
		apikey: apikey ? "exists" : "missing",
		uid,
		username,
		lang,
	});

	return renderSsoCallbackPage(c, apikey, lang);
});

export async function initServer(preferredPort = 8089): Promise<number> {
	const port = await getPort({ port: preferredPort });

	serve({
		fetch: app.fetch,
		port,
		hostname: "localhost",
	});

	console.log(`Server started successfully on port ${port}`);
	return port;
}
