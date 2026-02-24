import type { ChatMessage } from "$lib/types/chat";
import type { ModelProvider } from "@shared/storage/provider";
import type { Model } from "@shared/types";
import { withGenerationFallback, type FallbackModelConfig } from "./generation-fallback";

export interface GenerateContextSummaryRequest {
	messages: ChatMessage[];
	model: string;
	apiKey?: string;
	baseUrl?: string;
	providerType: "302ai" | "openai" | "anthropic" | "gemini";
	previousSummary?: string;
	language?: string;
}

export interface GenerateContextSummaryResponse {
	summary: string;
}

async function generateContextSummaryRequest(
	messages: ChatMessage[],
	modelId: string,
	provider: ModelProvider | undefined,
	serverPort: number,
	previousSummary?: string,
	language?: string,
	signal?: AbortSignal,
): Promise<string> {
	const response = await fetch(`http://localhost:${serverPort}/generate-context-summary`, {
		signal,
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			messages,
			model: modelId,
			apiKey: provider?.apiKey,
			baseUrl: provider?.baseUrl,
			providerType: provider?.apiType || "openai",
			previousSummary,
			language,
		} satisfies GenerateContextSummaryRequest),
	});

	if (!response.ok) {
		throw new Error(`Failed to generate context summary: ${response.statusText}`);
	}

	const data: GenerateContextSummaryResponse = await response.json();
	return data.summary || "";
}

export async function generateContextSummary(
	messages: ChatMessage[],
	model: Model,
	provider: ModelProvider | undefined,
	serverPort?: number,
	previousSummary?: string,
	language?: string,
	fallbackConfig?: FallbackModelConfig,
	signal?: AbortSignal,
): Promise<string | null> {
	const port = serverPort ?? 8089;

	return await withGenerationFallback({
		operation: "context summary generation",
		model,
		provider,
		fallbackConfig,
		signal,
		request: (modelId, selectedProvider) =>
			generateContextSummaryRequest(
				messages,
				modelId,
				selectedProvider,
				port,
				previousSummary,
				language,
				signal,
			),
	});
}
