import { CodeAgentConfigMetadata } from "@shared/storage/code-agent";
import { prefixStorage } from "@shared/types";
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
