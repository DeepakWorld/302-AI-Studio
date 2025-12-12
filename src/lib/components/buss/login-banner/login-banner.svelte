<script lang="ts">
	import type { SsoApikeyDialogAction } from "$lib/components/buss/sso-apikey-dialog";
	import { SsoApikeyDialog } from "$lib/components/buss/sso-apikey-dialog";
	import { Button } from "$lib/components/ui/button";
	import { PersistedState } from "$lib/hooks/persisted-state.svelte";
	import { m } from "$lib/paraglide/messages.js";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { ssoState } from "$lib/stores/sso-state.svelte";
	import { userState } from "$lib/stores/user-state.svelte";
	import { Loader, X, Zap } from "@lucide/svelte";

	// Persisted state to remember if user dismissed the banner
	const bannerDismissed = new PersistedState<boolean>("login-banner-dismissed", false);

	// Check if any providers are properly configured with API keys
	const hasConfiguredProviders = $derived(() => {
		return persistedProviderState.current.some(
			(provider) => provider.enabled && provider.apiKey && provider.apiKey.trim() !== "",
		);
	});

	// Show banner when: no configured providers, user not logged in, and banner not dismissed
	const showBanner = $derived(
		!hasConfiguredProviders() && !userState.isLoggedIn && !bannerDismissed.current,
	);

	function handleDismiss() {
		bannerDismissed.current = true;
	}

	function handleApiKeyDialogSelect(action: SsoApikeyDialogAction) {
		ssoState.handleApiKeyConflict(action);
	}
</script>

{#if showBanner}
	<div
		class="flex shrink-0 items-center justify-center gap-4 bg-primary px-4 py-2 text-primary-foreground shadow-md"
	>
		<div class="flex items-center gap-2">
			<Zap class="size-4" />
			<span class="text-sm font-medium">{m.login_banner_text()}</span>
		</div>

		<div class="flex items-center gap-2">
			<Button
				variant="secondary"
				size="sm"
				class="h-7 px-3 text-xs"
				onclick={() => ssoState.login()}
				disabled={ssoState.isLoading}
			>
				{#if ssoState.isLoading}
					<Loader class="mr-1 size-3 animate-spin" />
				{/if}
				{m.login_banner_button()}
			</Button>

			<Button
				variant="ghost"
				size="icon"
				class="size-7 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
				onclick={handleDismiss}
			>
				<X class="size-4" />
			</Button>
		</div>
	</div>
{/if}

<!-- SSO API Key Conflict Dialog -->
<SsoApikeyDialog
	bind:open={ssoState.showApiKeyConflictDialog}
	onSelect={handleApiKeyDialogSelect}
/>
