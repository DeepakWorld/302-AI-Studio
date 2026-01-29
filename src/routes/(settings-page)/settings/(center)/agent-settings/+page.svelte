<script lang="ts">
	import UnsupportPanel from "$lib/components/buss/local-agent-panel/unsupport-panel.svelte";
	import { SettingSwitchItem } from "$lib/components/buss/settings";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentGlobalConfigsState } from "$lib/stores/code-agent/code-agent-global-configs-state.svelte";
	import { isMac } from "$lib/utils/platform";
	import LocalPlatform from "./local-platform.svelte";
	import RemotePlatform from "./remote-platform.svelte";

	import DeployedWebsitesList from "./deployed-websites-list.svelte";

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

<div class="mx-auto flex h-full w-full max-w-3xl flex-col gap-6">
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
		<SettingSwitchItem
			label={m.auto_deploy()}
			checked={codeAgentGlobalConfigsState.autoDeploy}
			onCheckedChange={() => codeAgentGlobalConfigsState.toggleAutoDeploy()}
		/>
		<SettingSwitchItem
			label={m.settings_notificationsEnabled()}
			checked={codeAgentGlobalConfigsState.notificationsEnabled}
			onCheckedChange={() => codeAgentGlobalConfigsState.toggleNotificationsEnabled()}
		/>
		<DeployedWebsitesList />
		<RemotePlatform />
	{:else if selectedPlatform === "local"}
		{#if isMac}
			<LocalPlatform />
		{:else}
			<UnsupportPanel />
		{/if}
	{/if}
</div>
