import { DEFAULT_SANDBOX_PORT, localVibeService } from "@electron/main/services/local-vibe-service";
import { getCustomUserAgentFragment } from "@electron/main/utils/user-agent";
import ky from "ky";

const userAgent = getCustomUserAgentFragment();

export const localCodeAgentKy = ky.create({
	timeout: 60000,
	prefixUrl: `http://127.0.0.1:${DEFAULT_SANDBOX_PORT}`,
	headers: {
		"User-Agent": userAgent,
		"HTTP-Referer": "https://studio.302.ai/",
		"X-Title": "302.AI Studio",
	},
	hooks: {
		beforeRequest: [
			async (request) => {
				const runtimePort = localVibeService.getRuntimePort();

				if (!runtimePort) {
					return;
				}

				const url = new URL(request.url);
				if (parseInt(url.port) !== runtimePort) {
					url.port = runtimePort.toString();
					return new Request(url.toString(), request);
				}
			},
		],
	},
});
