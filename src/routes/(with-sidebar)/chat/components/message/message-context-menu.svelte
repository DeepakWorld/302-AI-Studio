<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import { m } from "$lib/paraglide/messages";

	import { toast } from "svelte-sonner";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";

	interface Props {
		onCopy?: () => void | Promise<void>;
		onCopyImage?: (src: string) => void | Promise<void>;
		onEdit?: () => void | Promise<void>;
		onRegenerate?: () => void | Promise<void>;
		onCreateBranch?: () => void | Promise<void>;
		onDelete?: () => void | Promise<void>;
		onDownloadImage?: (src: string) => void | Promise<void>;
		onExport?: () => void | Promise<void>;
		children: import("svelte").Snippet;
	}

	let {
		onCopy,
		onCopyImage,
		onEdit,
		onRegenerate,
		onCreateBranch,
		onDelete,
		onDownloadImage,
		onExport,
		children,
	}: Props = $props();

	let clickedImageSrc = $state<string | null>(null);
	let selectedText = $state<string | null>(null);

	function handleContextMenu(event: MouseEvent) {
		// Check if right-click target is an image or has an image ancestor
		const target = event.target as HTMLElement;
		const imgElement = target.closest("img") as HTMLImageElement | null;

		if (imgElement && imgElement.src) {
			clickedImageSrc = imgElement.src;
		} else {
			clickedImageSrc = null;
		}

		// Check for text selection
		const selection = window.getSelection();
		if (selection && selection.toString().trim().length > 0) {
			selectedText = selection.toString();
		} else {
			selectedText = null;
		}
	}

	function handleDownloadImage() {
		if (clickedImageSrc && onDownloadImage) {
			onDownloadImage(clickedImageSrc);
		}
	}

	function handleCopy() {
		if (clickedImageSrc && onCopyImage) {
			onCopyImage(clickedImageSrc);
		} else if (onCopy) {
			onCopy();
		}
	}

	async function handleCopySelection() {
		if (selectedText) {
			try {
				await navigator.clipboard.writeText(selectedText);
				toast.success(m.toast_copied_success());
			} catch {
				toast.error(m.toast_copied_failed());
			}
		}
	}
</script>

<ContextMenu.Root>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div oncontextmenu={handleContextMenu}>
		<ContextMenu.Trigger>
			{@render children()}
		</ContextMenu.Trigger>
	</div>

	<ContextMenu.Content>
		{#if selectedText}
			<ContextMenu.Item onSelect={handleCopySelection}>
				{m.context_menu_copy_selection()}
			</ContextMenu.Item>
			<ContextMenu.Separator />
		{/if}

		{#if clickedImageSrc && onDownloadImage}
			<ContextMenu.Item onSelect={handleDownloadImage}>
				{m.context_menu_download_image()}
			</ContextMenu.Item>
			<ContextMenu.Separator />
		{/if}

		{#if onCopy}
			<ContextMenu.Item onSelect={handleCopy}>
				{m.common_copy()}
			</ContextMenu.Item>
		{/if}

		<ContextMenu.Separator />

		{#if onEdit}
			<ContextMenu.Item onSelect={onEdit}>
				{m.title_edit()}
			</ContextMenu.Item>
		{/if}

		{#if onRegenerate}
			<ContextMenu.Item onSelect={onRegenerate}>
				{m.title_regenerate()}
			</ContextMenu.Item>
		{/if}

		{#if onCreateBranch && !codeAgentState.enabled}
			<ContextMenu.Item onSelect={onCreateBranch}>
				{m.common_create_branch()}
			</ContextMenu.Item>
		{/if}

		{#if onExport}
			<ContextMenu.Item onSelect={onExport}>
				{m.export_button()}
			</ContextMenu.Item>
		{/if}

		{#if onDelete}
			<ContextMenu.Item onSelect={onDelete}>
				{m.text_button_delete()}
			</ContextMenu.Item>
		{/if}
	</ContextMenu.Content>
</ContextMenu.Root>
