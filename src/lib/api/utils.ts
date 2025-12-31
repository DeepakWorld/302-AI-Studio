import { codeAgentGlobalConfigsState, codeAgentState } from "$lib/stores/code-agent";
import type { ModelProvider } from "@shared/types";
/**
 * Get the API key for a specific provider
 */
export function getApiKeyByProvider(provider: ModelProvider): string {
	const codeAgentEnabled = codeAgentState.enabled;
	if (codeAgentEnabled) {
		return codeAgentGlobalConfigsState.apiKey;
	}

	return provider.apiKey;
}

export function getApiKeyByProviderKey(apiKey: string): string {
	const codeAgentEnabled = codeAgentState.enabled;
	if (codeAgentEnabled) {
		return codeAgentGlobalConfigsState.apiKey;
	}

	return apiKey;
}
