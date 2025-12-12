<script lang="ts" module>
	export type SsoApikeyDialogAction = "override" | "keep" | "backup";
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { m } from "$lib/paraglide/messages.js";

	interface Props {
		open: boolean;
		onSelect: (action: SsoApikeyDialogAction) => void;
	}

	let { open = $bindable(), onSelect }: Props = $props();

	function handleSelect(action: SsoApikeyDialogAction) {
		open = false;
		onSelect(action);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md" showCloseButton={false} interactOutsideBehavior="ignore">
		<Dialog.Header>
			<Dialog.Title>{m.sso_apikey_dialog_title()}</Dialog.Title>
			<Dialog.Description class="pt-2">
				{m.sso_apikey_dialog_description()}
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-3 pt-4">
			<Button
				variant="outline"
				class="border-primary text-primary hover:bg-primary/10 h-auto justify-center py-3"
				onclick={() => handleSelect("override")}
			>
				{m.sso_apikey_dialog_override()}
			</Button>

			<Button
				variant="outline"
				class="h-auto justify-center py-3"
				onclick={() => handleSelect("keep")}
			>
				{m.sso_apikey_dialog_keep()}
			</Button>

			<Button
				variant="outline"
				class="h-auto justify-center py-3"
				onclick={() => handleSelect("backup")}
			>
				{m.sso_apikey_dialog_backup()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
