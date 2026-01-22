import type { ModelProvider } from "@shared/storage/provider";
import type { Model } from "@shared/types";

export interface DecomposeTaskRequest {
	requirement: string;
	count: number;
	model: string;
	apiKey?: string;
	baseUrl?: string;
	providerType: "302ai" | "openai" | "anthropic" | "gemini";
}

export interface DecomposeTaskResponse {
	tasks: Array<{
		id: string;
		content: string;
		acceptance_criteria?: string;
		dependencies?: string[];
	}>;
}

export async function decomposeTasks(
	requirement: string,
	count: number,
	model: Model,
	provider: ModelProvider | undefined,
	serverPort?: number,
	abortSignal?: AbortSignal,
): Promise<string[]> {
	const port = serverPort ?? 8089;

	try {
		console.log("[TaskDecomposer] Starting task decomposition...");

		const response = await fetch(`http://localhost:${port}/decompose-tasks`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				requirement,
				count,
				model: model.id,
				apiKey: provider?.apiKey,
				baseUrl: provider?.baseUrl,
				providerType: provider?.apiType || "openai",
			} satisfies DecomposeTaskRequest),
			signal: abortSignal,
		});

		if (!response.ok) {
			console.error("[TaskDecomposer] Failed to decompose tasks:", response.statusText);
			throw new Error(`Failed to decompose tasks: ${response.statusText}`);
		}

		const data: DecomposeTaskResponse = await response.json();
		console.log("[TaskDecomposer] Received response:", data);

		if (!data.tasks || !Array.isArray(data.tasks)) {
			console.error("[TaskDecomposer] Invalid response format:", data);
			return [];
		}

		// Extract task contents
		const taskContents = data.tasks.map((task) => task.content);
		console.log("[TaskDecomposer] Decomposed tasks:", taskContents);

		return taskContents;
	} catch (error) {
		// Don't log abort errors as they are expected when user cancels
		if (error instanceof Error && error.name === "AbortError") {
			console.log("[TaskDecomposer] Decomposition aborted");
			return [];
		}
		console.error("[TaskDecomposer] Decomposition failed:", error);
		throw error;
	}
}
