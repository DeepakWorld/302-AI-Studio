import { prefixStorage, type ChatMessage } from "@shared/types";
import { StorageService } from ".";

class ChatMessagesStorage extends StorageService<ChatMessage[]> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "app-chat-messages");
	}

	async getMessagesByThreadId(threadId: string): Promise<ChatMessage[]> {
		const messages = await this.getItemInternal(threadId);
		if (!messages) return [];
		return messages;
	}
}

export const chatMessagesStorage = new ChatMessagesStorage();
