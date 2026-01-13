<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Textarea } from "$lib/components/ui/textarea";
	import * as m from "$lib/paraglide/messages";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { cn } from "$lib/utils.js";
	import { generateFilePreview, MAX_ATTACHMENT_COUNT } from "$lib/utils/file-preview";
	import { X } from "@lucide/svelte";
	import type { AttachmentFile, Task } from "@shared/types";
	import { nanoid } from "nanoid";
	import { toast } from "svelte-sonner";

	let inputValue = $state("");
	let attachments = $state<AttachmentFile[]>([]);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	function handleAdd() {
		if (inputValue.trim() || attachments.length > 0) {
			if (inputValue.trim()) {
				const newTask: Task = {
					id: nanoid(),
					content: inputValue.trim(),
					status: "pending",
				};
				const updatedTasklist = [...codeAgentTaskboardState.tasklist, newTask];
				codeAgentTaskboardState.updateTasklist(updatedTasklist);
			}
			inputValue = "";
			attachments = [];
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleAdd();
		}
	}

	function handleAttachmentClick() {
		fileInputRef?.click();
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = input.files;
		if (!files) return;

		await processFiles(Array.from(files));
		input.value = "";
	}

	async function processFiles(files: File[]) {
		for (const file of files) {
			if (attachments.length >= MAX_ATTACHMENT_COUNT) {
				toast.warning(`已达到最大附件数量：${MAX_ATTACHMENT_COUNT}`);
				break;
			}

			const attachmentId = nanoid();
			const filePath = (file as File & { path?: string }).path || file.name;

			const attachment: AttachmentFile = {
				id: attachmentId,
				name: file.name || `file-${Date.now()}`,
				type: file.type,
				size: file.size,
				file,
				preview: undefined,
				filePath,
			};

			attachments = [...attachments, attachment];

			generateFilePreview(file).then((preview) => {
				attachments = attachments.map((a) => (a.id === attachmentId ? { ...a, preview } : a));
			});
		}
	}

	async function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		const files: File[] = [];
		for (const item of Array.from(items)) {
			if (item.kind === "file") {
				const file = item.getAsFile();
				if (file) files.push(file);
			}
		}

		if (files.length === 0) return;
		event.preventDefault();
		await processFiles(files);
	}

	function removeAttachment(id: string) {
		attachments = attachments.filter((a) => a.id !== id);
	}
</script>

<div class="p-3 pb-1">
	<!-- Attachment previews above input -->
	{#if attachments.length > 0}
		<div class="flex flex-wrap gap-2 mb-2">
			{#each attachments as attachment (attachment.id)}
				<div class="relative group">
					{#if attachment.preview}
						<img
							src={attachment.preview}
							alt={attachment.name}
							class="size-12 rounded object-cover border"
						/>
					{:else}
						<div
							class="size-12 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground"
						>
							{attachment.name.split(".").pop()?.toUpperCase() || "FILE"}
						</div>
					{/if}
					<button
						class="absolute -top-1 -right-1 size-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
						onclick={() => removeAttachment(attachment.id)}
					>
						<X class="size-3" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Input box -->
	<div
		class={cn(
			"flex flex-col rounded-xl border p-3 pb-0",
			"focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
			"bg-input",
		)}
	>
		<!-- Text input area -->
		<div class="min-h-0 flex-1">
			<Textarea
				bind:ref={textareaRef}
				class={cn(
					"w-full min-h-[36px] max-h-[120px] resize-none p-0",
					"border-none shadow-none focus-within:ring-0 focus-within:outline-hidden focus-visible:ring-0",
				)}
				placeholder={m.taskboard_input_placeholder()}
				bind:value={inputValue}
				onkeydown={handleKeydown}
				onpaste={handlePaste}
			/>
		</div>

		<input
			type="file"
			multiple
			class="hidden"
			bind:this={fileInputRef}
			onchange={handleFileSelect}
		/>

		<!-- Bottom action bar -->
		<div class="mt-2 flex items-center justify-between">
			<!-- Left: Attachment button -->
			<button
				type="button"
				class="size-9 rounded-[10px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
				onclick={handleAttachmentClick}
			>
				<!-- <Paperclip class="size-4" /> -->
			</button>

			<!-- Right: Add button -->
			<Button variant="default" size="sm" onclick={handleAdd}>
				{m.taskboard_button_add()}
			</Button>
		</div>
	</div>
</div>
