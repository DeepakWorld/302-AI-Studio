<script lang="ts">
	import type { SsoApikeyDialogAction } from "$lib/components/buss/sso-apikey-dialog";
	import { SsoApikeyDialog } from "$lib/components/buss/sso-apikey-dialog";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { ssoState } from "$lib/stores/sso-state.svelte";
	import { userState } from "$lib/stores/user-state.svelte";
	import { AlertCircle, ArrowRight, Check, Loader, Zap } from "@lucide/svelte";

	function handleApiKeyDialogSelect(action: SsoApikeyDialogAction) {
		ssoState.handleApiKeyConflict(action);
	}
</script>

{#if !userState.isLoggedIn}
	<div class="gap-settings-gap flex flex-col">
		<Label class="text-label-fg">{m.login_account_management()}</Label>

		<!-- SSO Quick Login Card -->
		<button
			class="bg-settings-item-bg hover:bg-hover-2 group relative flex items-center gap-4 overflow-hidden rounded-xl border border-transparent p-4 text-left transition-all hover:border-border disabled:cursor-not-allowed disabled:opacity-50"
			onclick={() => ssoState.login()}
			disabled={ssoState.isLoading}
		>
			<div
				class="rounded-lg p-2 transition-colors {ssoState.isSuccess
					? 'bg-green-500/10'
					: ssoState.hasError
						? 'bg-destructive/10'
						: 'bg-primary/10 group-hover:bg-primary/20'}"
			>
				{#if ssoState.isLoading}
					<Loader class="size-5 animate-spin text-primary" />
				{:else if ssoState.isSuccess}
					<Check class="size-5 text-green-600" />
				{:else if ssoState.hasError}
					<AlertCircle class="size-5 text-destructive" />
				{:else}
					<Zap class="size-5 text-primary" />
				{/if}
			</div>
			<div class="flex-1">
				<div class="font-medium leading-none">
					{#if ssoState.isLoading}
						{m.sso_logging_in()}
					{:else if ssoState.isSuccess}
						{m.sso_success()}
					{:else if ssoState.hasError}
						{m.sso_retry()}
					{:else}
						{m.sso_login()}
					{/if}
				</div>
				<div class="mt-1 text-xs text-muted-foreground">{m.sso_login_desc()}</div>
			</div>
			{#if !ssoState.isLoading}
				<ArrowRight
					class="size-4 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-50"
				/>
			{/if}
		</button>
	</div>
{/if}

<!-- SSO API Key Conflict Dialog -->
<SsoApikeyDialog
	bind:open={ssoState.showApiKeyConflictDialog}
	onSelect={handleApiKeyDialogSelect}
/>
