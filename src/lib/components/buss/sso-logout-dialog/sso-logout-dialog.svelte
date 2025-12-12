<script lang="ts" module>
	import type { SsoLogoutOptions } from "./index";

	export interface Props {
		open: boolean;
		userEmail: string;
		onConfirm: (options: SsoLogoutOptions) => void;
		onClose: () => void;
	}
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Checkbox } from "$lib/components/ui/checkbox/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";

	let { open = $bindable(), userEmail, onConfirm, onClose }: Props = $props();

	let unlinkApiKey = $state(false);
	let clearSessions = $state(false);
	let clearMcpServers = $state(false);

	function handleConfirm() {
		onConfirm({
			unlinkApiKey,
			clearSessions,
			clearMcpServers,
		});
	}

	function handleClose() {
		// Reset options
		unlinkApiKey = false;
		clearSessions = false;
		clearMcpServers = false;
		onClose();
	}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<Dialog.Content data-logout-dialog showCloseButton={false} interactOutsideBehavior="ignore">
		<Dialog.Header>
			<Dialog.Title>{m.sso_logout_dialog_title()}</Dialog.Title>
			<Dialog.Description>
				{m.sso_logout_dialog_description()}
			</Dialog.Description>
		</Dialog.Header>

		<div class="py-4">
			<!-- User email display -->
			<div class="bg-muted mb-4 rounded-md px-3 py-2 text-center">
				<span class="text-muted-foreground text-sm">{userEmail}</span>
			</div>

			<!-- Options -->
			<div class="flex flex-col gap-3">
				<div class="flex items-center space-x-2">
					<Checkbox id="unlink-apikey" bind:checked={unlinkApiKey} />
					<Label for="unlink-apikey" class="cursor-pointer text-sm font-normal">
						{m.sso_logout_option_unlink_apikey()}
					</Label>
				</div>

				<div class="flex items-center space-x-2">
					<Checkbox id="clear-sessions" bind:checked={clearSessions} />
					<Label for="clear-sessions" class="cursor-pointer text-sm font-normal">
						{m.sso_logout_option_clear_sessions()}
					</Label>
				</div>

				<div class="flex items-center space-x-2">
					<Checkbox id="clear-mcp" bind:checked={clearMcpServers} />
					<Label for="clear-mcp" class="cursor-pointer text-sm font-normal">
						{m.sso_logout_option_clear_mcp()}
					</Label>
				</div>
			</div>
		</div>

		<Dialog.Footer class="flex gap-2 sm:justify-between">
			<Button variant="outline" onclick={handleClose}>
				{m.sso_logout_button_close()}
			</Button>
			<Button variant="destructive" onclick={handleConfirm}>
				{m.sso_logout_button_confirm()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
