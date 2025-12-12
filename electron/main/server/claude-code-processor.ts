/**
 * 302.AI Claude Code SSE Response Processor
 *
 * This processor transforms 302.AI Claude Code's SSE format to AI SDK UIMessageStream format.
 *
 * Input format (302.AI Claude Code - Anthropic format):
 * - {"type":"alias_info","session_alias":"..."} - Skip
 * - {"type":"system","subtype":"init",...} - Skip
 * - {"type":"stream_event","event":{"type":"message_start",...}} - Extract message info
 * - {"type":"stream_event","event":{"type":"content_block_start","content_block":{"type":"text",...}}} - text-start
 * - {"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}} - text-delta
 * - {"type":"stream_event","event":{"type":"content_block_start","content_block":{"type":"tool_use",...}}} - tool-input-start
 * - {"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"input_json_delta",...}}} - tool-input-delta
 * - {"type":"stream_event","event":{"type":"content_block_stop",...}} - text-end or tool-input-available
 * - {"type":"user","message":{"content":[{"type":"tool_result",...}]}} - tool-result
 *
 * Output format (AI SDK UIMessageStream SSE):
 * - {"type":"start","messageId":"..."}
 * - {"type":"text-start","id":"..."}
 * - {"type":"text-delta","id":"...","delta":"..."}
 * - {"type":"text-end","id":"..."}
 * - {"type":"tool-input-start","toolCallId":"...","toolName":"..."}
 * - {"type":"tool-input-delta","toolCallId":"...","inputTextDelta":"..."}
 * - {"type":"tool-input-available","toolCallId":"...","toolName":"...","input":{...}}
 * - {"type":"tool-output-available","toolCallId":"...","output":{...}} - Tool execution result
 * - {"type":"finish"} - Final message completion (only sent at end_turn)
 *
 * Note: No finish-step/start-step events are sent for tool calls.
 * The stream continues naturally after tool-input-available and tool-output-available.
 */

interface ClaudeCodeEvent {
	type: string;
	subtype?: string;
	session_alias?: string;
	event?: AnthropicEvent;
	message?: {
		id?: string;
		role?: string;
		model?: string;
		content: Array<{
			type: string;
			// For tool_result
			tool_use_id?: string;
			content?: string | Array<{ type: string; text?: string }>;
			is_error?: boolean;
			// For tool_use (sub-agent tool calls)
			id?: string;
			name?: string;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			input?: any;
		}>;
	};
	// Parent tool use ID for sub-agent events
	parent_tool_use_id?: string | null;
	// Result event fields (302.AI specific)
	is_error?: boolean;
	duration_ms?: number;
	duration_api_ms?: number;
	num_turns?: number;
	choices?: Array<{
		index: number;
		delta: { content?: string };
		finish_reason?: string | null;
	}>;
	session_id?: string;
	total_cost_usd?: number;
	uuid?: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
}

interface AnthropicEvent {
	type: string;
	index?: number;
	message?: {
		id: string;
		role: string;
		model: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	};
	content_block?: {
		type: string;
		text?: string;
		id?: string;
		name?: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		input?: any;
	};
	delta?: {
		type: string;
		text?: string;
		partial_json?: string;
		stop_reason?: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
}

interface ContentBlockState {
	type: "text" | "tool_use";
	id: string;
	toolName?: string;
	toolCallId?: string;
	inputJsonParts: string[];
}

/**
 * OpenAI compatible streaming format (used by /deploy command)
 */
interface OpenAIStreamChunk {
	id: string;
	object: "chat.completion.chunk";
	created: number;
	model: string;
	choices: Array<{
		index: number;
		delta: {
			role?: string;
			content?: string;
		};
		finish_reason: string | null;
	}>;
}

/**
 * Error payload from upstream (e.g., sandbox deployment failures)
 */
interface OpenAIErrorPayload {
	error: {
		message: string;
		type: string;
		code: string;
		param: string | null;
	};
}

class ClaudeCodeProcessor {
	private messageId: string = "";
	private buffer: string = "";
	private contentBlocks: Map<number, ContentBlockState> = new Map();
	private hasStarted: boolean = false;
	private textBlockCounter: number = 0;
	// Store pending finish event to send after message-metadata
	private pendingFinishEvent: string | null = null;
	// Track if we're in OpenAI streaming mode (for /deploy command)
	private openaiTextId: string | null = null;

