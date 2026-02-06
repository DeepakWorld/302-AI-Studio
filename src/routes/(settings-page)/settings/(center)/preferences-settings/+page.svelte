<script lang="ts">
	import ChatSettings from "./chat-settings.svelte";
	import ContextCompressionSettings from "./context-compression-settings.svelte";
	import EnableSupermarket from "./enable-supermarket.svelte";
	import NewSessionModel from "./new-session-model.svelte";
	import ParseUrl from "./parse-url.svelte";
	import PrivacyMode from "./privacy-mode.svelte";
	import SearchSettings from "./search-output.svelte";
	import StreamSetting from "./stream-setting.svelte";
	import SuggestionsSettings from "./suggestions-settings.svelte";
	import TitleGenerationModel from "./title-generation-model.svelte";
	import TitleGenerationTiming from "./title-generation-timing.svelte";
</script>

<div class="flex flex-col gap-settings-section-gap pb-settings-layout-pb">
	<ChatSettings />
	<NewSessionModel />
	<TitleGenerationModel />
	<TitleGenerationTiming />
	<EnableSupermarket />
	<SearchSettings />
	<ParseUrl />
	<PrivacyMode />
	<SuggestionsSettings />
	<ContextCompressionSettings />
	<StreamSetting />
</div>
