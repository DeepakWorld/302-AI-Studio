<script lang="ts">
	import NoSupportIcon from "$lib/assets/icons/code-agent/not-support.svg";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { m } from "$lib/paraglide/messages";

	async function handleInstall() {
		const result = await window.electronAPI.envService.validPodman();
		console.log("Podman check result:", result);
	}
</script>

<Empty.Root>
	<Empty.Content class="h-[200px] flex flex-col gap-4 items-center justify-center">
		<img src={NoSupportIcon} alt="Not supported" />
		<Empty.Description>
			{m.unsupport()}
		</Empty.Description>
		<Button onclick={handleInstall}>{m.code_agent_one_click_install()}</Button>
	</Empty.Content>
</Empty.Root>
