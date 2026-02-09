<script lang="ts">
	import { SettingSelectItem, SettingSwitchItem } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";

	const limitOptions = [
		{ value: "10", label: "10" },
		{ value: "15", label: "15" },
		{ value: "20", label: "20" },
		{ value: "30", label: "30" },
		{ value: "50", label: "50" },
	];

	function handleLimitChange(value: string) {
		const limit = parseInt(value);
		if (!isNaN(limit)) {
			preferencesSettings.setContextCompressionLimit(limit);
		}
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg font-normal">{m.settings_contextCompression()}</Label>
	<SettingSwitchItem
		label={m.settings_contextCompressionEnable()}
		checked={preferencesSettings.contextCompressionEnabled}
		onCheckedChange={(v) => preferencesSettings.setContextCompressionEnabled(v)}
	/>
	{#if preferencesSettings.contextCompressionEnabled}
		<SettingSelectItem
			label={m.settings_contextCompressionLimit()}
			description={m.settings_contextCompressionLimitDesc()}
			options={limitOptions}
			value={String(preferencesSettings.contextCompressionLimit)}
			onValueChange={handleLimitChange}
		/>
	{/if}
</div>
