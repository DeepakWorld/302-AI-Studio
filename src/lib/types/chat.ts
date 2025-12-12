import type { UIMessage } from "ai";
import { z } from "zod/v4";

// Result metadata from 302.AI Claude Code
export const resultMetadataSchema = z.object({
	type: z.string().optional(),
	subtype: z.string().optional(),
	is_error: z.boolean().optional(),
	duration_ms: z.number().optional(),
	duration_api_ms: z.number().optional(),
	num_turns: z.number().optional(),
	content: z.string().optional(),
	session_id: z.string().optional(),
	total_cost_usd: z.number().optional(),
	uuid: z.string().optional(),
});

export type ResultMetadata = z.infer<typeof resultMetadataSchema>;

export const messageMetadataSchema = z.object({
	createdAt: z.string().optional(),
	model: z.string().optional(),
	attachments: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				type: z.string(),
				size: z.number(),
				filePath: z.string(),
				preview: z.string().optional(),
				textContent: z.string().optional(),
			}),
		)
		.optional(),
	fileContentPartIndex: z.number().optional(),
	feedback: z.enum(["like", "dislike"]).optional(),
	// Result metadata from 302.AI Claude Code
	result: resultMetadataSchema.optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ChatTools = {};

export type CustomUIDataTypes = {
	suggestions?: string[];
	[x: string]: unknown;
};

export type ChatMessage = UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>;
