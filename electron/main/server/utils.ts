import { batchUploadFile } from "../apis/code-agent";

/**
 * Send an error message through SSE stream and close the controller.
 * This is a helper to avoid repeating error handling code.
 *
 * @param controller - The ReadableStreamDefaultController to send events through
 * @param errorMessage - The error message to display to the user
 */
export function sendStreamError(
	controller: ReadableStreamDefaultController<Uint8Array>,
	errorMessage: string,
): void {
	const encoder = new TextEncoder();
	const errorId = `error-${Date.now()}`;

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

export type OpenAIChatContentPartText = {
	type: "text";
	text: string;
};

export type OpenAIChatContentPartImage = {
	type: "image_url";
	image_url: {
		url: string;
	};
};

export type OpenAIChatMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content: string | Array<OpenAIChatContentPartText | OpenAIChatContentPartImage>;
	name?: string;
	tool_call_id?: string;
};

type AiSdkIntermediateTextPart = {
	type: "text";
	text: string;
};

type AiSdkIntermediateFilePart = {
	type: "file";
	mediaType?: string;
	filename?: string;
	url?: string;
	data?: string;
};

type AiSdkIntermediatePart = AiSdkIntermediateTextPart | AiSdkIntermediateFilePart;

type AiSdkIntermediateMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content: string | AiSdkIntermediatePart[];
	name?: string;
	tool_call_id?: string;
};

function coerceToDataUrl(raw: string, mediaType?: string): string {
	if (raw.startsWith("data:")) {
		return raw;
	}

	if (mediaType && /^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(mediaType)) {
		return `data:${mediaType};base64,${raw}`;
	}

	return raw;
}

function describeNonImageFilePart(part: AiSdkIntermediateFilePart): string {
	const name =
		typeof part.filename === "string" && part.filename.trim() ? part.filename.trim() : "(unnamed)";
	const mediaType =
		typeof part.mediaType === "string" && part.mediaType.trim() ? part.mediaType.trim() : "unknown";
	return `[File: ${name}, mediaType: ${mediaType}] (content omitted)`;
}

/**
 * List of model patterns that do not support streaming output.
 * These models (like image generation models) return complete responses instead of SSE streams.
 */
const NON_STREAMING_MODEL_PATTERNS = [
	"-image-", // e.g., gemini-2.5-flash-image-preview
	"-image", // e.g., models ending with -image
	"image-generation", // explicit image generation models
	"dall-e", // OpenAI DALL-E models
	"stable-diffusion", // Stable Diffusion models
];

/**
 * Check if a model supports streaming output.
 * Image generation models and some other special models don't support streaming.
 */
export function isStreamingSupported(modelId: string): boolean {
	const lowerModelId = modelId.toLowerCase();
	return !NON_STREAMING_MODEL_PATTERNS.some((pattern) => lowerModelId.includes(pattern));
}

/**
 * Convert a non-streaming response to UI message stream format (SSE).
 * This is used for models that don't support streaming (like image generation models).
 *
 * This function creates a stream that:
 * 1. Immediately sends a "start" event for optimistic UI update
 * 2. Executes the async content generator
 * 3. Streams the content and finish events
 *
 * @param contentGenerator - An async function that returns the text content
 * @param model - The model ID
 * @param provider - The provider name
 * @returns A ReadableStream that emits SSE events compatible with toUIMessageStream
 */
