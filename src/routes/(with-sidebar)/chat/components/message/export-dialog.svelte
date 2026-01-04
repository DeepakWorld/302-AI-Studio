<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Select from "$lib/components/ui/select";
	import { m } from "$lib/paraglide/messages.js";
	import { chatParameters } from "$lib/stores/chat-paramters/chat-parameters.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { format } from "date-fns";
	import { toast } from "svelte-sonner";
	import { SvelteSet } from "svelte/reactivity";
	import ExportMessageList from "./export-message-list.svelte";

	type ExportFormat = "markdown" | "text" | "json";

	interface ExportDialogProps {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		startFromMessageId?: string | null;
	}

	let { open = $bindable(), onOpenChange, startFromMessageId = null }: ExportDialogProps = $props();

	// State
	let exportFormat = $state<ExportFormat>("markdown");
	let selectedMessageIds = $state<Set<string>>(new Set());
	let includeSystemPrompt = $state(true);
	let includeThinking = $state(false);
	let isExporting = $state(false);

	// 使用函数直接计算过滤后的消息，避免 derived 缓存问题
	// 从第一条消息开始，到点击的 assistant 消息结束（包含该消息及之前所有消息）
	function getFilteredMessages() {
		const allMessages = chatState.messages;
		if (!startFromMessageId) return allMessages;

		const assistantIndex = allMessages.findIndex((m) => m.id === startFromMessageId);
		if (assistantIndex === -1) return allMessages;

		// 返回从开头到点击的 assistant 消息（包含）
		return allMessages.slice(0, assistantIndex + 1);
	}

	// Read systemPrompt from the last assistant message's metadata (most recent value used)
	// Fallback to current chatParameters for backward compatibility with old messages
	function getSystemPrompt() {
		const msgs = getFilteredMessages();
		// Find the last assistant message that has systemPromptContent in metadata
		const lastAssistantMsgWithPrompt = [...msgs]
			.reverse()
			.find((m) => m.role === "assistant" && m.metadata?.systemPromptContent);
		if (lastAssistantMsgWithPrompt?.metadata?.systemPromptContent) {
			return lastAssistantMsgWithPrompt.metadata.systemPromptContent;
		}
		return chatParameters.systemPromptContent;
	}

	const hasSystemPrompt = $derived(!!getSystemPrompt()?.trim());

	const selectedCount = $derived(
		selectedMessageIds.size + (includeSystemPrompt && hasSystemPrompt ? 1 : 0),
	);

	const formatOptions = $derived([
		{ value: "markdown", label: "Markdown" },
		{ value: "text", label: m.export_format_plain_text() },
		{ value: "json", label: "JSON" },
	]);

	// 用于模板的消息列表
	const messages = $derived.by(() => {
		// 只有当 dialog 打开时才计算过滤后的消息
		if (!open) return [];
		const filtered = getFilteredMessages();

		return filtered;
	});

	// Initialize selection when dialog opens
	$effect(() => {
		if (open) {
			// 重新获取过滤后的消息
			const filteredMsgs = getFilteredMessages();

			// 创建新的 Set 来存储选中的消息 ID
			const newSelectedIds = new SvelteSet<string>();
			for (const msg of filteredMsgs) {
				newSelectedIds.add(msg.id);
			}
			selectedMessageIds = newSelectedIds;
			includeSystemPrompt = hasSystemPrompt;
		}
	});

	// Selection functions
	function selectAll() {
		const newSelectedIds = new SvelteSet<string>();
		for (const msg of messages) {
			newSelectedIds.add(msg.id);
		}
		selectedMessageIds = newSelectedIds;
		if (hasSystemPrompt) includeSystemPrompt = true;
	}

	function invertSelection() {
		const newSelection = new SvelteSet<string>();
		for (const msg of messages) {
			if (!selectedMessageIds.has(msg.id)) {
				newSelection.add(msg.id);
			}
		}
		selectedMessageIds = newSelection;
		if (hasSystemPrompt) includeSystemPrompt = !includeSystemPrompt;
	}

	function toggleMessage(id: string) {
		const newSelectedIds = new SvelteSet(selectedMessageIds);
		if (newSelectedIds.has(id)) {
			newSelectedIds.delete(id);
		} else {
			newSelectedIds.add(id);
		}
		selectedMessageIds = newSelectedIds;
	}

	function toggleSystemPrompt() {
		includeSystemPrompt = !includeSystemPrompt;
	}

	// Helper functions
	function getRoleLabel(role: string): string {
		const labels: Record<string, string> = {
			user: "User",
			assistant: "Assistant",
			system: "System",
		};
		return labels[role] || role;
	}

	function getMessageContent(message: (typeof messages)[0], withThinking: boolean): string {
		const textParts = message.parts.filter((p) => p.type === "text");
		const reasoningParts = message.parts.filter((p) => p.type === "reasoning");

		const textContent = textParts.map((p) => p.text).join("\n");

		if (withThinking && reasoningParts.length > 0) {
			const thinkingContent = reasoningParts.map((p) => p.text).join("\n");
			return `${thinkingContent}\n\n${textContent}`;
		}

		return textContent;
	}

	// Export formatters
	function formatAsMarkdown(): string {
		const lines: string[] = [];
		const systemPrompt = getSystemPrompt();

		if (includeSystemPrompt && hasSystemPrompt) {
			lines.push("## System\n");
			lines.push(systemPrompt + "\n");
		}

		for (const msg of messages) {
			if (!selectedMessageIds.has(msg.id)) continue;

			const role = getRoleLabel(msg.role);
			const content = getMessageContent(msg, false);
			lines.push(`## ${role}\n`);

			// 思考过程
			if (includeThinking && msg.role === "assistant") {
				const reasoningParts = msg.parts.filter((p) => p.type === "reasoning");
				if (reasoningParts.length > 0) {
					const thinking = reasoningParts.map((p) => p.text).join("\n");
					lines.push("<think>");
					lines.push(thinking);
					lines.push("</think>\n");
				}
			}

			lines.push(content + "\n");
		}

		return lines.join("\n");
	}

	function formatAsText(): string {
		const lines: string[] = [];
		const systemPrompt = getSystemPrompt();

		if (includeSystemPrompt && hasSystemPrompt) {
			lines.push("[System]");
			lines.push(systemPrompt);
			lines.push("");
		}

		for (const msg of messages) {
			if (!selectedMessageIds.has(msg.id)) continue;

			const role = getRoleLabel(msg.role);
			const content = getMessageContent(msg, false);
			lines.push(`[${role}]`);

			// 思考过程放在消息内容之前
			if (includeThinking && msg.role === "assistant") {
				const reasoningParts = msg.parts.filter((p) => p.type === "reasoning");
				if (reasoningParts.length > 0) {
					const thinking = reasoningParts.map((p) => p.text).join("\n");
					lines.push("<think>");
					lines.push(thinking);
					lines.push("</think>");
				}
			}

			lines.push(content);
			lines.push("");
		}

		return lines.join("\n");
	}

	function formatAsJson(): string {
		const result: { role: string; content: string }[] = [];
		const systemPrompt = getSystemPrompt();

		if (includeSystemPrompt && hasSystemPrompt) {
			result.push({ role: "system", content: systemPrompt });
		}

		for (const msg of messages) {
			if (!selectedMessageIds.has(msg.id)) continue;

			let content = getMessageContent(msg, includeThinking);
			result.push({ role: msg.role, content });
		}

		return JSON.stringify({ messages: result }, null, 2);
	}

	// Export handler
	async function handleExport() {
		if (selectedCount === 0) {
			toast.error(m.export_at_least_one_message());
			return;
		}

		isExporting = true;

		try {
			let content: string;
			let extension: string;
			let filterName: string;

			switch (exportFormat) {
				case "markdown":
					content = formatAsMarkdown();
					extension = "md";
					filterName = "Markdown";
					break;
				case "text":
					content = formatAsText();
					extension = "txt";
					filterName = "Text";
					break;
				case "json":
					content = formatAsJson();
					extension = "json";
					filterName = "JSON";
					break;
			}

			const timestamp = format(new Date(), "yyyyMMddHHmmss");
			const defaultFileName = `chat-export-${timestamp}.${extension}`;

			const filePath = await window.electronAPI.dataService.exportChatToFile(
				content,
				extension,
				filterName,
				defaultFileName,
			);

			if (filePath) {
				toast.success(m.export_success());
				open = false;
			}
		} catch (error) {
			console.error("Export failed:", error);
			toast.error(m.export_failed());
		} finally {
			isExporting = false;
		}
	}
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content class="!w-[638px] !min-w-[638px] !max-w-[638px] !h-[540px] flex flex-col">
		<Dialog.Header>
			<Dialog.Title>{m.export_dialog_title()}</Dialog.Title>
		</Dialog.Header>

		<!-- Format Select -->
		<div class="mt-2">
			<Select.Root type="single" bind:value={exportFormat}>
				<Select.Trigger class="w-full">
					<span>{formatOptions.find((o) => o.value === exportFormat)?.label}</span>
				</Select.Trigger>
				<Select.Content>
					{#each formatOptions as option (option.value)}
						<Select.Item value={option.value} label={option.label}>
							{option.label}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<!-- Selection Header -->
		<div class="mt-4 flex items-center justify-between">
			<div class="flex items-baseline gap-2">
				<span class="font-medium">{m.export_select_range()}</span>
				<span class="text-sm text-muted-foreground"
					>{m.export_selected_count({ count: selectedCount })}</span
				>
			</div>
			<div class="flex items-center gap-1">
				<Button variant="ghost" size="sm" class="text-primary" onclick={selectAll}>
					{m.export_select_all()}
				</Button>
				<Button variant="ghost" size="sm" class="text-primary" onclick={invertSelection}>
					{m.export_invert_selection()}
				</Button>
			</div>
		</div>

		<!-- Message List -->
		<div class="mt-2 flex-1 overflow-hidden">
			<ExportMessageList
				{messages}
				selectedIds={selectedMessageIds}
				systemPrompt={getSystemPrompt()}
				{hasSystemPrompt}
				{includeSystemPrompt}
				onToggleMessage={toggleMessage}
				onToggleSystemPrompt={toggleSystemPrompt}
			/>
		</div>

		<!-- Footer -->
		<div class="mt-4 flex items-center justify-between">
			<label class="flex items-center gap-2 cursor-pointer">
				<Checkbox bind:checked={includeThinking} />
				<span class="text-sm">{m.export_include_thinking()}</span>
			</label>
			<Button onclick={handleExport} disabled={isExporting || selectedCount === 0}>
				{isExporting ? m.export_exporting() : m.export_button()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
