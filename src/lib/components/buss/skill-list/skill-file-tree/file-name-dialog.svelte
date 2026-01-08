<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import Input from "$lib/components/ui/input/input.svelte";
	import { m } from "$lib/paraglide/messages";

	type DialogMode = "create-file" | "create-folder" | "rename";

	interface Props {
		open: boolean;
		mode: DialogMode;
		initialValue?: string;
		onConfirm: (name: string) => void;
		onCancel: () => void;
	}

	let { open = $bindable(), mode, initialValue = "", onConfirm, onCancel }: Props = $props();

	let inputValue = $state("");
	let error = $state("");
	let prevOpen = $state(false);

	// 检测 open 从 false 变为 true 的时刻
	$effect(() => {
		if (open && !prevOpen) {
			// 刚打开，重置输入
			inputValue = initialValue;
			error = "";
		}
		prevOpen = open;
	});

	const title = $derived(() => {
		switch (mode) {
			case "create-file":
				return m.file_tree_new_file_title();
			case "create-folder":
				return m.file_tree_new_folder_title();
			case "rename":
				return m.file_tree_rename_title();
		}
	});

	function validate(value: string): string {
		if (!value.trim()) {
			return m.file_tree_name_required();
		}
		// Check for invalid characters (Windows reserved chars + control chars U+0000-U+001F)
		// eslint-disable-next-line no-control-regex
		const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
		if (invalidChars.test(value)) {
			return m.file_tree_name_invalid();
		}
		return "";
	}

	function handleConfirm() {
		const validationError = validate(inputValue);
		if (validationError) {
			error = validationError;
			return;
		}
		onConfirm(inputValue.trim());
		open = false;
	}

	function handleCancel() {
		onCancel();
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			handleConfirm();
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-[400px]">
		<Dialog.Header>
			<Dialog.Title>{title()}</Dialog.Title>
		</Dialog.Header>
		<div class="py-4">
			<Input
				bind:value={inputValue}
				placeholder={m.file_tree_name_placeholder()}
				onkeydown={handleKeydown}
				class={error ? "border-destructive" : ""}
			/>
			{#if error}
				<p class="mt-2 text-sm text-destructive">{error}</p>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={handleCancel}>
				{m.common_cancel()}
			</Button>
			<Button onclick={handleConfirm}>
				{m.text_button_confirm()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
