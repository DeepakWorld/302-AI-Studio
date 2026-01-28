<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
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

	// Local UI state for log dialog
	let isPodmanLogOpen = $state(false);

	// Derived state from localEnvState
	let podmanInstalled = $derived(localEnvState.podmanInstalled);
	let podmanHealth = $derived(localEnvState.podmanHealth);
	let isPodmanInstalling = $derived(localEnvState.installing);
	let installFailed = $derived(localEnvState.installFailed);
	let installLogs = $derived(localEnvState.installLogs);

	// Format logs for display
	let formattedLogs = $derived(
		installLogs.map((log) => {
			const prefix =
				log.type === "error"
					? "[ERROR]"
					: log.type === "stderr"
						? "[WARN]"
						: log.type === "complete"
							? "[DONE]"
							: "[INFO]";
			return `${prefix} [${log.step}] ${log.data}`;
		}),
	);

	// Determine health status indicator
	let healthStatus = $derived.by((): "red" | "gray" | "green" => {
		if (!podmanInstalled) return "gray";
		if (podmanHealth === "healthy") return "green";
		if (podmanHealth === "unhealthy") return "red";
		return "gray"; // unknown
	});

	let healthText = $derived.by(() => {
		if (!podmanInstalled) return m.local_platform_unhealthy();
		if (podmanHealth === "healthy") return m.local_platform_healthy();
		if (podmanHealth === "unhealthy") return m.local_platform_unhealthy();
		return m.local_platform_checking();
	});

	// Primary button label logic
	let primaryButtonLabel = $derived.by(() => {
		if (isPodmanInstalling) return m.local_platform_installing();
		if (installFailed) return m.local_platform_reinstall();
		return m.code_agent_one_click_install();
	});

	// Log button should be visible when: not installed AND (has logs OR installing OR failed)
	let showLogButton = $derived(
		!podmanInstalled && (installLogs.length > 0 || isPodmanInstalling || installFailed),
	);

	async function handleInstallPodman() {
		// Call parent's install handler if provided
		if (onInstall) {
			await onInstall();
		}
	}

	function handleOpenLogs() {
		isPodmanLogOpen = true;
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
					status={healthStatus}
					text={healthText}
					showWarning={podmanInstalled && podmanHealth === "unhealthy"}
					warningTooltip={m.local_platform_try_restart()}
				/>
			</div>
		</div>
		<div class="flex gap-2">
			{#if showLogButton}
				<Button size="sm" variant="outline" onclick={handleOpenLogs} class="min-w-[60px]">
					{m.local_platform_logs()}
				</Button>
			{/if}
			{#if !podmanInstalled}
				<Button
					size="sm"
					onclick={handleInstallPodman}
					disabled={isPodmanInstalling}
					class="min-w-[80px]"
				>
					{#if isPodmanInstalling}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					{primaryButtonLabel}
				</Button>
			{/if}
		</div>
	</div>
</PlatformServiceCard>

<!-- Log Dialog -->
<LogDialog
	bind:open={isPodmanLogOpen}
	title={m.local_platform_podman_logs()}
	logs={formattedLogs}
/>
