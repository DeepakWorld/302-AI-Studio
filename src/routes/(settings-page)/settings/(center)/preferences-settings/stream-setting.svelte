<script lang="ts">
	import { SegButton, SettingSwitchItem } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import {
		preferencesSettings,
		type StreamSpeed,
	} from "$lib/stores/preferences-settings.state.svelte";
	import { Rabbit, Timer, Zap } from "@lucide/svelte";

	const speedOptions = [
		{
			key: "slow",
			label: m.settings_slow(),
			icon: Rabbit,
			iconSize: 16,
		},
		{
			key: "normal",
			label: m.settings_normal(),
			icon: Timer,
			iconSize: 16,
		},
		{
			key: "fast",
			label: m.settings_fast(),
			icon: Zap,
			iconSize: 16,
		},
	];

	function handleSelect(key: string) {
		preferencesSettings.setStreamSpeed(key as StreamSpeed);
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<div class="space-y-2">
		<Label class="text-label-fg font-normal">{m.settings_streamOutputLabel()}</Label>
		<SettingSwitchItem
			label={m.settings_streamOutputEnable()}
			checked={preferencesSettings.streamOutputEnabled}
			onCheckedChange={(v) => preferencesSettings.setStreamOutputEnabled(v)}
		/>
	</div>
	{#if preferencesSettings.streamOutputEnabled}
		<div class="space-y-2">
			<Label class="text-label-fg font-normal">{m.settings_streamOutputSpeed()}</Label>
			<SegButton
				options={speedOptions}
				selectedKey={preferencesSettings.streamSpeed}
				onSelect={handleSelect}
			/>
		</div>
	{/if}
</div>
