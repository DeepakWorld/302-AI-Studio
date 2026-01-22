import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { type CodeAgentGlobalConfigs } from "@shared/storage/code-agent";
import { persistedProviderState } from "../provider-state.svelte";

function getInitialData() {
	const initialData = {
		apiKey: "",
		autoDeploy: true,
		notificationsEnabled: false,
	};
	return initialData;
}

export const persistedCodeAgentGlobalConfigsState = new PersistedState<CodeAgentGlobalConfigs>(
	"CodeAgentStorage:code-agent-global-configs",
	getInitialData(),
);

class CodeAgentGlobalConfigsState {
	apiKey = $derived(persistedCodeAgentGlobalConfigsState.current?.apiKey ?? "");
	autoDeploy = $derived(persistedCodeAgentGlobalConfigsState.current?.autoDeploy ?? true);
	notificationsEnabled = $derived(
		persistedCodeAgentGlobalConfigsState.current?.notificationsEnabled ?? false,
	);

	constructor() {
		$effect.root(() => {
			$effect(() => {
				if (
					persistedCodeAgentGlobalConfigsState.isHydrated &&
					persistedProviderState.isHydrated &&
					!persistedCodeAgentGlobalConfigsState.current?.apiKey
				) {
					const defaultKey = this.getDefaultApiKey();
					if (defaultKey) {
						this.updateApiKey(defaultKey);
					}
				}
			});
		});
	}

	#updateState(partial: Partial<CodeAgentGlobalConfigs>): void {
		persistedCodeAgentGlobalConfigsState.current = {
			...(persistedCodeAgentGlobalConfigsState.current ?? getInitialData()),
			...partial,
		};
	}

	getDefaultApiKey() {
		const _302AIProvider = persistedProviderState.current?.find((p) => p.apiType === "302ai");
		return _302AIProvider?.apiKey ?? "";
	}

	updateApiKey(apiKey: string) {
		this.#updateState({ apiKey });
	}

	resetApiKey() {
		this.#updateState({ apiKey: this.getDefaultApiKey() });
	}

	toggleAutoDeploy() {
		this.#updateState({ autoDeploy: !this.autoDeploy });
	}

	async toggleNotificationsEnabled() {
		const newState = !this.notificationsEnabled;
		if (newState) {
			const permission = await Notification.requestPermission();
			if (permission === "granted") {
				this.#updateState({ notificationsEnabled: true });
			} else {
				// permission denied or default
				this.#updateState({ notificationsEnabled: false });
			}
		} else {
			this.#updateState({ notificationsEnabled: false });
		}
	}
}

export const codeAgentGlobalConfigsState = new CodeAgentGlobalConfigsState();
