import { buildMcpServerUrl, fetch302McpServers } from "$lib/api/302-mcp-servers";
import type { SsoApikeyDialogAction } from "$lib/components/buss/sso-apikey-dialog";
import { m } from "$lib/paraglide/messages.js";
import { open302SsoLogin } from "$lib/utils/sso";
import type { McpServer } from "@shared/storage/mcp";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";
import { generalSettings } from "./general-settings.state.svelte";
import { mcpState } from "./mcp-state.svelte";
import { preferencesSettings } from "./preferences-settings.state.svelte";
import { persistedModelState, providerState } from "./provider-state.svelte";
import { sessionState } from "./session-state.svelte";
import { userState } from "./user-state.svelte";

/**
 * Default model ID to use for new users after initial login
 * This should be a popular, featured model that provides a good first experience
 */
const DEFAULT_MODEL_ID = "gemini-3-pro-preview";

class SsoStateManager {
	isLoading = $state(false);
	hasError = $state(false);
	isSuccess = $state(false);

	// API Key conflict dialog state
	showApiKeyConflictDialog = $state(false);
	pendingApiKey = $state<string | null>(null);

	async login() {
		if (this.isLoading) return;

		this.isLoading = true;
		this.hasError = false;
		this.isSuccess = false;

		try {
			const result = await open302SsoLogin();

			if (result.success && result.apiKey) {
				// Set the API key as token with Basic prefix
				const token = result.apiKey.startsWith("Basic ") ? result.apiKey : `Basic ${result.apiKey}`;
				userState.setToken(token);

				// Extract raw API key
				let rawApiKey = result.apiKey;
				if (rawApiKey.startsWith("Basic ")) {
					rawApiKey = rawApiKey.slice(6).trim();
				}

				// Check 302.AI provider status
				const provider = providerState.getProvider("302AI");

				if (provider && provider.apiKey && provider.apiKey.trim() !== "") {
					// Provider already has an API key - show conflict dialog
					this.pendingApiKey = rawApiKey;
					this.showApiKeyConflictDialog = true;
					// Don't proceed with login flow yet - wait for user selection
					// The handleApiKeyConflict method will continue the flow
				} else if (provider) {
					// Provider exists but has no API key - auto-fill it
					await providerState.updateProvider("302AI", { apiKey: rawApiKey });
					// Store the SSO API key for association tracking
					userState.setSsoApiKey(rawApiKey);
					await providerState.fetchModelsForProvider(provider);
					await this.completeLoginFlow();
				} else {
					// No provider found - just complete login
					await this.completeLoginFlow();
				}
			} else {
				this.hasError = true;
				if (result.error && !result.error.includes("closed") && !result.error.includes("timeout")) {
					toast.error(result.error);
				}
				this.isLoading = false;
			}
		} catch (_error) {
			this.hasError = true;
			toast.error(m.sso_error());
			this.isLoading = false;
		}
	}

	/**
	 * Handle the user's selection from the API key conflict dialog
	 */
	async handleApiKeyConflict(action: SsoApikeyDialogAction) {
		this.showApiKeyConflictDialog = false;

		const newApiKey = this.pendingApiKey;
		this.pendingApiKey = null;

		if (!newApiKey) {
			this.isLoading = false;
			return;
		}

		const provider = providerState.getProvider("302AI");
		if (!provider) {
			this.isLoading = false;
			return;
		}

		try {
			switch (action) {
				case "override":
					// Override: Replace the existing API key with the new one
					await providerState.updateProvider("302AI", { apiKey: newApiKey });
					// Store the SSO API key for association tracking
					userState.setSsoApiKey(newApiKey);
					await providerState.fetchModelsForProvider(provider);
					break;

				case "keep":
					// Keep: Keep the original API key, but refresh models with it
					// Don't update ssoApiKey - the user chose to keep the old key
					await providerState.fetchModelsForProvider(provider);
					break;

				case "backup": {
					// Backup: Create a backup of the original provider, then override
					const suffix =
						generalSettings.language === "zh"
							? m.sso_apikey_provider_backup_suffix()
							: m.sso_apikey_provider_backup_suffix();
					providerState.createProviderBackup("302AI", suffix);

					// Now update the original provider with the new API key
					await providerState.updateProvider("302AI", { apiKey: newApiKey });
					// Store the SSO API key for association tracking
					userState.setSsoApiKey(newApiKey);
					await providerState.fetchModelsForProvider(provider);
					break;
				}
			}

			await this.completeLoginFlow();
		} catch (error) {
			console.error("Failed to handle API key conflict:", error);
			this.hasError = true;
			toast.error(m.sso_error());
			this.isLoading = false;
		}
	}

