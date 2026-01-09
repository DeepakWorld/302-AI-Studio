import type { IpcMainInvokeEvent } from "electron";
import { emitter } from "../broadcast-service";
import { providerStorage } from "../storage-service/provider-storage";

export class ProviderService {
	async handle302AIProviderChange(_event: IpcMainInvokeEvent, apiKey: string) {
		emitter.emit("provider:302ai-provider-changed", { apiKey });
	}

	async get302AIApiKey(_event: IpcMainInvokeEvent): Promise<string> {
		const { valid, apiKey } = await providerStorage.validate302AIProvider();
		if (!valid) {
			throw new Error("302.ai API key validation failed");
		}
		return apiKey;
	}
}

export const providerService = new ProviderService();
