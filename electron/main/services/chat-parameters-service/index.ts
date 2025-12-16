import { prefixStorage } from "@shared/types";
import { StorageService } from "../storage-service";
import { emitter } from "../broadcast-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ChatParametersStorage extends StorageService<any> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "app-chat-parameters");

		emitter.on("thread:thread-deleted", ({ threadId }) => {
			this.removeChatParameters(threadId);
		});
	}

	async removeChatParameters(threadId: string): Promise<void> {
		await this.removeItemInternal(threadId);
	}
}

export const chatParametersStorage = new ChatParametersStorage();