	/**
	 * Complete the login flow after handling provider updates
	 */
	private async completeLoginFlow() {
		try {
			// Fetch user info
			const fetchResult = await userState.fetchUserInfo();
			if (fetchResult.success) {
				this.isSuccess = true;
				toast.success(m.login_success());

				// Set default model for first-time users (after models are fetched)
				await this.setDefaultModelIfNeeded();

				// Fetch and import MCP servers from 302.AI (silently, don't block login)
				this.fetchAndImportMcpServers();

				// Reset success state after 3 seconds
				setTimeout(() => {
					this.isSuccess = false;
				}, 3000);
			} else {
				this.hasError = true;
				toast.error(fetchResult.error || m.sso_error());
			}
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Set a default model for first-time users after initial login
	 * This ensures users don't have to manually select a model to start chatting
	 */
	private async setDefaultModelIfNeeded() {
		// Check if user already has a model preference set
		const hasExistingModelPreference =
			preferencesSettings.newSessionModel !== null || sessionState.latestUsedModel !== null;

		if (hasExistingModelPreference) {
			console.log("[SSO] User already has model preference, skipping default model setup");
			return;
		}

		// Find the default model from the fetched models
		const models = persistedModelState.current;
		if (models.length === 0) {
			console.log("[SSO] No models available, skipping default model setup");

			return;
		}

		// Try to find the preferred default model
		let defaultModel = models.find((m) => m.id === DEFAULT_MODEL_ID);

		// If preferred model not found, fall back to any featured model
		if (!defaultModel) {
			defaultModel = models.find((m) => m.isFeatured);
		}

		// If still no model found, use the first available model
		if (!defaultModel) {
			defaultModel = models[0];
		}

		if (defaultModel) {
			// Set as the default model for future new sessions
			preferencesSettings.setNewSessionModel(defaultModel);

			// Broadcast to all chat tabs to apply the default model
			// This handles the case where chat tabs are already open but don't have a model selected
			try {
				// Clone the model object to ensure it can be serialized for IPC
				// The original object may be a Proxy from Svelte's reactivity system
				const modelForBroadcast = JSON.parse(JSON.stringify(defaultModel));
				await window.electronAPI.broadcastService.broadcastToAll("apply-default-model", {
					model: modelForBroadcast,
				});
			} catch (error) {
				console.error("[SSO] Failed to broadcast apply-default-model event:", error);
			}
		}
	}

	/**
	 * Fetch MCP servers from 302.AI and import them locally
	 * This runs silently and doesn't affect the login flow
	 */
	private async fetchAndImportMcpServers() {
		const token = userState.token;
		if (!token) {
			console.log("[302 MCP] No token available, skipping MCP server fetch");
			return;
		}

		try {
			const servers302 = await fetch302McpServers(token);
			if (servers302.length === 0) {
				console.log("[302 MCP] No MCP servers found from 302.AI");
				return;
			}

			// Convert to local McpServer format
			const now = new Date();
			const maxOrder = mcpState.servers.reduce((max, s) => Math.max(max, s.order), 0);

			const mcpServers: McpServer[] = servers302.map((server, index) => {
				const serverUrl = buildMcpServerUrl(server.proxyId);
				return {
					id: nanoid(),
					name: server.name,
					description: server.displayTools.length > 0 ? server.displayTools.join(", ") : "",
					type: "streamableHTTP" as const,
					url: serverUrl,
					command: null,
					icon: "🔧",
					enabled: true,
					order: maxOrder + index + 1,
					createdAt: now,
					updatedAt: now,
					// Association tracking fields
					associatedWithAccount: true,
					originalUrl: serverUrl,
					originalType: "streamableHTTP" as const,
					originalCommand: null,
				};
			});

			// Add servers that don't already exist (by name)
			const result = mcpState.addServersIfNotExists(mcpServers);
			console.log(
				`[302 MCP] Import complete: ${result.added} added, ${result.skipped} skipped (already exist)`,
			);
		} catch (error) {
			// Silently log errors - don't affect login flow
			console.error("[302 MCP] Failed to fetch/import MCP servers:", error);
		}
	}

	/**
	 * Cancel the API key conflict dialog
	 */
	cancelApiKeyConflict() {
		this.showApiKeyConflictDialog = false;
		this.pendingApiKey = null;
		this.isLoading = false;
	}

	reset() {
		this.isLoading = false;
		this.hasError = false;
		this.isSuccess = false;
		this.showApiKeyConflictDialog = false;
		this.pendingApiKey = null;
	}
}

export const ssoState = new SsoStateManager();
