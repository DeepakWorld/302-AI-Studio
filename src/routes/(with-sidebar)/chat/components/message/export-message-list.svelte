<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import type { ChatMessage } from "$lib/types/chat";
	import ExportMessageItem from "./export-message-item.svelte";

	interface Props {
		messages: ChatMessage[];
		selectedIds: Set<string>;
		systemPrompt: string;
		hasSystemPrompt: boolean;
		includeSystemPrompt: boolean;
		onToggleMessage: (id: string) => void;
		onToggleSystemPrompt: () => void;
	}

	let {
		messages,
		selectedIds,
		systemPrompt,
		hasSystemPrompt,
		includeSystemPrompt,
		onToggleMessage,
		onToggleSystemPrompt,
	}: Props = $props();

	function getMessagePreview(message: ChatMessage): string {
		const textParts = message.parts.filter((p) => p.type === "text");
		const text = textParts.map((p) => p.text).join(" ");
		const cleaned = text.replace(/\s+/g, " ").trim();
		return cleaned || m.export_empty_message();
	}

	function getRoleLabel(role: string): string {
		const labels: Record<string, string> = {
			user: "User",
			assistant: "Assistant",
			system: "System",
		};
		return labels[role] || role;
	}

	function getSystemPromptPreview(prompt: string): string {
		return prompt.replace(/\s+/g, " ").trim();
	}
</script>

<div class="h-full overflow-y-auto rounded-md">
	{#if hasSystemPrompt}
		<ExportMessageItem
			checked={includeSystemPrompt}
			preview={getSystemPromptPreview(systemPrompt)}
			roleLabel="System"
			onCheckedChange={onToggleSystemPrompt}
		/>
	{/if}

	{#each messages as msg (msg.id)}
		<ExportMessageItem
			checked={selectedIds.has(msg.id)}
			preview={getMessagePreview(msg)}
			roleLabel={getRoleLabel(msg.role)}
			onCheckedChange={() => onToggleMessage(msg.id)}
		/>
	{/each}
</div>
