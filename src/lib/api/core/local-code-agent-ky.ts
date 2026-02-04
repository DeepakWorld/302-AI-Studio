import { m } from "$lib/paraglide/messages";
import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
import ky from "ky";
import { toast } from "svelte-sonner";

const { getUserAgentFragment } = window.electronAPI.appService;

/**
 * Ky instance for local Code Agent mode
 * - Uses http://localhost:<port> (default 8123)
 * - No Authorization header needed (local sandbox doesn't require API key)
 * - Dynamically updates port if runtime uses a different one
 */
export const localCodeAgentKy = ky.create({
	timeout: 60000,
	// Start with an HTTP prefixUrl to establish HTTP context immediately.
	// This prevents ALPN negotiation errors (which happen when switching from HTTPS context)
	// and ensures correct path resolution (avoiding relative path issues like including /chat/...).
	prefixUrl: "http://localhost:8123",
	headers: {
		"HTTP-Referer": "https://studio.302.ai/",
		"X-Title": "302.AI Studio",
	},
	retry: 3,
	fetch: async (input, init) => {
		try {
			return await fetch(input, init);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message === "Failed to fetch" &&
				codeAgentState.type === "local"
			) {
				toast.error(m.code_agent_local_container_not_started(), {
					id: "local-code-agent-connection-error",
					action: {
						label: m.toast_button_start_sandbox(),
						onClick: async () => {
							await localEnvState.startSandbox();
						},
					},
				});
			}
			throw error;
		}
	},
	hooks: {
		beforeRequest: [
			async (request) => {
				const userAgent = await getUserAgentFragment();
				request.headers.set("User-Agent", userAgent);

				try {
					const localBaseUrl = await window.electronAPI.localVibeService.getLocalBaseUrl();
					if (localBaseUrl) {
						const localUrl = new URL(localBaseUrl);
						const url = new URL(request.url);

						// If the runtime port is different from the current request port, update it
						if (url.port !== localUrl.port) {
							url.port = localUrl.port;
							// Since the original request was already HTTP (due to prefixUrl),
							// reusing it here is safe and won't trigger ALPN errors.
							return new Request(url.toString(), request);
						}
					}
				} catch (error) {
					console.error("Failed to sync local port:", error);
				}
			},
		],
	},
});
