import type { ChatMessage } from "$lib/types/chat";
import type { ModelProvider } from "@shared/storage/provider";
import type { Model } from "@shared/types";

export interface GenerateTitleRequest {
	messages: ChatMessage[];
	model: string;
	apiKey?: string;
	baseUrl?: string;
	providerType: "302ai" | "openai" | "anthropic" | "gemini";
	previousSummary?: string;
	isFirstGeneration?: boolean;
}

export interface GenerateTitleResponse {
	title: string;
	summary: string;
}

export interface GenerateTitleResult {
	title: string;
	summary: string;
}

export async function generateTitle(
	messages: ChatMessage[],
	model: Model,
	provider: ModelProvider | undefined,
	serverPort?: number,
	previousSummary?: string,
	isFirstGeneration?: boolean,
): Promise<GenerateTitleResult | null> {
	const port = serverPort ?? 8089;

	try {
		const response = await fetch(`http://localhost:${port}/generate-title`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages,
				model: model.id,
				apiKey: provider?.apiKey,
				baseUrl: provider?.baseUrl,
				providerType: provider?.apiType || "openai",
				previousSummary,
				isFirstGeneration,
			} satisfies GenerateTitleRequest),
		});

		if (!response.ok) {
			throw new Error(`Failed to generate title: ${response.statusText}`);
		}

		const data: GenerateTitleResponse = await response.json();
		return {
			title: sanitizeGeneratedTitle(data.title),
			summary: data.summary || "",
		};
	} catch (error) {
		console.error("Title generation failed, using fallback:", error);
		return null;
	}
}

const reasoningBlockPattern = /<(think|thinking|reason|reasoning)>[\s\S]*?<\/\1>/gi;

function sanitizeGeneratedTitle(rawTitle: string): string {
	if (!rawTitle) {
		return "";
	}

	return rawTitle.replace(reasoningBlockPattern, "").trim();
}