	constructor(preGeneratedMessageId?: string) {
		if (preGeneratedMessageId) {
			// Use pre-generated messageId and skip sending start event
			// (start event was already sent immediately for optimistic UI)
			this.messageId = preGeneratedMessageId;
			this.hasStarted = true; // Mark as started to skip generating start event
		} else {
			this.messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
		}
	}

	processSSEChunk(chunk: string): string {
		this.buffer += chunk;

		// SSE events are separated by double newlines
		const events = this.buffer.split("\n\n");
		const processedEvents: string[] = [];

		// Keep the last potentially incomplete event in the buffer
		this.buffer = events.pop() ?? "";

		for (const event of events) {
			const lines = event.split("\n");
			for (const line of lines) {
				const processed = this.processLine(line);
				if (processed) {
					processedEvents.push(processed);
				}
			}
		}

		return processedEvents.length > 0 ? processedEvents.join("\n\n") + "\n\n" : "";
	}

	private processLine(line: string): string | null {
		// Skip empty lines
		if (!line.trim()) {
			return null;
		}

		// Skip event: lines (SSE event type markers)
		if (line.startsWith("event:")) {
			return null;
		}

		// Handle data: lines
		if (!line.startsWith("data: ")) {
			return null;
		}

		const jsonStr = line.substring(6).trim();

		// Handle [DONE] marker
		if (jsonStr === "[DONE]") {
			return "data: [DONE]";
		}

		try {
			const data = JSON.parse(jsonStr) as ClaudeCodeEvent;
			return this.transformEvent(data);
		} catch {
			// If JSON parsing fails, skip
			return null;
		}
	}

	private transformEvent(data: ClaudeCodeEvent): string | null {
		// Skip 302.AI Claude Code specific metadata events
		if (data.type === "alias_info" || data.type === "system") {
			return null;
		}

		// Handle error payload from upstream (e.g., sandbox deployment failures)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((data as any).error) {
			return this.handleErrorPayload(data as unknown as OpenAIErrorPayload);
		}

		// Handle OpenAI compatible streaming format (used by /deploy command)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((data as any).object === "chat.completion.chunk") {
			return this.handleOpenAIStreamChunk(data as unknown as OpenAIStreamChunk);
		}

		// Handle result event - extract metadata for storage
		if (data.type === "result") {
			return this.handleResultEvent(data);
		}

		// Handle assistant messages (sub-agent tool calls)
		// These contain tool_use content that needs tool-input-start and tool-input-available
		if (data.type === "assistant" && data.message?.content) {
			return this.handleAssistantMessage(data);
		}

		// Handle tool result events from user messages
		if (data.type === "user" && data.message?.content) {
			return this.handleToolResultMessage(data);
		}

		// Handle stream_event wrapper
		if (data.type === "stream_event" && data.event) {
			return this.transformAnthropicEvent(data.event);
		}

