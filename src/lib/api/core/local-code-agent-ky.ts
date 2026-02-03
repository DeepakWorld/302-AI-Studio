import ky from "ky";

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
	hooks: {
		beforeRequest: [
			async (request) => {
				const userAgent = await getUserAgentFragment();
				request.headers.set("User-Agent", userAgent);

				try {
					const localBaseUrl = await window.electronAPI.envService.getLocalBaseUrl();
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
