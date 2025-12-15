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

				if (mediaType?.startsWith("image/")) {
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
