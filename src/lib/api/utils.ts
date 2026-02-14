import { codeAgentState } from "$lib/stores/code-agent";
import type { ModelProvider } from "@shared/types";
import { _302AIKy } from "./core/_302ai-ky";
import { createLocalCodeAgentKy } from "./core/local-code-agent-ky";
/**
 * Get the API key for a specific provider
 */
export function getApiKeyByProvider(provider: ModelProvider): string {
	// const codeAgentEnabled = codeAgentState.enabled;
	// if (codeAgentEnabled) {
	// 	return codeAgentGlobalConfigsState.apiKey;
	// }

	return provider.apiKey;
}

export function getApiKeyByProviderKey(apiKey: string): string {
	// const codeAgentEnabled = codeAgentState.enabled;
	// if (codeAgentEnabled) {
	// 	return codeAgentGlobalConfigsState.apiKey;
	// }

	return apiKey;
}

/**
 * Get the appropriate ky instance based on code agent mode
 */
export async function getCodeAgentKy() {
	return codeAgentState.type === "local" ? await createLocalCodeAgentKy() : _302AIKy;
}
