<script lang="ts">
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import PodmanCard from "./components/podman-card.svelte";
	import SandboxCard from "./components/sandbox-card.svelte";
</script>

<div class="gap-settings-gap flex flex-col">
	<!-- Section 1: Environment Monitoring -->
	<section class="space-y-4">
		<Label class="text-label-fg font-normal">{m.local_platform_environment_monitoring()}</Label>

		<!-- Environment Cards Container -->
		<div class="rounded-lg border p-4 space-y-4">
			<PodmanCard />
			<SandboxCard />
		</div>
	</section>

	<!-- Section 2: Agent Framework (Hidden in settings mode) -->
	<!-- <section class="space-y-4 mt-2">
		<AgentWorkspaceConfig mode="settings" />
	</section> -->
</div>
