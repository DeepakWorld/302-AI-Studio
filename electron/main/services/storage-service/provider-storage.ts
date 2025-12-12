import type { ModelProvider } from "@shared/types";
import { hashApiKey } from "@shared/utils/hash";
import { isNull, isUndefined } from "es-toolkit";
import { StorageService } from "../storage-service";

export class ProviderStorage extends StorageService<ModelProvider[]> {
	constructor() {
		super();
	}

	async validate302AIProvider(): Promise<{
		valid: boolean;
		apiKey: string;
	}> {
		const allProviders = await this.getItemInternal("app-providers");
		if (isNull(allProviders)) return { valid: false, apiKey: "" };

		const _302AIProvider = allProviders.find((p) => p.apiType === "302ai");
		if (isUndefined(_302AIProvider)) return { valid: false, apiKey: "" };
		if (!_302AIProvider.enabled || _302AIProvider.apiKey.trim() === "")
			return { valid: false, apiKey: "" };

		return {
			valid: true,
			apiKey: _302AIProvider.apiKey,
		};
	}

	/**
	 * Get the current 302.AI provider's API key hash
	 * Used for tracking session association with the logged-in account
	 */
	async get302AIApiKeyHash(): Promise<string | undefined> {
		const allProviders = await this.getItemInternal("app-providers");
		if (isNull(allProviders)) return undefined;

		const _302AIProvider = allProviders.find((p) => p.apiType === "302ai");
		if (isUndefined(_302AIProvider) || !_302AIProvider.apiKey) return undefined;

		return hashApiKey(_302AIProvider.apiKey);
	}
}

export const providerStorage = new ProviderStorage();
