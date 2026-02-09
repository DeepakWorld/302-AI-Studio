import type { ChatMessage } from "$lib/types/chat";
import type { ModelProvider } from "@shared/storage/provider";
import type { Model } from "@shared/types";
import type { FallbackModelConfig } from "./title-generation";

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

// Fallback model configuration
const FALLBACK_MODEL_ID = "gpt-4o-mini";
const FALLBACK_RETRY_DELAY = 500;

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

	try {
		// First attempt with configured model
		return await generateContextSummaryRequest(
			messages,
			model.id,
			provider,
			port,
			previousSummary,
			language,
			signal,
		);
	} catch (error) {
		// Check if aborted before retry
		if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
		console.error("Context summary generation failed with configured model:", error);

		// Wait before retrying with fallback
		console.log(`Retrying context summary generation after ${FALLBACK_RETRY_DELAY}ms...`);
		await new Promise((resolve) => setTimeout(resolve, FALLBACK_RETRY_DELAY));

		// Determine fallback model and provider
		let fallbackModelId: string;
		let fallbackProvider: ModelProvider | undefined;

		if (fallbackConfig) {
			// Use provided fallback config (current chat model)
			fallbackModelId = fallbackConfig.model.id;
			fallbackProvider = fallbackConfig.provider;
			console.log(`Using chat model as fallback: ${fallbackModelId}`);
		} else {
			// Use hardcoded gpt-4o-mini
			fallbackModelId = FALLBACK_MODEL_ID;
			fallbackProvider = provider;
			console.log(`Using default fallback model: ${fallbackModelId}`);
		}

		// If fallback model is the same as original, give up
		if (fallbackModelId === model.id && fallbackProvider?.id === provider?.id) {
			console.error("Fallback model is same as original, giving up");
			return null;
		}

		try {
			return await generateContextSummaryRequest(
				messages,
				fallbackModelId,
				fallbackProvider,
				port,
				previousSummary,
				language,
				signal,
			);
		} catch (fallbackError) {
			console.error("Context summary generation failed with fallback model:", fallbackError);
			return null;
		}
	}
}
