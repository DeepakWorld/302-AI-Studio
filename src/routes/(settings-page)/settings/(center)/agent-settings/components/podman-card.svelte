<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { Loader2 } from "@lucide/svelte";
	import LogDialog from "./log-dialog.svelte";
	import PlatformServiceCard from "./platform-service-card.svelte";
	import StatusIndicator from "./status-indicator.svelte";

	let {
		isOpen = $bindable(true),
		onInstall,
	}: {
		isOpen?: boolean;
		onInstall?: () => Promise<void> | void;
	} = $props();

	// Podman Logic
	let podmanInstalled = $state(false);
	let isPodmanLogOpen = $state(false);
	let isPodmanInstalling = $state(false);

	const podmanLogs = [
		"[INFO] Starting Podman installation...",
		"[INFO] Downloading resources...",
		"[INFO] Verifying system requirements...",
		"[SUCCESS] Podman installed successfully.",
		"[INFO] Service started at port 8888.",
	];

	async function handleInstallPodman() {
		if (!podmanInstalled) {
			isPodmanInstalling = true;
			// Call parent's install handler if provided
			if (onInstall) {
				await onInstall();
			}
			// Simulate installation
			setTimeout(() => {
				podmanInstalled = true;
				isPodmanInstalling = false;
			}, 2000); // 2s visual delay
		} else {
			// Show logs
			isPodmanLogOpen = true;
		}
	}
</script>

<PlatformServiceCard title={m.local_platform_podman()} bind:isOpen>
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 space-y-2">
			<!-- Installation Status -->
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-16 font-normal"
					>{m.local_platform_installation_status()}</Label
				>
				<StatusIndicator
					status={podmanInstalled ? "green" : "gray"}
					text={podmanInstalled ? m.local_platform_installed() : m.local_platform_not_installed()}
				/>
			</div>
			<!-- Health Status -->
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-16 font-normal"
					>{m.local_platform_health_status()}</Label
				>
				<StatusIndicator
					status={podmanInstalled ? "green" : "red"}
					text={podmanInstalled ? m.local_platform_healthy() : m.local_platform_unhealthy()}
					showWarning={!podmanInstalled}
					warningTooltip={m.local_platform_try_restart()}
				/>
			</div>
		</div>
		<Button
			size="sm"
			onclick={handleInstallPodman}
			disabled={isPodmanInstalling}
			class="min-w-[80px]"
		>
			{#if isPodmanInstalling}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{m.local_platform_installing()}
			{:else}
				{podmanInstalled ? m.local_platform_logs() : m.code_agent_one_click_install()}
			{/if}
		</Button>
	</div>
</PlatformServiceCard>

<!-- Log Dialog -->
<LogDialog bind:open={isPodmanLogOpen} title={m.local_platform_podman_logs()} logs={podmanLogs} />
