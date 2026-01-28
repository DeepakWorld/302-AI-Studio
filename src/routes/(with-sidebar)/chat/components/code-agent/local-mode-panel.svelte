<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { onMount, onDestroy } from "svelte";
	import AgentWorkspaceConfig from "../../../../(settings-page)/settings/(center)/agent-settings/components/agent-workspace-config.svelte";
	import PodmanCard from "../../../../(settings-page)/settings/(center)/agent-settings/components/podman-card.svelte";
	import SandboxCard from "../../../../(settings-page)/settings/(center)/agent-settings/components/sandbox-card.svelte";

	let { onClose }: { onClose?: () => void } = $props();

	let isLoading = $state(false);

	onMount(async () => {
		// Start listening to broadcast channels
		localEnvState.startListening();

		// Refresh Podman installation status
		await localEnvState.refreshPodmanStatus();

		// Start health check if Podman is installed
		await localEnvState.ensurePodmanHealthCheckStarted();
	});

	onDestroy(() => {
		// Stop listening to broadcast channels to avoid memory leaks
		localEnvState.stopListening();
	});

	async function handleConfirm() {
		isLoading = true;
		try {
			// TODO: Add business logic here (install podman, start sandbox, etc.)
			// Mock delay for now
			await new Promise((resolve) => setTimeout(resolve, 500));
			closePanel();
		} finally {
			isLoading = false;
		}
	}

	function handleCancel() {
		closePanel();
	}

	function closePanel() {
		onClose?.();
	}

	async function handleInstall() {
		await localEnvState.installPodman();
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<!-- Section 1: Environment Monitoring -->
	<section class="space-y-4">
		<Label class="text-label-fg font-normal">{m.local_platform_environment_monitoring()}</Label>

		<!-- Environment Cards Container -->
		<div class="rounded-lg border p-4 space-y-4">
			<PodmanCard isOpen={false} onInstall={handleInstall} />
			<SandboxCard isOpen={false} />
		</div>
	</section>

	<!-- Section 2: Agent Framework -->
	<section class="space-y-4 mt-2">
		<AgentWorkspaceConfig />
	</section>

	<!-- Footer with Cancel/Confirm buttons -->
	<div class="flex flex-row justify-between">
		<Button variant="secondary" onclick={handleCancel} disabled={isLoading}>
			{m.common_cancel()}
		</Button>
		<Button onclick={handleConfirm} disabled={isLoading}>
			{#if isLoading}
				<LdrsLoader type="line-spinner" size={16} />
			{:else}
				{m.label_button_confirm()}
			{/if}
		</Button>
	</div>
</div>
