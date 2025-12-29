import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { type ShortcutAction, type ShortcutScope } from "$lib/shortcut/shortcut-config";
import { DEFAULT_SHORTCUTS } from "@shared/config/default-shortcuts";

export interface ShortcutBinding {
	id: string;
	action: ShortcutAction;
	keys: string[];
	scope: ShortcutScope;
	order: number;
}

export interface ShortcutSettingsState {
	shortcuts: ShortcutBinding[];
}

const getDefaults = (): ShortcutSettingsState => ({
	shortcuts: DEFAULT_SHORTCUTS.map((s) => ({
		id: s.id,
		action: s.action,
		keys: Array.from(s.keys),
		scope: s.scope,
		order: s.order,
	})),
});

const persistedShortcutSettings = new PersistedState<ShortcutSettingsState>(
	"ShortcutSettingsStorage:state",
	getDefaults(),
);

class ShortcutSettingsManager {
	private migrationApplied = false;

	constructor() {
		// Apply migration once after hydration
		if (typeof window !== "undefined") {
			const checkHydration = () => {
				if (persistedShortcutSettings.isHydrated && !this.migrationApplied) {
					this.applyMigration();
					this.migrationApplied = true;
				} else if (!persistedShortcutSettings.isHydrated) {
					setTimeout(checkHydration, 50);
				}
			};
			checkHydration();
		}
	}

	private applyMigration(): void {
		const state = persistedShortcutSettings.current;
		let currentShortcuts = [...state.shortcuts]; // Create a copy to work with
		let needsUpdate = false;

		// Check if we're on Mac
		const isMac = typeof window !== "undefined" && window.app?.platform === "darwin";

		// Only apply platform-specific migration on non-Mac platforms
		if (!isMac) {
			// Check if any shortcut has Cmd or Option
			const hasOldKeys = currentShortcuts.some((s) =>
				s.keys.some((key) => key === "Cmd" || key === "Option"),
			);

			if (hasOldKeys) {
				// Migrate Cmd -> Ctrl and Option -> Alt (Windows/Linux only)
				const migratedShortcuts = currentShortcuts.map((shortcut) => ({
					...shortcut,
					keys: shortcut.keys.map((key) => {
						if (key === "Cmd") {
							needsUpdate = true;
							return "Ctrl";
						}
						if (key === "Option") {
							needsUpdate = true;
							return "Alt";
						}
						return key;
					}),
				}));

				currentShortcuts.splice(0, currentShortcuts.length, ...migratedShortcuts);
			}
		}

		// Sync shortcuts with DEFAULT_SHORTCUTS
		// This applies to all platforms (Mac, Windows, Linux)
		const defaultShortcutsMap = new Map(DEFAULT_SHORTCUTS.map((ds) => [ds.action, ds]));
		const existingShortcutsMap = new Map(currentShortcuts.map((s) => [s.action, s]));

		const syncedShortcuts: ShortcutBinding[] = [];
		const newShortcuts: string[] = [];
		const orderChanged: string[] = [];

		// Process each default shortcut
		for (const [action, defaultShortcut] of defaultShortcutsMap) {
			const existingShortcut = existingShortcutsMap.get(action);

			if (!existingShortcut) {
				// New shortcut not in stored shortcuts
				syncedShortcuts.push({
					id: defaultShortcut.id,
					action: defaultShortcut.action,
					keys: Array.from(defaultShortcut.keys),
					scope: defaultShortcut.scope,
					order: defaultShortcut.order,
				});
				newShortcuts.push(action);
				needsUpdate = true;
			} else {
				// Existing shortcut - check if order or scope changed
				let hasChanges = false;

				if (existingShortcut.order !== defaultShortcut.order) {
					hasChanges = true;
					orderChanged.push(action);
				}

				if (existingShortcut.scope !== defaultShortcut.scope) {
					hasChanges = true;
				}

				if (hasChanges) {
					// Update order and scope, but keep user's custom keys
					syncedShortcuts.push({
						...existingShortcut,
						order: defaultShortcut.order,
						scope: defaultShortcut.scope,
					});
					needsUpdate = true;
				} else {
					// No changes, keep as is
					syncedShortcuts.push(existingShortcut);
				}
			}
		}

		if (newShortcuts.length > 0 || orderChanged.length > 0) {
			const changes: string[] = [];
			if (newShortcuts.length > 0) changes.push(`added: ${newShortcuts.join(", ")}`);
			if (orderChanged.length > 0) changes.push(`order updated: ${orderChanged.join(", ")}`);

			console.log(`[Shortcut Migration] ${changes.join("; ")}`);
		}

		// Sort shortcuts by order
		syncedShortcuts.sort((a, b) => a.order - b.order);

		currentShortcuts = syncedShortcuts;

		if (needsUpdate) {
			this._updateShortcuts(currentShortcuts);
		}
	}

	get state(): ShortcutSettingsState {
		return persistedShortcutSettings.current;
	}

	get shortcuts(): ShortcutBinding[] {
		return persistedShortcutSettings.current.shortcuts;
	}

	getShortcut(action: ShortcutAction): ShortcutBinding | undefined {
		return persistedShortcutSettings.current.shortcuts.find((s) => s.action === action);
	}

	private _updateShortcuts(newShortcuts: ShortcutBinding[]): void {
		persistedShortcutSettings.current = {
			...persistedShortcutSettings.current,
			shortcuts: newShortcuts,
		};
	}

	updateShortcut(action: ShortcutAction, keys: string[]): void {
		const shortcuts = persistedShortcutSettings.current.shortcuts.map((s) =>
			s.action === action ? { ...s, keys } : s,
		);
		this._updateShortcuts(shortcuts);
	}

	resetShortcut(action: ShortcutAction): void {
		const defaultShortcut = DEFAULT_SHORTCUTS.find((s) => s.action === action);
		if (!defaultShortcut) return;

		const shortcuts = persistedShortcutSettings.current.shortcuts.map((s) =>
			s.action === action ? { ...s, keys: Array.from(defaultShortcut.keys) } : s,
		);
		persistedShortcutSettings.current = { ...persistedShortcutSettings.current, shortcuts };
	}

	resetAllShortcuts(): void {
		persistedShortcutSettings.current = getDefaults();
	}
}

export const shortcutSettings = new ShortcutSettingsManager();

// Sync shortcuts to main process when they change
if (typeof window !== "undefined" && window.electronAPI) {
	$effect.root(() => {
		$effect(() => {
			const state = persistedShortcutSettings.current;
			const serializableShortcuts = state.shortcuts.map((s) => ({
				id: s.id,
				action: s.action,
				keys: [...s.keys],
				scope: s.scope,
				order: s.order,
			}));
			window.electronAPI.shortcutService.updateShortcuts(serializableShortcuts).catch((err) => {
				console.error("Failed to sync shortcuts:", err);
			});
		});
	});
}