		return null;
	}

	/**
	 * Handle OpenAI compatible streaming format (used by /deploy command)
	 * Converts OpenAI chat.completion.chunk to AI SDK text events
	 */
	private handleOpenAIStreamChunk(data: OpenAIStreamChunk): string | null {
		const results: string[] = [];
		const choice = data.choices[0];

		if (!choice) return null;

		// First chunk with role - send start and text-start
		if (choice.delta.role === "assistant" && !this.openaiTextId) {
			this.openaiTextId = `text-${this.textBlockCounter++}`;

			// Send start event if not already started
			if (!this.hasStarted) {
				this.hasStarted = true;
				this.messageId = data.id;
				const startEvent = {
					type: "start",
					messageId: this.messageId,
				};
				results.push(`data: ${JSON.stringify(startEvent)}`);
			}

			// Send text-start
			const textStartEvent = {
				type: "text-start",
				id: this.openaiTextId,
			};
			results.push(`data: ${JSON.stringify(textStartEvent)}`);
		}

		// Content delta
		if (choice.delta.content && this.openaiTextId) {
			const textDeltaEvent = {
				type: "text-delta",
				id: this.openaiTextId,
				delta: choice.delta.content,
			};
			results.push(`data: ${JSON.stringify(textDeltaEvent)}`);
		}

		// Finish reason - send text-end and finish
		if (choice.finish_reason === "stop" && this.openaiTextId) {
			// Send text-end
			const textEndEvent = {
				type: "text-end",
				id: this.openaiTextId,
			};
			results.push(`data: ${JSON.stringify(textEndEvent)}`);

			// Send finish (UIMessageStream schema only accepts {type: "finish"} with optional messageMetadata)
			const finishEvent = {
				type: "finish",
			};
			results.push(`data: ${JSON.stringify(finishEvent)}`);

			// Reset openai text id
			this.openaiTextId = null;
		}

		// Error finish reason - close text block but wait for error payload
		if (choice.finish_reason === "error" && this.openaiTextId) {
			// Send text-end to properly close the text block
			const textEndEvent = {
				type: "text-end",
				id: this.openaiTextId,
			};
			results.push(`data: ${JSON.stringify(textEndEvent)}`);

			// Reset openai text id - error payload will come separately
			this.openaiTextId = null;
		}

		return results.length > 0 ? results.join("\n\n") : null;
	}

	/**
	 * Handle error payload from upstream (e.g., sandbox deployment failures)
	 * Converts error payload to AI SDK error event
	 */
	private handleErrorPayload(data: OpenAIErrorPayload): string | null {
		const results: string[] = [];

		// Send error event with message from upstream
		const errorEvent = {
			type: "error",
			errorText: data.error.message,
		};
		results.push(`data: ${JSON.stringify(errorEvent)}`);

		// Send finish event to properly close the stream
		const finishEvent = {
			type: "finish",
		};
		results.push(`data: ${JSON.stringify(finishEvent)}`);

		return results.join("\n\n");
	}

	private handleResultEvent(data: ClaudeCodeEvent): string | null {
		// Extract relevant fields from result event
		const resultMetadata = {
			type: data.type,
			subtype: data.subtype,
			is_error: data.is_error,
			duration_ms: data.duration_ms,
			duration_api_ms: data.duration_api_ms,
			num_turns: data.num_turns,
			content: data.choices?.[0]?.delta?.content ?? "",
			session_id: data.session_id,
			total_cost_usd: data.total_cost_usd,
			uuid: data.uuid,
		};

		// Send as message-metadata event for frontend to process
		const metadataEvent = {
			type: "message-metadata",
			metadata: resultMetadata,
		};

		const metadataStr = `data: ${JSON.stringify(metadataEvent)}`;

		// If there's a pending finish event, send metadata first, then finish
		// This ensures onFinish callback receives the metadata
		if (this.pendingFinishEvent) {
			const result = `${metadataStr}\n\n${this.pendingFinishEvent}`;
			this.pendingFinishEvent = null;
			return result;
		}

		return metadataStr;
	}

	/**
	 * Handle assistant messages from sub-agents.
	 * These contain tool_use content blocks that need to be converted to
	 * tool-input-start and tool-input-available events.
	 */
	private handleAssistantMessage(data: ClaudeCodeEvent): string | null {
		const results: string[] = [];

		for (const content of data.message?.content || []) {
			if (content.type === "tool_use" && content.id && content.name) {
				const toolCallId = content.id;
				const toolName = content.name;
				const input = content.input || {};

				// Generate tool-input-start event
				const toolStartEvent = {
					type: "tool-input-start",
					toolCallId: toolCallId,
					toolName: toolName,
				};
				results.push(`data: ${JSON.stringify(toolStartEvent)}`);

				// Generate tool-input-available event with full input
				const toolInputAvailableEvent = {
					type: "tool-input-available",
					toolCallId: toolCallId,
					toolName: toolName,
					input: input,
				};
				results.push(`data: ${JSON.stringify(toolInputAvailableEvent)}`);
			}
		}

		return results.length > 0 ? results.join("\n\n") : null;
	}

	private handleToolResultMessage(data: ClaudeCodeEvent): string | null {
		const results: string[] = [];

		for (const content of data.message?.content || []) {
			if (content.type === "tool_result" && content.tool_use_id) {
				// Extract the result content
				let resultContent: unknown;

				if (typeof content.content === "string") {
					// Try to parse as JSON, otherwise use as string
					try {
						resultContent = JSON.parse(content.content);
					} catch {
						resultContent = content.content;
					}
				} else if (Array.isArray(content.content)) {
					// Extract text from content array
					const textParts = content.content
						.filter((c) => c.type === "text" && c.text)
						.map((c) => c.text)
						.join("\n");
					try {
						resultContent = JSON.parse(textParts);
					} catch {
						resultContent = textParts;
					}
				} else {
					resultContent = content.content;
				}

				// AI SDK 5.0 uses tool-output-available instead of tool-result
				const toolOutputEvent = {
					type: "tool-output-available",
					toolCallId: content.tool_use_id,
					output: resultContent,
				};

				results.push(`data: ${JSON.stringify(toolOutputEvent)}`);
			}
		}

		return results.length > 0 ? results.join("\n\n") : null;
	}

	private transformAnthropicEvent(event: AnthropicEvent): string | null {
		switch (event.type) {
			case "message_start":
				return this.handleMessageStart(event);
			case "content_block_start":
				return this.handleContentBlockStart(event);
			case "content_block_delta":
				return this.handleContentBlockDelta(event);
			case "content_block_stop":
				return this.handleContentBlockStop(event);
			case "message_delta":
				return this.handleMessageDelta(event);
			case "message_stop":
				// Don't send [DONE] here, let finish handle it
				return null;
			case "ping":
				return null;
			default:
				return null;
		}
	}

	private handleMessageStart(event: AnthropicEvent): string | null {
		if (event.message) {
			this.messageId = event.message.id || this.messageId;

			if (!this.hasStarted) {
				this.hasStarted = true;
				const startEvent = {
					type: "start",
					messageId: this.messageId,
				};
				return `data: ${JSON.stringify(startEvent)}`;
			}
			// For subsequent message_start events (after tool execution),
			// we don't send a new start event - the start-step was already sent
			// in handleToolResultMessage
		}
		return null;
	}

	private handleContentBlockStart(event: AnthropicEvent): string | null {
		const contentBlock = event.content_block;
		const index = event.index ?? 0;

		if (!contentBlock) return null;

		if (contentBlock.type === "text") {
			const textId = `text-${this.textBlockCounter++}`;
			this.contentBlocks.set(index, {
				type: "text",
				id: textId,
				inputJsonParts: [],
			});

			const textStartEvent = {
				type: "text-start",
				id: textId,
			};

			// If there's initial text content, include it
			if (contentBlock.text) {
				const textDeltaEvent = {
					type: "text-delta",
					id: textId,
					delta: contentBlock.text,
				};
				return `data: ${JSON.stringify(textStartEvent)}\n\ndata: ${JSON.stringify(textDeltaEvent)}`;
			}

			return `data: ${JSON.stringify(textStartEvent)}`;
		}

		if (contentBlock.type === "tool_use") {
			const toolCallId = contentBlock.id || `call_${Date.now()}`;
			const toolName = contentBlock.name || "unknown";

			this.contentBlocks.set(index, {
				type: "tool_use",
				id: toolCallId,
				toolName: toolName,
				toolCallId: toolCallId,
				inputJsonParts: [],
			});

			// AI SDK 5.0 uses tool-input-start instead of tool-call-streaming-start
			const toolStartEvent = {
				type: "tool-input-start",
				toolCallId: toolCallId,
				toolName: toolName,
			};

			return `data: ${JSON.stringify(toolStartEvent)}`;
		}

		return null;
	}

	private handleContentBlockDelta(event: AnthropicEvent): string | null {
		const delta = event.delta;
		const index = event.index ?? 0;

		if (!delta) return null;

		const blockState = this.contentBlocks.get(index);

		if (delta.type === "text_delta" && delta.text) {
			const textId = blockState?.id || `text-${index}`;
			const textDeltaEvent = {
				type: "text-delta",
				id: textId,
				delta: delta.text,
			};
			return `data: ${JSON.stringify(textDeltaEvent)}`;
		}

		if (delta.type === "input_json_delta" && delta.partial_json) {
			if (blockState && blockState.type === "tool_use") {
				// Accumulate JSON parts for later
				blockState.inputJsonParts.push(delta.partial_json);

				const toolInputDeltaEvent = {
					type: "tool-input-delta",
					toolCallId: blockState.toolCallId,
					inputTextDelta: delta.partial_json,
				};
				return `data: ${JSON.stringify(toolInputDeltaEvent)}`;
			}
		}

		return null;
	}

	private handleContentBlockStop(event: AnthropicEvent): string | null {
		const index = event.index ?? 0;
		const blockState = this.contentBlocks.get(index);

		if (!blockState) return null;

		if (blockState.type === "text") {
			const textEndEvent = {
				type: "text-end",
				id: blockState.id,
			};
			this.contentBlocks.delete(index);
			return `data: ${JSON.stringify(textEndEvent)}`;
		}

		if (blockState.type === "tool_use") {
			// Parse accumulated JSON input
			const fullJson = blockState.inputJsonParts.join("");
			let input: unknown = {};
			try {
				if (fullJson) {
					input = JSON.parse(fullJson);
				}
			} catch {
				input = { raw: fullJson };
			}

			// AI SDK 5.0 uses tool-input-available instead of tool-call
			const toolInputAvailableEvent = {
				type: "tool-input-available",
				toolCallId: blockState.toolCallId,
				toolName: blockState.toolName,
				input: input,
			};

			this.contentBlocks.delete(index);
			return `data: ${JSON.stringify(toolInputAvailableEvent)}`;
		}

		return null;
	}

	private handleMessageDelta(event: AnthropicEvent): string | null {
		const delta = event.delta;
		if (!delta) return null;

		if (delta.stop_reason) {
			let finishReason: string;
			switch (delta.stop_reason) {
				case "end_turn":
					finishReason = "stop";
					break;
				case "tool_use":
					finishReason = "tool-calls";
					break;
				case "max_tokens":
					finishReason = "length";
					break;
				case "stop_sequence":
					finishReason = "stop";
					break;
				default:
					finishReason = delta.stop_reason;
			}

			// For tool-calls, DO NOT send any finish event
			// The stream will continue with tool results and more content
			// AI SDK's Chat class will trigger onFinish if we send finish-step
			if (finishReason === "tool-calls") {
				// Don't send anything - let the stream continue naturally
				return null;
			}

			// For final completion, store finish event to send after message-metadata
			// This ensures onFinish callback receives the metadata from result event
			// Note: UIMessageStream schema only accepts {type: "finish"} with optional messageMetadata
			// finishReason is passed through message-metadata event instead
			const finishEvent = {
				type: "finish",
			};

			// Store the finish event to send later
			this.pendingFinishEvent = `data: ${JSON.stringify(finishEvent)}`;

			// Don't send it yet - wait for result event to send metadata first
			return null;
		}

		return null;
	}

	flushBuffer(): string {
		if (this.buffer.trim() === "") {
			// If buffer is empty but we have a pending finish event, send it now
			if (this.pendingFinishEvent) {
				const result = this.pendingFinishEvent + "\n\n";
				this.pendingFinishEvent = null;
				return result;
			}
			return "";
		}

		const finalLine = this.processLine(this.buffer);
		this.buffer = "";
		let result = finalLine ? `${finalLine}\n\n` : "";

		// If we have a pending finish event, append it
		if (this.pendingFinishEvent) {
			result += this.pendingFinishEvent + "\n\n";
			this.pendingFinishEvent = null;
		}

		return result;
	}
}

