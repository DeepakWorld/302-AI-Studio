import { getAllModels, getModelsByProvider } from "$lib/api/models.js";
import { DEFAULT_PROVIDERS } from "$lib/datas/providers.js";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages.js";
import { getFilteredModels } from "$lib/utils/model-filters.js";
import type { Model, ModelCreateInput, ModelProvider, ModelUpdateInput } from "@shared/types";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";
import { preferencesSettings } from "./preferences-settings.state.svelte";
import { sessionState } from "./session-state.svelte";

export const persistedProviderState = new PersistedState<ModelProvider[]>(
	"app-providers",
	DEFAULT_PROVIDERS,
	true,
	300,
);
export const persistedModelState = new PersistedState<Model[]>("app-models", [], true, 500);

const { providerService } = window.electronAPI;

$effect.root(() => {
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedModelState.current;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedProviderState.current;
	});
});

let pendingDeleteIds: string[] = [];
let deleteFlushScheduled = false;

function flushPendingDeletes() {
	deleteFlushScheduled = false;
	if (pendingDeleteIds.length === 0) return;

	const idsToDelete = new Set(pendingDeleteIds);
	pendingDeleteIds = [];
	const current = persistedModelState.snapshot;
	const next = current.filter((m) => !idsToDelete.has(m.id));

	persistedModelState.current = next;
}

let cachedSortedModels: Model[] = [];
let lastModelArray: Model[] = [];

function getCachedSortedModels(): Model[] {
	const currentModels = persistedModelState.current;
	if (currentModels !== lastModelArray) {
		lastModelArray = currentModels;
		cachedSortedModels = [...currentModels].sort((a, b) => a.name.localeCompare(b.name));
	}
	return cachedSortedModels;
}

class ProviderState {
	getProvider(id: string): ModelProvider | null {
		return persistedProviderState.current.find((p) => p.id === id) || null;
	}
	getProviderByNameOrId(nameOrId: string): ModelProvider | undefined {
		return persistedProviderState.current.find((p) => p.name === nameOrId || p.id === nameOrId);
	}
	addProvider(provider: ModelProvider) {
		persistedProviderState.current = [...persistedProviderState.current, provider];
	}
	async updateProvider(id: string, updates: Partial<ModelProvider>) {
		persistedProviderState.current = persistedProviderState.current.map((p) =>
			p.id === id ? { ...p, ...updates } : p,
		);

		if (updates.apiKey && id === "302AI") {
			await providerService.handle302AIProviderChange(updates.apiKey);
		}
	}
	removeProvider(id: string) {
		persistedProviderState.current = persistedProviderState.current.filter((p) => p.id !== id);
	}
	reorderProviders(newOrder: ModelProvider[]) {
		persistedProviderState.current = [...newOrder];
	}
	createCustomProvider(name: string = "自定义提供商"): ModelProvider {
		const timestamp = Date.now();
		return {
			id: `custom-${timestamp}`,
			name,
			apiType: "openai",
			apiKey: "",
			baseUrl: "",
			enabled: true,
			custom: true,
			status: "pending",
			websites: {
				official: "",
				apiKey: "",
				docs: "",
				models: "",
				defaultBaseUrl: "",
			},
			icon: undefined,
		};
	}
	resetToDefaults() {
		persistedProviderState.current = [...DEFAULT_PROVIDERS];
	}
	searchModelsByName(name: string): Model[] {
		return persistedModelState.current.filter((m) =>
			m.name.toLowerCase().includes(name.toLowerCase()),
		);
	}
	getSortedModels(): Model[] {
		return getCachedSortedModels();
	}

