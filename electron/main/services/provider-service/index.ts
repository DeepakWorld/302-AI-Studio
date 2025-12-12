import type { IpcMainInvokeEvent } from "electron";
import { emitter } from "../broadcast-service";

export class ProviderService {
	async handle302AIProviderChange(_event: IpcMainInvokeEvent, apiKey: string) {
		emitter.emit("provider:302ai-provider-changed", { apiKey });
	}
}

export const providerService = new ProviderService();
