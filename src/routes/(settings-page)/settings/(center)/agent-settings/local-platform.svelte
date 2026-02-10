<script lang="ts">
	import PodmanCard from "$lib/components/buss/local-agent-panel/podman-card.svelte";
	import SandboxCard from "$lib/components/buss/local-agent-panel/sandbox-card.svelte";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { onMount } from "svelte";

	async function handleInstall() {
		await localEnvState.installPodman();
	}

	// Start listening for Podman events including WSL restart notifications
	onMount(() => {
		localEnvState.startPodmanListening();
	});
</script>

<div class="gap-settings-gap flex flex-col">
	<!-- Section 1: Environment Monitoring -->
	<section class="space-y-4">
		<Label class="text-label-fg font-normal">{m.local_platform_environment_monitoring()}</Label>

		<!-- Environment Cards Container -->
		<div class="rounded-lg border p-4 space-y-4">
			<PodmanCard isOpen={false} onInstall={handleInstall} />
			<SandboxCard />
		</div>
	</section>

	<!-- Section 2: Agent Framework (Hidden in settings mode) -->
	<!-- <section class="space-y-4 mt-2">
		<AgentWorkspaceConfig mode="settings" />
	</section> -->
</div>
