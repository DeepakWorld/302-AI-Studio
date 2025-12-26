import type { ChatParameters } from "@shared/storage/chat-parameters";
import { prefixStorage } from "@shared/types";
import { StorageService } from ".";
import { emitter } from "../broadcast-service";

class ChatParametersStorage extends StorageService<ChatParameters> {
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

	async getUserPromptTemplate(threadId: string): Promise<{
		variables: string[];
		content: string;
		map: Record<string, string>;
	}> {
		const chatParameters = await this.getItemInternal(threadId);
		if (!chatParameters) {
			return { variables: [], content: "", map: {} };
		}
		return {
			variables: chatParameters.userPromptTemplateVariables,
			content: chatParameters.userPromptTemplateContent,
			map: chatParameters.userPromptTemplateMap,
		};
	}

	async updateUserPromptTemplateMap(
		threadId: string,
		updatedMap: Record<string, string>,
	): Promise<void> {
		const chatParameters = await this.getItemInternal(threadId);
		if (!chatParameters) return;

		await this.setItemInternal(threadId, {
			...chatParameters,
			userPromptTemplateMap: {
				...chatParameters.userPromptTemplateMap,
				...updatedMap,
			},
		});
	}

	async getUserPromptTemplateVariables(threadId: string): Promise<string[]> {
		const chatParameters = await this.getItemInternal(threadId);
		if (!chatParameters) return [];
		return chatParameters.userPromptTemplateVariables;
	}
}

export const chatParametersStorage = new ChatParametersStorage();
