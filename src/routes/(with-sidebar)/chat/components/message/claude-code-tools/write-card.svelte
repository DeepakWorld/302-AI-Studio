<script lang="ts" module>
	import type { DynamicToolUIPart } from "ai";

	export interface WriteCardProps {
		part: DynamicToolUIPart;
		messageId: string;
		messagePartIndex?: number;
	}
</script>

<script lang="ts">
	import StaticCodeBlock from "$lib/components/buss/markdown/static-code-block.svelte";
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { Ban, Circle, CircleCheck, FilePenLine, LoaderCircle } from "@lucide/svelte";

	let {
		part,
		messageId: _messageId,
		messagePartIndex: _messagePartIndex,
	}: WriteCardProps = $props();

	let isModalOpen = $state(false);

	// Determine if this is Write or Edit
	const isEdit = $derived(part.toolName === "Edit");
	const toolLabel = $derived(isEdit ? `${m.text_edit_file()}` : `${m.text_write_file()}`);

	// Extract file path and content from input
	const filePath = $derived.by((): string => {
		const input = part.input as { file_path?: string } | undefined;
		return input?.file_path ?? "Unknown file";
	});

	const content = $derived.by((): string => {
		const input = part.input as { content?: string; new_string?: string } | undefined;
		// For Write tool, use 'content'; for Edit tool, use 'new_string'
		return input?.content ?? input?.new_string ?? "";
	});

	// Guess language from file extension
	const language = $derived.by((): string | null => {
		const ext = filePath.split(".").pop()?.toLowerCase();
		const langMap: Record<string, string> = {
			ts: "typescript",
			tsx: "tsx",
			js: "javascript",
			jsx: "jsx",
			py: "python",
			rb: "ruby",
			rs: "rust",
			go: "go",
			java: "java",
			kt: "kotlin",
			swift: "swift",
			c: "c",
			cpp: "cpp",
			h: "c",
			hpp: "cpp",
			cs: "csharp",
			php: "php",
			html: "html",
			css: "css",
			scss: "scss",
			less: "less",
			json: "json",
			yaml: "yaml",
			yml: "yaml",
			xml: "xml",
			md: "markdown",
			sql: "sql",
			sh: "bash",
			bash: "bash",
			zsh: "bash",
			ps1: "powershell",
			svelte: "svelte",
			vue: "vue",
		};
		return ext ? (langMap[ext] ?? null) : null;
	});

	const statusConfig = $derived.by(() => {
		switch (part.state) {
			case "output-available":
				return {
					icon: CircleCheck,
					color: "text-[#38B865]",
					bgColor: "bg-[#38B865]",
					label: m.tool_call_status_success(),
					animate: false,
				};
			case "output-error":
				return {
					icon: Ban,
					color: "text-[#D82525]",
					bgColor: "bg-[#D82525]",
					label: m.tool_call_status_error(),
					animate: false,
				};
			case "input-available":
				return {
					icon: LoaderCircle,
					color: "text-[#0056FE]",
					bgColor: "bg-[#0056FE]",
					label: m.tool_call_status_executing(),
					animate: true,
				};
			case "input-streaming":
				return {
					icon: Circle,
					color: "text-[#0056FE]",
					bgColor: "bg-[#0056FE]",
					label: m.tool_call_status_preparing(),
					animate: true,
				};
			default:
				return {
					icon: Circle,
					color: "text-muted-foreground",
					bgColor: "bg-muted",
					label: "Unknown",
					animate: false,
				};
		}
	});
</script>

<!-- Card Button -->
<button
	type="button"
	class="my-2 block w-full rounded-[10px] border-0 bg-white px-3.5 py-3 text-left dark:bg-[#1A1A1A] {part.state ===
	'output-available'
		? 'cursor-pointer'
		: 'cursor-default'}"
	onclick={() => {
		if (part.state === "output-available") {
			isModalOpen = true;
		}
	}}
>
	<div class="flex w-full items-center justify-between gap-x-4">
		<!-- Left: Tool Icon and File Path -->
		<div class="flex items-center gap-3 min-w-0 flex-1">
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
				<FilePenLine class="h-5 w-5" />
			</div>

			<!-- Tool Name and File Path -->
			<div class="flex flex-col items-start gap-1 min-w-0">
				<h3 class="text-sm font-medium text-foreground truncate max-w-full">
					{filePath}
				</h3>
				<p class="text-xs text-muted-foreground">{toolLabel}</p>
			</div>
		</div>

		<!-- Right: Status -->
		<div class="flex items-center gap-2 shrink-0">
			{#if statusConfig.animate}
				<div class="h-2 w-2 animate-pulse rounded-full {statusConfig.bgColor}"></div>
			{:else}
				<div class="h-2 w-2 rounded-full {statusConfig.bgColor}"></div>
			{/if}
			<span class="text-sm {statusConfig.color}">{statusConfig.label}</span>
		</div>
	</div>
</button>

<!-- Modal Dialog -->
<Dialog bind:open={isModalOpen}>
	<DialogContent class="max-h-[80vh] flex flex-col">
		<DialogHeader class="shrink-0">
			<DialogTitle class="flex items-center gap-2">
				<FilePenLine class="h-5 w-5" />
				<span>{filePath.split("/").pop()}</span>
			</DialogTitle>
		</DialogHeader>

		<div class="flex-1 min-h-0">
			{#if part.state === "output-error" && part.errorText}
				<div
					class="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
				>
					<p class="text-xs text-red-900 dark:text-red-100 whitespace-pre-wrap">
						{part.errorText}
					</p>
				</div>
			{:else if content}
				<div class="[&_.shiki]:max-h-[50vh] [&_.shiki]:overflow-auto [&_.shiki]:text-xs">
					<StaticCodeBlock
						code={content}
						{language}
						title={toolLabel}
						showCollapseButton={false}
						canCollapse={false}
					/>
				</div>
			{:else}
				<div class="p-4 text-sm text-muted-foreground rounded-lg border border-border">
					No content available
				</div>
			{/if}
		</div>
	</DialogContent>
</Dialog>
