import { codeAgentGlobalConfigsStorage } from "@electron/main/services/storage-service/code-agent";
import { getCustomUserAgentFragment } from "@electron/main/utils/user-agent";
import ky from "ky";

const userAgent = getCustomUserAgentFragment();

export const codeAgentKy = ky.create({
	timeout: 60000,
	prefixUrl: "https://api.302.ai",
	headers: {
		"User-Agent": userAgent,
		"HTTP-Referer": "https://studio.302.ai/",
		"X-Title": "302.AI Studio",
	},
	hooks: {
		beforeRequest: [
			async (request) => {
				const { isOK, data } = await codeAgentGlobalConfigsStorage.getGlobalConfigs();
				if (!isOK) throw new Error("302.ai API key validation failed");
				request.headers.set("Authorization", `Bearer ${data.apiKey}`);
			},
		],
	},
});
