/**
 * @302ai/studio-plugin-sdk
 *
 * Plugin SDK for 302.AI Studio
 * Build plugins to extend the AI chat application
 *
 * @example
 * ```typescript
 * import { BaseProviderPlugin, type Model, type ModelProvider } from "@302ai/studio-plugin-sdk";
 *
 * export class MyProviderPlugin extends BaseProviderPlugin {
 * protected providerId = "my-provider";
 * protected providerName = "My Provider";
 * protected apiType = "openai";
 * protected defaultBaseUrl = "[https://api.example.com/v1](https://api.example.com/v1)";
 * protected websites = {
 * official: "[https://example.com](https://example.com)",
 * apiKey: "[https://example.com/api-keys](https://example.com/api-keys)",
 * docs: "[https://docs.example.com](https://docs.example.com)",
 * models: "[https://docs.example.com/models](https://docs.example.com/models)",
 * };
 *
 * async onFetchModels(provider: ModelProvider): Promise<Model[]> {
 * // Fetch models from your API
 * return [];
 * }
 * }
 * ```
 */

/* ============================================================================
 * Core Types
 * ========================================================================= */

// Metadata Types
export type {
	PluginType,
	PluginPermission,
	PluginStatus,
	PluginMetadata,
	InstalledPlugin,
} from "./metadata.js";

// Shared Business Types
export type {
	ModelType,
	ModelCapability,
	Model,
	ModelProviderWebsites,
	ModelProviderStatus,
	ModelProvider,
	MessageMetadata,
	ChatTools,
	CustomUIDataTypes,
	ChatMessage,
} from "./shared.js";

// UI Types
export type {
	DialogOptions,
	DialogResult,
	WindowOptions,
	RequestOptions,
	ComponentRegistry,
} from "./ui.js";

// Hook Types
export type {
	HookHandler,
	HookOptions,
	HookResult,
	AuthContext,
	AuthResult,
	MessageContext,
	StreamChunk,
	AIResponse,
	ErrorContext,
	ErrorHandleResult,
} from "./hooks.js";

// API Types
export type {
	PluginAPI,
	PluginStorageAPI,
	PluginHookAPI,
	PluginUIAPI,
	PluginLoggerAPI,
	PluginHttpAPI,
	PluginI18nAPI,
} from "./api.js";

// Provider Types
export type { ProviderDefinition, ProviderPlugin } from "./provider.js";

/* ============================================================================
 * Base Classes
 * ========================================================================= */

export { BaseProviderPlugin } from "./base-provider-plugin.js";

/* ============================================================================
 * Version
 * ========================================================================= */

export const SDK_VERSION = "1.0.0";