export function createUIMessageStreamFromGenerator(
	contentGenerator: () => Promise<string>,
	model: string,
	provider: string,
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();

	return new ReadableStream({
		async start(controller) {
			const messageMetadata = {
				model,
				provider,
				createdAt: new Date().toISOString(),
			};

			// 1. Send start event immediately for optimistic UI update
			controller.enqueue(
				encoder.encode(
					`data: ${JSON.stringify({
						type: "start",
						messageMetadata,
					})}\n\n`,
				),
			);
			console.log(
				`[createUIMessageStreamFromGenerator] Sent immediate start event for model ${model}`,
			);

			try {
				// 2. Execute the async content generator
				const content = await contentGenerator();

				// 3. Generate a unique ID for this text part
				const textId = `text-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

				// 4. Send start-step event (NO messageMetadata)
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "start-step",
						})}\n\n`,
					),
				);

				// 5. Send text-start event
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "text-start",
							id: textId,
						})}\n\n`,
					),
				);

				// 6. Send text-delta event with the full content
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "text-delta",
							id: textId,
							delta: content,
						})}\n\n`,
					),
				);

				// 7. Send text-end event
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "text-end",
							id: textId,
						})}\n\n`,
					),
				);

				// 8. Send finish-step event (NO messageMetadata)
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "finish-step",
						})}\n\n`,
					),
				);

				// 9. Send message-metadata event
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "message-metadata",
							messageMetadata,
						})}\n\n`,
					),
				);

				// 10. Send finish event (with messageMetadata)
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "finish",
							finishReason: "stop",
							messageMetadata,
						})}\n\n`,
					),
				);

				// 11. Send [DONE] marker
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));

				controller.close();
			} catch (error) {
				console.error(`[createUIMessageStreamFromGenerator] Error for model ${model}:`, error);

				// Send error as text-delta so user sees it
				const errorId = `error-${Date.now()}`;
				const errorMessage = error instanceof Error ? error.message : "Unknown error";

				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "start-step" })}\n\n`));
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
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish-step" })}\n\n`));
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ type: "finish", finishReason: "error", messageMetadata })}\n\n`,
					),
				);
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			}
		},
	});
}

/**
 * Convert a non-streaming response to UI message stream format (SSE).
 * This is used for models that don't support streaming (like image generation models).
 *
 * @param content - The text content from the non-streaming response
 * @param model - The model ID
 * @param provider - The provider name
 * @returns A ReadableStream that emits SSE events compatible with toUIMessageStream
 * @deprecated Use createUIMessageStreamFromGenerator for immediate start event support
 */
export function createUIMessageStreamFromText(
	content: string,
	model: string,
	provider: string,
): ReadableStream<Uint8Array> {
	return createUIMessageStreamFromGenerator(() => Promise.resolve(content), model, provider);
}

export function convertAiSdkMessagesToOpenAiMessages(messages: unknown): OpenAIChatMessage[] {
	if (!Array.isArray(messages)) {
		return [];
	}

	return (messages as AiSdkIntermediateMessage[]).flatMap((message): OpenAIChatMessage[] => {
		if (!message || typeof message !== "object") {
			return [];
		}

		const { role, name, tool_call_id } = message;
		const content = (message as AiSdkIntermediateMessage).content;

		if (typeof content === "string") {
			const msg: OpenAIChatMessage = {
				role,
				content,
				...(name ? { name } : {}),
				...(tool_call_id ? { tool_call_id } : {}),
			};
			return [msg];
		}

		if (!Array.isArray(content)) {
			const msg: OpenAIChatMessage = {
				role,
				content: "",
				...(name ? { name } : {}),
				...(tool_call_id ? { tool_call_id } : {}),
			};
			return [msg];
		}

		const parts: Array<OpenAIChatContentPartText | OpenAIChatContentPartImage> = [];
		const nonImageFileDescriptions: string[] = [];

		for (const part of content) {
			if (!part || typeof part !== "object") {
				continue;
			}

			if ((part as AiSdkIntermediateTextPart).type === "text") {
				const text = (part as AiSdkIntermediateTextPart).text;
				parts.push({ type: "text", text: typeof text === "string" ? text : "" });
				continue;
			}

			if ((part as AiSdkIntermediateFilePart).type === "file") {
				const filePart = part as AiSdkIntermediateFilePart;
				const mediaType = typeof filePart.mediaType === "string" ? filePart.mediaType : undefined;
				const raw =
					typeof filePart.url === "string"
						? filePart.url
						: typeof filePart.data === "string"
							? filePart.data
							: undefined;

				if (!raw) {
					nonImageFileDescriptions.push(describeNonImageFilePart(filePart));
					continue;
				}

				const isImage = mediaType?.startsWith("image/");
				const isZip =
					mediaType?.includes("zip") || filePart.filename?.toLowerCase().endsWith(".zip");

				if (isImage || isZip) {
					parts.push({
						type: "image_url",
						image_url: {
							url: coerceToDataUrl(raw, mediaType),
						},
					});
				} else {
					nonImageFileDescriptions.push(describeNonImageFilePart(filePart));
				}
			}
		}

		if (nonImageFileDescriptions.length > 0) {
			parts.unshift({
				type: "text",
				text: nonImageFileDescriptions.join("\n"),
			});
		}

		const msg: OpenAIChatMessage = {
			role,
			content: parts,
			...(name ? { name } : {}),
			...(tool_call_id ? { tool_call_id } : {}),
		};
		return [msg];
	});
}

/**
 * Prepends a prompt string to the first user message in a list of messages.
 * Handles both string content and array content (multi-modal/parts).
 * Immutably updates the message object in the array.
 *
 * Supported message structures:
 * 1. { role: 'user', parts: [{ type: 'text', text: '...' }] }
 * 2. { role: 'user', content: [{ type: 'text', text: '...' }] }
 * 3. { role: 'user', content: '...' }
 *
 * @param messages The list of messages (mutable array)
 * @param prompt The prompt string to prepend
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prependPromptToFirstUserMessage(messages: any[], prompt: string): void {
	// Find the first user message and prepend the prompt
	for (let i = 0; i < messages.length; i++) {
		if (messages[i].role === "user") {
			const msg = messages[i];

			// Handle 'parts' property (priority, common in newer AI SDK)
			if (Array.isArray(msg.parts)) {
				const newParts = [...msg.parts];
				let firstTextPartIndex = -1;

				// Find the first text part
				for (let j = 0; j < newParts.length; j++) {
					if (newParts[j].type === "text") {
						firstTextPartIndex = j;
						break;
					}
				}

				if (firstTextPartIndex !== -1) {
					// Create a new text part with prepended prompt
					newParts[firstTextPartIndex] = {
						...newParts[firstTextPartIndex],
						text: prompt + newParts[firstTextPartIndex].text,
					};
				} else {
					newParts.unshift({ type: "text", text: prompt });
				}

				messages[i] = {
					...msg,
					parts: newParts,
				};
			}
			// Handle 'content' property (fallback)
			else {
				const content = msg.content;
				let newContent = content;

				if (Array.isArray(content)) {
					newContent = [...content];
					let firstTextPartIndex = -1;

					for (let j = 0; j < newContent.length; j++) {
						if (newContent[j].type === "text") {
							firstTextPartIndex = j;
							break;
						}
					}

					if (firstTextPartIndex !== -1) {
						newContent[firstTextPartIndex] = {
							...newContent[firstTextPartIndex],
							text: prompt + newContent[firstTextPartIndex].text,
						};
					} else {
						newContent.unshift({ type: "text", text: prompt });
					}
				} else if (typeof content === "string") {
					newContent = prompt + content;
				}

				messages[i] = {
					...msg,
					content: newContent,
				};
			}
			break;
		}
	}
}

/**
 * Appends a prompt string to the last user message in a list of messages.
 * Handles both string content and array content (multi-modal/parts).
 * Immutably updates the message object in the array.
 *
 * Supported message structures:
 * 1. { role: 'user', parts: [{ type: 'text', text: '...' }] }
 * 2. { role: 'user', content: [{ type: 'text', text: '...' }] }
 * 3. { role: 'user', content: '...' }
 *
 * @param messages The list of messages (mutable array)
 * @param prompt The prompt string to append
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function appendPromptToLastUserMessage(messages: any[], prompt: string): void {
	const EXCLUDE_PREFIX = ["/commands", "/deploy", "/model", "/max_thinking_token", "/plugin"];

	// Find the last user message and append the prompt
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].role === "user") {
			const msg = messages[i];

			// Check if the message starts with any of the excluded prefixes
			let firstText = "";
			if (typeof msg.content === "string") {
				firstText = msg.content;
			} else if (
				Array.isArray(msg.content) &&
				msg.content.length > 0 &&
				msg.content[0].type === "text"
			) {
				firstText = msg.content[0].text;
			} else if (Array.isArray(msg.parts) && msg.parts.length > 0 && msg.parts[0].type === "text") {
				firstText = msg.parts[0].text;
			}

			if (EXCLUDE_PREFIX.some((prefix) => firstText.startsWith(prefix))) {
				break;
			}

			// Handle 'parts' property (priority, common in newer AI SDK)
			if (Array.isArray(msg.parts)) {
				const newParts = [...msg.parts];
				let lastTextPartIndex = -1;

				// Find the last text part
				for (let j = newParts.length - 1; j >= 0; j--) {
					if (newParts[j].type === "text") {
						lastTextPartIndex = j;
						break;
					}
				}

				if (lastTextPartIndex !== -1) {
					// Create a new text part with appended prompt
					newParts[lastTextPartIndex] = {
						...newParts[lastTextPartIndex],
						text: newParts[lastTextPartIndex].text + prompt,
					};
				} else {
					newParts.push({ type: "text", text: prompt });
				}

				messages[i] = {
					...msg,
					parts: newParts,
				};
			}
			// Handle 'content' property (fallback)
			else {
				const content = msg.content;
				let newContent = content;

				if (Array.isArray(content)) {
					newContent = [...content];
					let lastTextPartIndex = -1;

					for (let j = newContent.length - 1; j >= 0; j--) {
						if (newContent[j].type === "text") {
							lastTextPartIndex = j;
							break;
						}
					}

					if (lastTextPartIndex !== -1) {
						newContent[lastTextPartIndex] = {
							...newContent[lastTextPartIndex],
							text: newContent[lastTextPartIndex].text + prompt,
						};
					} else {
						newContent.push({ type: "text", text: prompt });
					}
				} else if (typeof content === "string") {
					newContent = content + prompt;
				}

				messages[i] = {
					...msg,
					content: newContent,
				};
			}
			break;
		}
	}
}

/**
 * Prepends or appends a prompt string to system message in a list of messages.
 * If no system message exists, creates one. If system message exists, appends to it.
 *
 * @param messages The list of messages (mutable array)
 * @param prompt The prompt string to prepend or append
 * @param prepend Whether to prepend (before existing content) or append (after). Default is append.
 */

export function appendPromptToSystemMessage(
	messages: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
	prompt: string,
	prepend = false,
): void {
	// Find existing system message
	const existingSystemIndex = messages.findIndex((msg) => msg.role === "system");

	if (existingSystemIndex !== -1) {
		// System message exists, append or prepend to it
		const msg = messages[existingSystemIndex];
		const parts = msg.parts;
		const content = msg.content;

		// Handle parts array (UIMessage structure)
		if (Array.isArray(parts)) {
			const newParts = [...parts];
			if (prepend) {
				newParts.unshift({ type: "text", text: prompt });
			} else {
				newParts.push({ type: "text", text: prompt });
			}
			messages[existingSystemIndex] = {
				...msg,
				parts: newParts,
			};
		}
		// Handle content array
		else if (Array.isArray(content)) {
			const newContent = [...content];
			if (prepend) {
				newContent.unshift({ type: "text", text: prompt });
			} else {
				newContent.push({ type: "text", text: prompt });
			}
			messages[existingSystemIndex] = {
				...msg,
				content: newContent,
			};
		}
		// Handle content string
		else if (typeof content === "string") {
			messages[existingSystemIndex] = {
				...msg,
				content: prepend ? prompt + content : content + prompt,
			};
		}
	} else {
		// No system message, create one at the beginning with parts structure
		messages.unshift({
			role: "system",
			content: prompt,
			parts: [{ type: "text", text: prompt }],
		});
	}
}

/**
 * Upload attachments from message metadata to sandbox before sending to AI provider.
 * This enables non-blocking UX where users see immediate stream response.
 *
 * @param sandboxId - The sandbox ID to upload to
 * @param workspacePath - The workspace path in the sandbox
 * @param messages - The messages array containing attachment metadata
 * @returns Promise that resolves when upload completes (or fails gracefully)
 */
export async function uploadAttachmentsFromMessages(
	sandboxId: string,
	workspacePath: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	messages: any[],
): Promise<void> {
	if (!sandboxId || !workspacePath || messages.length === 0) {
		return;
	}

	const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user");
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const metadata = lastUserMessage?.metadata as any;
	if (!metadata?.attachments) {
		return;
	}

	const attachments = metadata.attachments as Array<{
		id: string;
		name: string;
		type: string;
		size: number;
		preview?: string;
		filePath?: string;
	}>;

	if (attachments.length === 0) {
		return;
	}

	console.log(`[uploadAttachmentsFromMessages] Uploading ${attachments.length} attachments`);

	try {
		const fileList = await Promise.all(
			attachments.map(async (att) => {
				let base64Content: string | null = null;

				// Priority 1: Use preview if it's already base64
				if (att.preview && att.preview.startsWith("data:")) {
					base64Content = att.preview;
				}

				if (!base64Content) {
					console.warn(
						`[uploadAttachmentsFromMessages] Attachment ${att.name} has no preview or filePath`,
					);
					return null;
				}

				return {
					content: base64Content,
					save_path: `${workspacePath}/${att.name}`,
				};
			}),
		);

		// Filter out null entries (failed reads)
		const validFiles = fileList.filter((f) => f !== null) as Array<{
			content: string;
			save_path: string;
		}>;

		if (validFiles.length > 0) {
			const uploadResponse = await batchUploadFile({
				sandbox_id: sandboxId,
				file_list: validFiles,
			});

			const failedUploads = uploadResponse.result.filter((r) => !r.success);
			if (!uploadResponse.success || failedUploads.length > 0) {
				console.error(
					"[uploadAttachmentsFromMessages] Some attachments failed to upload:",
					failedUploads.map((r) => r.error).join(", "),
				);
				// Continue anyway - partial upload is better than blocking
			} else {
				console.log(
					`[uploadAttachmentsFromMessages] Successfully uploaded ${validFiles.length} attachments`,
				);
			}
		}
	} catch (error) {
		console.error("[uploadAttachmentsFromMessages] Failed to upload attachments:", error);
		// Continue anyway - don't block message sending
	}
}
