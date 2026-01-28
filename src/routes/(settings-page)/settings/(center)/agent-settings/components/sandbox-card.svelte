<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { Loader2 } from "@lucide/svelte";
	import PlatformServiceCard from "./platform-service-card.svelte";
	import StatusIndicator from "./status-indicator.svelte";

	let { isOpen = $bindable(true) }: { isOpen?: boolean } = $props();

	// Sandbox Logic
	let sandboxRunning = $state(false);
	let isSandboxLoading = $state(false); // Loading state
	let fileDirectory = $state("/home/<username>/ai302");

	function handleStartSandbox() {
		if (!sandboxRunning) {
			isSandboxLoading = true;
			// Simulate start
			setTimeout(() => {
				sandboxRunning = true;
				isSandboxLoading = false;
			}, 2000);
		} else {
			sandboxRunning = false;
		}
	}

	function handleOpenDirectory() {
		console.log("Opening directory:", fileDirectory);
		// Logic to open folder would go here via Electron IPC
	}
</script>

<PlatformServiceCard title={m.local_platform_local_sandbox()} bind:isOpen>
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 space-y-2">
			<!-- Startup Status -->
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-16 font-normal"
					>{m.local_platform_startup_status()}</Label
				>
				<StatusIndicator
					status={sandboxRunning ? "green" : "gray"}
					text={sandboxRunning ? m.local_platform_started() : m.local_platform_not_started()}
				/>
			</div>
			<!-- Health Status -->
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-16 font-normal"
					>{m.local_platform_health_status()}</Label
				>
				<StatusIndicator
					status={sandboxRunning ? "green" : "red"}
					text={sandboxRunning ? m.local_platform_healthy() : m.local_platform_unhealthy()}
					showWarning={!sandboxRunning}
					warningTooltip={m.local_platform_try_restart()}
				/>
			</div>
			<!-- File Directory -->
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-16 font-normal"
					>{m.local_platform_file_directory()}</Label
				>
				<button
					class="text-sm font-mono hover:underline cursor-pointer focus:outline-none"
					onclick={handleOpenDirectory}
					aria-label={m.local_platform_open_folder()}
				>
					{fileDirectory}
				</button>
			</div>
		</div>
		<Button
			size="sm"
			variant={sandboxRunning ? "destructive" : "default"}
			onclick={handleStartSandbox}
			disabled={isSandboxLoading}
		>
			{#if isSandboxLoading}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{m.local_platform_starting()}
			{:else}
				{sandboxRunning ? m.local_platform_close() : m.local_platform_one_click_start()}
			{/if}
		</Button>
	</div>
</PlatformServiceCard>
