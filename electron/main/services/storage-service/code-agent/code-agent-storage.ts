import { CodeAgentConfigMetadata, type CodeAgentGlobalConfigs } from "@shared/storage/code-agent";
import { prefixStorage } from "@shared/types";
import { isNull } from "es-toolkit";
import { StorageService } from "..";
import { emitter } from "../../broadcast-service";

class CodeAgentStorage extends StorageService<CodeAgentConfigMetadata> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");

		emitter.on("thread:thread-deleted", ({ threadId }) => {
			this.removeCodeAgentState(threadId);
		});
	}

	async removeCodeAgentState(threadId: string): Promise<void> {
		await Promise.all([
			this.removeItemInternal(`code-agent-config-state-${threadId}`),
			this.removeItemInternal(`claude-code-agent-state-${threadId}`),
		]);
	}
}

export const codeAgentStorage = new CodeAgentStorage();

class CodeAgentGlobalConfigsStorage extends StorageService<CodeAgentGlobalConfigs> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
	}

	async getGlobalConfigs(): Promise<{ isOK: boolean; data: CodeAgentGlobalConfigs }> {
		const defaultData = {
			apiKey: "",
			autoDeploy: true,
		};
		try {
			const data = await this.getItemInternal("code-agent-global-configs");
			if (isNull(data)) return { isOK: false, data: defaultData };
			return { isOK: true, data };
		} catch (error) {
			console.error("Error getting global configs:", error);
			return { isOK: false, data: defaultData };
		}
	}
}

export const codeAgentGlobalConfigsStorage = new CodeAgentGlobalConfigsStorage();
