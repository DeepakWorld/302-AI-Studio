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

export interface FallbackModelConfig {
	model: Model;
	provider: ModelProvider | undefined;
}

// 兜底模型配置
const FALLBACK_MODEL_ID = "gpt-4o-mini";
const FALLBACK_RETRY_DELAY = 500;

async function generateTitleRequest(
	messages: ChatMessage[],
	modelId: string,
	provider: ModelProvider | undefined,
	serverPort: number,
	previousSummary?: string,
	isFirstGeneration?: boolean,
): Promise<GenerateTitleResult> {
	const response = await fetch(`http://localhost:${serverPort}/generate-title`, {
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
}

export async function generateTitle(
	messages: ChatMessage[],
	model: Model,
	provider: ModelProvider | undefined,
	serverPort?: number,
	previousSummary?: string,
	isFirstGeneration?: boolean,
	fallbackConfig?: FallbackModelConfig,
): Promise<GenerateTitleResult | null> {
	const port = serverPort ?? 8089;

	try {
		// 首次尝试使用配置的模型
		return await generateTitleRequest(
			messages,
			model.id,
			provider,
			port,
			previousSummary,
			isFirstGeneration,
		);
	} catch (error) {
		console.error("Title generation failed with configured model:", error);

		// 等待 500ms 后重试
		console.log(`Retrying title generation after ${FALLBACK_RETRY_DELAY}ms...`);
		await new Promise((resolve) => setTimeout(resolve, FALLBACK_RETRY_DELAY));

		// 确定兜底使用的模型和 provider
		let fallbackModelId: string;
		let fallbackProvider: ModelProvider | undefined;

		if (fallbackConfig) {
			// 使用传入的兜底配置（当前聊天模型）
			fallbackModelId = fallbackConfig.model.id;
			fallbackProvider = fallbackConfig.provider;
			console.log(`Using chat model as fallback: ${fallbackModelId}`);
		} else {
			// 使用硬编码的 gpt-4o-mini
			fallbackModelId = FALLBACK_MODEL_ID;
			fallbackProvider = provider;
			console.log(`Using default fallback model: ${fallbackModelId}`);
		}

		// 如果兜底模型和原模型相同，直接返回 null
		if (fallbackModelId === model.id && fallbackProvider?.id === provider?.id) {
			console.error("Fallback model is same as original, giving up");
			return null;
		}

		try {
			return await generateTitleRequest(
				messages,
				fallbackModelId,
				fallbackProvider,
				port,
				previousSummary,
				isFirstGeneration,
			);
		} catch (fallbackError) {
			console.error("Title generation failed with fallback model:", fallbackError);
			return null;
		}
	}
}

const reasoningBlockPattern = /<(think|thinking|reason|reasoning)>[\s\S]*?<\/\1>/gi;
// Pattern for unclosed thinking tags (when response is truncated)
const unclosedReasoningPattern = /<(think|thinking|reason|reasoning)>[\s\S]*/gi;

function sanitizeGeneratedTitle(rawTitle: string): string {
	if (!rawTitle) {
		return "";
	}

	// First, remove complete thinking blocks with closing tags
	let sanitized = rawTitle.replace(reasoningBlockPattern, "");
	// Then, remove any unclosed thinking blocks (handles truncated responses)
	sanitized = sanitized.replace(unclosedReasoningPattern, "");

	return sanitized.trim();
}
