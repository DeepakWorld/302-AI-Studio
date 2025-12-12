import { app, shell, type IpcMainInvokeEvent } from "electron";

export class SsoService {
	private pendingCallback: ((apiKey: string) => void) | null = null;
	private callbackTimeout: NodeJS.Timeout | null = null;
	private isInitialized = false;

	/**
	 * Initialize SSO service - must be called before app.ready
	 */
	initializeProtocolHandler() {
		if (this.isInitialized) {
			return;
		}

		console.log("[SSO] Initializing protocol handler");

		// Register custom protocol handler for SSO callback
		if (!app.isDefaultProtocolClient("302aistudio")) {
			const result = app.setAsDefaultProtocolClient("302aistudio");
			console.log("[SSO] Set as default protocol client result:", result);
		} else {
			console.log("[SSO] Already set as default protocol client");
		}

		// Handle deep links (macOS/Linux)
		app.on("open-url", (event, url) => {
			console.log("[SSO] open-url event received:", url);
			event.preventDefault();
			this.handleSsoCallback(url);
		});

		this.isInitialized = true;
	}

	/**
	 * Setup second instance handler - must be called after single instance lock
	 */
	setupSecondInstanceHandler() {
		// Handle deep links (Windows) via second-instance event
		app.on("second-instance", (_event, commandLine, _workingDirectory) => {
			console.log("[SSO] second-instance handler in SSO service, commandLine:", commandLine);
			// Windows: commandLine contains the deep link URL
			const url = commandLine.find((arg) => arg.startsWith("302aistudio://"));
			if (url) {
				console.log("[SSO] Found SSO deep link:", url);
				this.handleSsoCallback(url);
			}
		});
	}

	/**
	 * Open SSO login in external browser
	 */
	async openSsoLogin(
		_event: IpcMainInvokeEvent,
		serverPort: number,
		language: string = "zh",
	): Promise<{ success: boolean; error?: string }> {
		try {
			// Use local server as redirect URL with language in path (not query params)
			// 302.AI will append ?apikey=... so we can't have query params in the redirect URL
			const redirectUrl = `http://localhost:${serverPort}/sso/callback/${language}`;
			console.log("[SSO] Using redirect URL:", redirectUrl);

			// Use 'redirecturl' (no underscore) as per 302.AI SSO API
			const params = new URLSearchParams({
				app: "302 AI Studio",
				name: "302 AI Studio",
				icon: "https://file.302.ai/gpt/imgs/5b36b96aaa052387fb3ccec2a063fe1e.png",
				weburl: "https://302.ai/",
				redirecturl: redirectUrl,
			});

			const ssoUrl = `https://302.ai/sso?${params.toString()}`;
			console.log("[SSO] Opening SSO URL:", ssoUrl);
			await shell.openExternal(ssoUrl);

			return { success: true };
		} catch (error) {
			console.error("[SSO] Failed to open SSO login:", error);
			return { success: false, error: String(error) };
		}
	}

	/**
	 * Handle SSO callback from local server
	 */
	handleSsoCallbackFromServer(apiKey: string) {
		console.log("[SSO] Received callback from server with API key");
		if (this.pendingCallback) {
			this.pendingCallback(apiKey);
		} else {
			console.warn("[SSO] No pending callback to handle API key");
		}
	}

	/**
	 * Wait for SSO callback with timeout
	 */
	async waitForSsoCallback(
		_event: IpcMainInvokeEvent,
		timeoutMs: number = 300000,
	): Promise<{ success: boolean; apiKey?: string; error?: string }> {
		console.log("[SSO] Waiting for callback, timeout:", timeoutMs);
		return new Promise((resolve) => {
			// Set timeout
			this.callbackTimeout = setTimeout(() => {
				console.log("[SSO] Callback timeout");
				this.pendingCallback = null;
				resolve({ success: false, error: "SSO login timed out" });
			}, timeoutMs);

			// Set callback handler
			this.pendingCallback = (apiKey: string) => {
				console.log("[SSO] Callback handler called with API key");
				if (this.callbackTimeout) {
					clearTimeout(this.callbackTimeout);
					this.callbackTimeout = null;
				}
				this.pendingCallback = null;
				resolve({ success: true, apiKey });
			};
		});
	}

	/**
	 * Handle SSO callback from deep link
	 */
	private handleSsoCallback(url: string) {
		console.log("[SSO] Received callback URL:", url);

		try {
			// Parse URL: 302aistudio://auth/callback?apikey=xxx&uid=xxx&username=xxx
			const parsedUrl = new URL(url);
			console.log("[SSO] Parsed URL:", {
				protocol: parsedUrl.protocol,
				host: parsedUrl.host,
				pathname: parsedUrl.pathname,
				search: parsedUrl.search,
			});

			const apiKey = parsedUrl.searchParams.get("apikey");
			console.log("[SSO] Extracted API key:", apiKey ? "exists" : "missing");

			if (apiKey && this.pendingCallback) {
				console.log("[SSO] API Key received, calling callback");
				this.pendingCallback(apiKey);
			} else {
				console.warn("[SSO] No API key or no pending callback", {
					hasApiKey: !!apiKey,
					hasPendingCallback: !!this.pendingCallback,
				});
			}
		} catch (error) {
			console.error("[SSO] Failed to parse callback URL:", error);
		}
	}

	/**
	 * Cancel pending SSO login
	 */
	cancelSsoLogin(_event: IpcMainInvokeEvent): void {
		console.log("[SSO] Canceling SSO login");
		if (this.callbackTimeout) {
			clearTimeout(this.callbackTimeout);
			this.callbackTimeout = null;
		}
		this.pendingCallback = null;
	}
}

export const ssoService = new SsoService();