	addModel(input: ModelCreateInput): Model {
		if (!input.id || !input.id.trim()) {
			throw new Error("Model ID is required and cannot be empty");
		}

		const existingModel = persistedModelState.current.find((m) => m.id === input.id);
		if (existingModel) {
			// 检查 isAddedByUser 字段
			const isAddedByUser = (existingModel as Model & { isAddedByUser?: boolean }).isAddedByUser;
			// 如果 isAddedByUser 为 true，说明已经被用户添加过，不允许重复添加
			if (isAddedByUser === true) {
				throw new Error(`Model with ID "${input.id}" already exists`);
			}
			// 如果 isAddedByUser 为 false 或 undefined，则更新该模型，将 isAddedByUser 设置为 true
			const updateSuccess = this.updateModel(existingModel.id, {
				id: input.id,
				name: input.name,
				remark: input.remark,
				providerId: input.providerId,
				capabilities: input.capabilities,
				type: input.type,
				custom: input.custom,
				enabled: input.enabled,
				collected: input.collected,
				isFeatured: input.isFeatured,
				isAddedByUser: true,
			});
			if (updateSuccess) {
				const updatedModel = persistedModelState.current.find((m) => m.id === input.id);
				if (updatedModel) {
					return updatedModel;
				}
			}
			return existingModel;
		}

		const model: Model & { isAddedByUser?: boolean } = {
			id: input.id,
			name: input.name,
			remark: input.remark || "",
			providerId: input.providerId,
			capabilities: input.capabilities || new Set(),
			type: input.type || "language",
			custom: input.custom || false,
			enabled: input.enabled ?? true,
			collected: input.collected || false,
			isFeatured: input.isFeatured || false,
			isAddedByUser: input.isAddedByUser || false,
		};
		persistedModelState.current = [...persistedModelState.current, model];

		return model;
	}
	updateModel(id: string, updates: ModelUpdateInput): boolean {
		const modelIndex = persistedModelState.current.findIndex((m) => m.id === id);
		if (modelIndex === -1) return false;

		if (updates.id && updates.id !== id) {
			const existingModel = persistedModelState.current.find((m) => m.id === updates.id);
			if (existingModel) {
				console.warn(`Model with ID "${updates.id}" already exists`);
				return false;
			}
		}

		persistedModelState.current = persistedModelState.current.map((m) =>
			m.id === id ? { ...m, ...updates } : m,
		);

		return true;
	}
	removeModel(id: string): boolean {
		const originalLength = persistedModelState.current.length;
		persistedModelState.current = persistedModelState.current.filter((m) => m.id !== id);
		if (persistedModelState.current.length !== originalLength) {
			return true;
		}
		return false;
	}
	scheduleRemoveModel(id: string): void {
		pendingDeleteIds.push(id);
		if (!deleteFlushScheduled) {
			deleteFlushScheduled = true;
			requestAnimationFrame(flushPendingDeletes);
		}
	}
	addModels(models: ModelCreateInput[]): Model[] {
		const newModels: Model[] = models.map((input) => ({
			id: nanoid(),
			name: input.name,
			remark: input.remark || "",
			providerId: input.providerId,
			capabilities: input.capabilities || new Set(),
			type: input.type || "language",
			custom: input.custom || false,
			enabled: input.enabled ?? true,
			collected: input.collected || false,
			isFeatured: input.isFeatured || false,
		}));
		persistedModelState.current = [...persistedModelState.current, ...newModels];

		return newModels;
	}
	toggleModelCollected(id: string): boolean {
		const model = persistedModelState.current.find((m) => m.id === id);
		if (!model) return false;

		persistedModelState.current = persistedModelState.current.map((m) =>
			m.id === id ? { ...m, collected: !m.collected } : m,
		);

		return true;
	}
	toggleModelEnabled(id: string): boolean {
		const model = persistedModelState.current.find((m) => m.id === id);
		if (!model) return false;

		persistedModelState.current = persistedModelState.current.map((m) =>
			m.id === id ? { ...m, enabled: !m.enabled } : m,
		);

		return true;
	}
	async removeModelsByProvider(providerId: string): Promise<number> {
		const originalLength = persistedModelState.current.length;
		const modelsToRemove = persistedModelState.current.filter((m) => m.providerId === providerId);
		const deletedModelIds = modelsToRemove.map((m) => m.id);
		const deletedModelIdSet = new Set(deletedModelIds);

		persistedModelState.current = persistedModelState.current.filter(
			(m) => m.providerId !== providerId,
		);
		const removedCount = originalLength - persistedModelState.current.length;

		// Clear selectedModel references from all threads for deleted models
		if (removedCount > 0 && deletedModelIds.length > 0) {
			// Clear global model references if they point to a deleted model
			const latestUsedModel = sessionState.latestUsedModel;
			if (latestUsedModel && deletedModelIdSet.has(latestUsedModel.id)) {
				sessionState.latestUsedModel = null;
				console.log(`[Provider] Cleared latestUsedModel reference for deleted model`);
			}

			const newSessionModel = preferencesSettings.newSessionModel;
			if (newSessionModel && deletedModelIdSet.has(newSessionModel.id)) {
				preferencesSettings.setNewSessionModel(null);
				console.log(`[Provider] Cleared newSessionModel reference for deleted model`);
			}

			const titleGenModel = preferencesSettings.state.titleGenerationModel;
			if (titleGenModel && deletedModelIdSet.has(titleGenModel.id)) {
				preferencesSettings.setTitleGenerationModel(null);
				console.log(`[Provider] Cleared titleGenerationModel reference for deleted model`);
			}

			try {
				const { threadService, broadcastService } = window.electronAPI;
				const clearedCount = await threadService.clearDeletedModelReferences(deletedModelIds);
				if (clearedCount > 0) {
					console.log(
						`[Provider] Cleared selectedModel references in ${clearedCount} thread(s) for deleted models`,
					);
				}

				// Broadcast to all tabs to clear their in-memory selectedModel
				// Include providerId so tabs can clear even if modelId shape mismatches
				await broadcastService.broadcastToAll("models-deleted", {
					deletedModelIds,
					providerId,
				});
			} catch (error) {
				console.error("[Provider] Failed to clear deleted model references:", error);
			}
		}

		return removedCount;
	}
	async clearModelsByProvider(providerId: string): Promise<number> {
		return await this.removeModelsByProvider(providerId);
	}
	async fetchModelsForProvider(provider: ModelProvider): Promise<boolean> {
		try {
			// 确保使用最新的 provider 数据
			const latestProvider = this.getProvider(provider.id);
			if (!latestProvider) {
				console.error(`Provider ${provider.id} not found`);
				return false;
			}

			const result = await getModelsByProvider(latestProvider);
			if (result.success && result.data) {
				await this.updateProvider(latestProvider.id, { status: "connected" });
				persistedModelState.current = persistedModelState.current
					.filter((models) => {
						return models.providerId !== latestProvider.id;
					})
					.concat(result.data.models);

				// 对于 302AI provider，只统计 isFeatured === true 或 isAddedByUser === true 的模型数量
				const displayCount =
					latestProvider.id === "302AI"
						? getFilteredModels(result.data.models).length
						: result.data.models.length;

				toast.success(
					m.text_fetch_models_success({
						count: displayCount.toString(),
						provider: latestProvider.name,
					}),
				);
				return true;
			} else {
				await this.updateProvider(latestProvider.id, { status: "error" });
				toast.error(m.text_fetch_models_error({ provider: latestProvider.name }), {
					description: result.error || m.text_fetch_models_unknown_error(),
				});
				return false;
			}
		} catch (error) {
			console.error(`Failed to fetch models for provider ${provider.id}:`, error);
			await this.updateProvider(provider.id, { status: "error" });
			toast.error(m.text_fetch_models_error({ provider: provider.name }), {
				description: error instanceof Error ? error.message : m.text_fetch_models_network_error(),
			});
			return false;
		}
	}
	async fetchAllModels(): Promise<boolean> {
		try {
			const result = await getAllModels(persistedProviderState.current);
			if (result.success && result.data) {
				persistedModelState.current = result.data.models;

				return true;
			}
			return false;
		} catch (error) {
			console.error("Failed to fetch all models:", error);
			return false;
		}
	}
	async refreshProviderModels(providerId: string): Promise<boolean> {
		const provider = this.getProvider(providerId);
		if (!provider) return false;

		return await this.fetchModelsForProvider(provider);
	}

