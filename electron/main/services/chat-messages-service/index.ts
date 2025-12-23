import type { ChatMessage } from "@shared/types";
import { chatMessagesStorage } from "../storage-service/chat-messages-storage";

class ChatMessagesService {
	async getMessagesByThreadId(threadId: string): Promise<ChatMessage[]> {
		return chatMessagesStorage.getMessagesByThreadId(threadId);
	}
}

export const chatMessagesService = new ChatMessagesService();
