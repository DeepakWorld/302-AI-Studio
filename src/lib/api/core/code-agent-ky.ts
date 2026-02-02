import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
import ky from "ky";

const { getUserAgentFragment } = window.electronAPI.appService;
const { get302AIApiKey } = window.electronAPI.providerService;

export const codeAgentKy = ky.create({
	timeout: 60000,
	prefixUrl: "https://api.302.ai",
	headers: {
		"HTTP-Referer": "https://studio.302.ai/",
		"X-Title": "302.AI Studio",
	},
	retry: 3,
	hooks: {
		beforeRequest: [
			async (request) => {
				const userAgent = await getUserAgentFragment();
				request.headers.set("User-Agent", userAgent);

				// If local mode, redirect to local base URL and skip apiKey injection
				if (codeAgentState.type === "local") {
					try {
						const localBaseUrl = await window.electronAPI.envService.getLocalBaseUrl();
						if (localBaseUrl) {
							const url = new URL(request.url);
							// If the request is targeting the production API, switch it to local
							if (url.origin === "https://api.302.ai") {
								const localUrl = new URL(localBaseUrl);
								url.protocol = localUrl.protocol;
								url.hostname = localUrl.hostname;
								url.port = localUrl.port;
								return new Request(url.toString(), request);
							}
						}
					} catch (error) {
						console.error("Failed to get local base URL:", error);
					}
					return;
				}

				// Remote mode requires API key
				try {
					const apiKey = await get302AIApiKey();
					request.headers.set("Authorization", `Bearer ${apiKey}`);
				} catch {
					throw new Error("302.ai API key validation failed");
				}
			},
		],
	},
});
