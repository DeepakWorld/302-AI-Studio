<script lang="ts">
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import { m } from "$lib/paraglide/messages";
	import LocalPlatform from "./local-platform.svelte";
	import RemotePlatform from "./remote-platform.svelte";

	const platformOptions = [
		{
			key: "remote",
			label: m.title_remote(),
		},
		{
			key: "local",
			label: m.title_local(),
		},
	];

	let selectedPlatform = $state("remote");

	function handlePlatformSelect(key: string) {
		selectedPlatform = key;
	}
</script>

<div class="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 p-6">
	<!-- Platform Section -->
	<div class="space-y-2">
		<h2 class="text-sm font-medium text-muted-foreground">{m.title_agent_platform()}</h2>
		<SegButton
			options={platformOptions}
			selectedKey={selectedPlatform}
			onSelect={handlePlatformSelect}
		/>
	</div>

	{#if selectedPlatform === "remote"}
		<RemotePlatform />
	{:else if selectedPlatform === "local"}
		<LocalPlatform />
	{/if}
</div>
