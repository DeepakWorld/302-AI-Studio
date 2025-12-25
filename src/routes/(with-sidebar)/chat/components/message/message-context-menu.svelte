<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import { m } from "$lib/paraglide/messages";

	interface Props {
		onCopy?: () => void | Promise<void>;
		onCopyImage?: (src: string) => void | Promise<void>;
		onEdit?: () => void | Promise<void>;
		onRegenerate?: () => void | Promise<void>;
		onCreateBranch?: () => void | Promise<void>;
		onDelete?: () => void | Promise<void>;
		onDownloadImage?: (src: string) => void | Promise<void>;
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
		children,
	}: Props = $props();

	let clickedImageSrc = $state<string | null>(null);

	function handleContextMenu(event: MouseEvent) {
		// Check if right-click target is an image or has an image ancestor
		const target = event.target as HTMLElement;
		const imgElement = target.closest("img") as HTMLImageElement | null;

		if (imgElement && imgElement.src) {
			clickedImageSrc = imgElement.src;
		} else {
			clickedImageSrc = null;
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
</script>

<ContextMenu.Root>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div oncontextmenu={handleContextMenu}>
		<ContextMenu.Trigger>
			{@render children()}
		</ContextMenu.Trigger>
	</div>

	<ContextMenu.Content>
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

		{#if onCreateBranch}
			<ContextMenu.Item onSelect={onCreateBranch}>
				{m.common_create_branch()}
			</ContextMenu.Item>
		{/if}

		{#if onDelete}
			<ContextMenu.Item onSelect={onDelete}>
				{m.text_button_delete()}
			</ContextMenu.Item>
		{/if}
	</ContextMenu.Content>
</ContextMenu.Root>
