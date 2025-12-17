<script lang="ts">
	import { SettingSelectItem, SettingSwitchItem } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";

	const suggestionsCountOptions = [
		{ value: "1", label: "1" },
		{ value: "2", label: "2" },
		{ value: "3", label: "3" },
		{ value: "4", label: "4" },
		{ value: "5", label: "5" },
	];

	function handleCountChange(value: string) {
		const count = parseInt(value);
		if (!isNaN(count)) {
			preferencesSettings.setSuggestionsCount(count);
		}
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_suggestions()}</Label>
	<SettingSwitchItem
		label={m.settings_suggestionsEnable()}
		checked={preferencesSettings.suggestionsEnabled}
		onCheckedChange={(v) => preferencesSettings.setSuggestionsEnabled(v)}
	/>
	{#if preferencesSettings.suggestionsEnabled}
		<SettingSelectItem
			label={m.settings_suggestionsCount()}
			options={suggestionsCountOptions}
			value={String(preferencesSettings.suggestionsCount)}
			onValueChange={handleCountChange}
		/>
		<SettingSwitchItem
			label={m.settings_showOnlyLastSuggestion()}
			checked={preferencesSettings.showOnlyLastSuggestion}
			onCheckedChange={(v) => preferencesSettings.setShowOnlyLastSuggestion(v)}
		/>
	{/if}
</div>