	/**
	 * Create a backup copy of an existing provider with a suffix added to its name.
	 * @param providerId - The ID of the provider to backup
	 * @param nameSuffix - The suffix to add to the provider name (e.g., "旧" or "Old")
	 * @returns The newly created backup provider, or null if the original provider was not found
	 */
	createProviderBackup(providerId: string, nameSuffix: string): ModelProvider | null {
		const originalProvider = this.getProvider(providerId);
		if (!originalProvider) return null;

		const timestamp = Date.now();
		const backupProvider: ModelProvider = {
			...originalProvider,
			id: `${providerId}-backup-${timestamp}`,
			name: `${originalProvider.name} - ${nameSuffix}`,
			custom: true, // Mark as custom so it can be removed
		};

		this.addProvider(backupProvider);

		// Copy models from original provider to backup provider
		const originalModels = persistedModelState.current.filter(
			(model) => model.providerId === providerId,
		);
		if (originalModels.length > 0) {
			const backupModels: Model[] = originalModels.map((model) => ({
				...model,
				id: `${model.id}-backup-${timestamp}`,
				providerId: backupProvider.id,
			}));
			persistedModelState.current = [...persistedModelState.current, ...backupModels];
		}

		return backupProvider;
	}

	/**
	 * Clear the API key from the 302.AI provider if it matches the given key
	 * Also clears all models associated with the provider
	 * Used when logging out to unlink the associated API key
	 * @param associatedApiKey - The API key to compare against
	 * @returns true if the key was cleared, false if it didn't match or provider not found
	 */
	async clearAssociatedApiKey(associatedApiKey: string): Promise<boolean> {
		const provider = this.getProvider("302AI");
		if (!provider) return false;

		// Only clear if the current API key matches the associated key
		if (provider.apiKey === associatedApiKey) {
			this.updateProvider("302AI", { apiKey: "" });
			// Also clear all models for this provider
			const removedCount = await this.removeModelsByProvider("302AI");
			console.log(
				`[Provider] Cleared associated API key and ${removedCount} models from 302.AI provider`,
			);
			return true;
		}

		console.log("[Provider] API key mismatch, not clearing (user may have modified it)");
		return false;
	}
}

export const providerState = new ProviderState();