/**
 * Creates a custom fetch function that transforms 302.AI Claude Code SSE responses
 * to AI SDK UIMessageStream format.
 * @param preGeneratedMessageId - Optional pre-generated messageId for optimistic UI updates.
 *                                 When provided, the processor will skip generating the start event
 *                                 (assuming it was already sent immediately for optimistic UI).
 */
export function createClaudeCodeFetch(preGeneratedMessageId?: string): typeof fetch {
	return async (url, options) => {
		const response = await fetch(url, options);
		const processor = new ClaudeCodeProcessor(preGeneratedMessageId);
		return interceptSSEResponse(response, processor);
	};
}

function interceptSSEResponse(response: Response, processor: ClaudeCodeProcessor): Response {
	const contentType = response.headers.get("content-type");

	if (!contentType?.includes("text/event-stream")) {
		return response;
	}

	const originalStream = response.body;
	if (!originalStream) {
		return response;
	}

	const reader = originalStream.getReader();
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();

	const transformedStream = new ReadableStream({
		async start(controller) {
			try {
				while (true) {
					const { done, value } = await reader.read();

					if (done) {
						const finalChunk = processor.flushBuffer();
						if (finalChunk) {
							controller.enqueue(encoder.encode(finalChunk));
						}
						controller.close();
						break;
					}

					const chunk = decoder.decode(value, { stream: true });

					// Debug: Log raw SSE chunk
					console.debug("[ClaudeCodeProcessor] Raw SSE chunk:", chunk);

					const processedChunk = processor.processSSEChunk(chunk);

					if (processedChunk) {
						// Debug: Log processed SSE chunk
						console.debug("[ClaudeCodeProcessor] Processed SSE chunk:", processedChunk);
						try {
							controller.enqueue(encoder.encode(processedChunk));
						} catch (_error) {
							// Client disconnected or controller closed
							console.log("[ClaudeCodeProcessor] Controller closed, stopping stream");
							reader.cancel().catch(() => {
								// Ignore cancel errors
							});
							break;
						}
					}
				}
			} catch (error) {
				console.error("[ClaudeCodeProcessor] Error processing chunk:", error);
				controller.error(error);
			}
		},
	});

	// Create new headers with UI message stream marker
	const newHeaders = new Headers(response.headers);
	newHeaders.set("x-vercel-ai-ui-message-stream", "v1");

	return new Response(transformedStream, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders,
	});
}

export { ClaudeCodeProcessor };
