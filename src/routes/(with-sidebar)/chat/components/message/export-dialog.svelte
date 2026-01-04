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
	import markdownIt from "markdown-it";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import ExportMessageList from "./export-message-list.svelte";

	type ExportFormat = "markdown" | "text" | "json" | "html";

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
		{ value: "html", label: m.export_format_html() },
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

	// Get model icon URL from CDN based on model name (same logic as ModelIcon component)
	function getModelIconUrl(modelName: string): string {
		const CDN_BASE = "https://unpkg.com/@lobehub/icons-static-svg@latest/icons";
		const iconMap: Record<string, string> = {
			"302": "ai302-color.svg",
			"302ai": "ai302-color.svg",
			ai302: "ai302-color.svg",
			openai: "openai.svg",
			gpt: "openai.svg",
			"gpt-3": "openai.svg",
			"gpt-4": "openai.svg",
			"gpt-3.5": "openai.svg",
			"gpt-4o": "openai.svg",
			o1: "openai.svg",
			o3: "openai.svg",
			o4: "openai.svg",
			chatgpt: "openai.svg",
			"dall-e": "openai.svg",
			dalle: "openai.svg",
			whisper: "openai.svg",
			anthropic: "anthropic.svg",
			claude: "claude-color.svg",
			"claude-3": "claude-color.svg",
			"claude-2": "claude-color.svg",
			google: "google-color.svg",
			gemini: "gemini-color.svg",
			gemma: "google-color.svg",
			palm: "google-color.svg",
			bard: "google-color.svg",
			vertex: "vertexai-color.svg",
			vertexai: "vertexai-color.svg",
			meta: "meta-color.svg",
			llama: "meta-color.svg",
			"llama-2": "meta-color.svg",
			"llama-3": "meta-color.svg",
			azure: "azure-color.svg",
			microsoft: "azure-color.svg",
			qwen: "qwen-color.svg",
			tongyi: "qwen-color.svg",
			alibaba: "qwen-color.svg",
			dashscope: "qwen-color.svg",
			zhipu: "zhipu-color.svg",
			glm: "zhipu-color.svg",
			chatglm: "zhipu-color.svg",
			baidu: "baidu-color.svg",
			wenxin: "wenxin-color.svg",
			ernie: "wenxin-color.svg",
			spark: "spark-color.svg",
			doubao: "doubao-color.svg",
			bytedance: "doubao-color.svg",
			hunyuan: "hunyuan-color.svg",
			tencent: "tencent-brand-color.svg",
			tencentcloud: "tencentcloud-color.svg",
			minimax: "minimax-color.svg",
			stepfun: "stepfun-color.svg",
			yi: "yi-color.svg",
			"01ai": "yi-color.svg",
			sensenova: "sensenova-color.svg",
			siliconcloud: "siliconcloud-color.svg",
			silicon: "siliconcloud-color.svg",
			deepseek: "deepseek-color.svg",
			moonshot: "moonshot.svg",
			kimi: "moonshot.svg",
			stability: "stability-color.svg",
			stable: "stability-color.svg",
			"stable-diffusion": "stability-color.svg",
			grok: "grok.svg",
			xai: "xai.svg",
			groq: "groq.svg",
			perplexity: "perplexity.svg",
			cohere: "cohere.svg",
			mistral: "mistral-color.svg",
			huggingface: "huggingface.svg",
			replicate: "replicate.svg",
			ollama: "ollama.svg",
			lmstudio: "lmstudio.svg",
			together: "together-color.svg",
			fireworks: "fireworks-color.svg",
			openrouter: "openrouter.svg",
			workersai: "workersai-color.svg",
			cloudflare: "workersai-color.svg",
			github: "github.svg",
			vercel: "vercel.svg",
			upstage: "upstage-color.svg",
			adobe: "adobe-color.svg",
		};

		if (!modelName || typeof modelName !== "string") {
			return `${CDN_BASE}/ai302-color.svg`;
		}

		const modelNameLower = modelName.toLowerCase();

		// Direct match
		if (iconMap[modelNameLower]) {
			return `${CDN_BASE}/${iconMap[modelNameLower]}`;
		}

		// Partial match
		for (const [key, icon] of Object.entries(iconMap)) {
			if (modelNameLower.includes(key)) {
				return `${CDN_BASE}/${icon}`;
			}
		}

		// Provider pattern match
		const providerPatterns = [/^([^/\-_]+)[/\-_]/, /^(\w+)/];
		for (const pattern of providerPatterns) {
			const match = modelNameLower.match(pattern);
			if (match?.[1] && iconMap[match[1]]) {
				return `${CDN_BASE}/${iconMap[match[1]]}`;
			}
		}

		// Default to 302AI icon
		return `${CDN_BASE}/ai302-color.svg`;
	}

	function formatAsHtml(): string {
		const isDark = persistedThemeState.current.shouldUseDarkColors;
		const systemPrompt = getSystemPrompt();
		const md = markdownIt({ html: true, linkify: true, breaks: true });

		// Theme colors based on ds.css and markdown.css
		const colors = isDark
			? {
					background: "#121212",
					text: "#e6e6e6",
					userBg: "#49306a",
					userText: "#e6e6e6",
					proseText: "#dbdbdb",
					proseHeading: "#dedede",
					systemBg: "#2d2d2d",
					systemText: "#e6e6e6",
					thinkingBg: "rgba(45, 45, 45, 0.3)",
					thinkingBorder: "#3d3d3d",
					codeBg: "#374151",
					codeText: "#f9fafb",
					linkColor: "#8e47f0",
					borderColor: "#374151",
					mutedFg: "#a1a1aa",
					hrColor: "#222222",
				}
			: {
					background: "#ffffff",
					text: "#333333",
					userBg: "#f3f2ff",
					userText: "#8e47f0",
					proseText: "#1d2129",
					proseHeading: "#262626",
					systemBg: "#f1f1f1",
					systemText: "#333333",
					thinkingBg: "rgba(241, 241, 241, 0.3)",
					thinkingBorder: "#e5e7eb",
					codeBg: "#f3f4f6",
					codeText: "#1d2129",
					linkColor: "#8e47f0",
					borderColor: "#e5e7eb",
					mutedFg: "#71717a",
					hrColor: "#f3f3f3",
				};

		// Full styles including prose from markdown.css
		const styles = `
			* { margin: 0; padding: 0; box-sizing: border-box; }
			body {
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
				background-color: ${colors.background};
				color: ${colors.text};
				line-height: 1.6;
				padding: 20px;
			}
			.container {
				max-width: 720px;
				margin: 0 auto;
			}
			.message {
				margin-bottom: 16px;
				display: flex;
				flex-direction: column;
			}
			.message.user {
				align-items: flex-end;
			}
			.message.assistant, .message.system {
				align-items: flex-start;
			}
			/* User message bubble */
			.message.user .message-content {
				max-width: 80%;
				padding: 8px 16px;
				border-radius: 0.5rem;
				background-color: ${colors.userBg};
				color: ${colors.userText};
				white-space: pre-wrap;
				word-break: break-all;
			}
			/* Assistant message */
			.message.assistant .model-header {
				display: flex;
				align-items: center;
				gap: 8px;
				margin-bottom: 8px;
			}
			.message.assistant .model-icon {
				width: 24px;
				height: 24px;
				border-radius: 50%;
				object-fit: contain;
			}
			.message.assistant .model-name {
				font-size: 12px;
				color: ${colors.mutedFg};
			}
			.message.assistant .message-content {
				max-width: 100%;
			}
			/* System message */
			.message.system .system-label {
				font-size: 12px;
				color: ${colors.mutedFg};
				margin-bottom: 4px;
			}
			.message.system .message-content {
				background-color: ${colors.systemBg};
				color: ${colors.systemText};
				padding: 12px 16px;
				border-radius: 0.5rem;
				font-style: italic;
				max-width: 100%;
			}
			/* Thinking block */
			.thinking {
				background-color: ${colors.thinkingBg};
				border: 1px solid ${colors.thinkingBorder};
				border-radius: 0.5rem;
				padding: 12px;
				margin-bottom: 8px;
			}
			.thinking-header {
				display: flex;
				align-items: center;
				gap: 8px;
				margin-bottom: 8px;
			}
			.thinking-icon {
				color: ${colors.mutedFg};
			}
			.thinking-label {
				font-size: 14px;
				font-weight: 500;
				color: ${colors.mutedFg};
			}
			.thinking-content {
				font-size: 12px;
				color: ${colors.mutedFg};
				line-height: 1.5;
				white-space: pre-wrap;
			}
			/* Prose styles from markdown.css */
			.prose {
				color: ${colors.proseText};
				max-width: none;
			}
			.prose h1 {
				font-size: 1.25rem;
				font-weight: 800;
				line-height: 1.5;
				margin-bottom: 1rem;
				color: ${colors.proseHeading};
			}
			.prose h2 {
				font-size: 1.125rem;
				font-weight: 700;
				line-height: 1.375;
				margin-bottom: 1rem;
				color: ${colors.proseHeading};
			}
			.prose h3, .prose h4, .prose h5, .prose h6 {
				font-size: 1rem;
				font-weight: 600;
				line-height: 1.375;
				margin-bottom: 1rem;
				color: ${colors.proseHeading};
			}
			.prose p {
				margin-bottom: 1rem;
				font-size: 1rem;
				font-weight: 400;
				line-height: 1.375;
				color: ${colors.proseText};
			}
			.prose strong {
				font-weight: 600;
				color: ${colors.proseText};
			}
			.prose em {
				font-style: italic;
			}
			.prose code {
				background-color: ${colors.codeBg};
				padding: 0.125rem 0.375rem;
				border-radius: 0.375rem;
				font-size: 0.875rem;
				font-weight: 600;
				color: ${colors.codeText};
				font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
			}
			.prose pre {
				background-color: ${colors.codeBg};
				border-radius: 0.75rem;
				padding: 1rem;
				margin-top: 1.714rem;
				margin-bottom: 1.714rem;
				overflow-x: auto;
			}
			.prose pre code {
				background-color: transparent;
				padding: 0;
				font-weight: 400;
				display: block;
				white-space: pre;
				line-height: 1.45;
			}
			.prose ul, .prose ol {
				list-style: none;
				margin-bottom: 1.25rem;
				padding-left: 1.625rem;
			}
			.prose ol {
				counter-reset: list-counter;
			}
			.prose li {
				margin-bottom: 0.5rem;
			}
			.prose ul > li {
				position: relative;
			}
			.prose ul > li::before {
				content: "";
				position: absolute;
				background-color: #d1d5db;
				border-radius: 50%;
				width: 0.375rem;
				height: 0.375rem;
				top: calc(0.875rem - 0.1875rem);
				left: -1.625rem;
			}
			.prose ol > li {
				position: relative;
				counter-increment: list-counter;
			}
			.prose ol > li::before {
				content: counter(list-counter) ".";
				position: absolute;
				font-weight: 400;
				color: #6b7280;
				left: -1.625rem;
			}
			.prose hr {
				margin: 1rem 0;
				border: none;
				border-top: 1px solid ${colors.hrColor};
			}
			.prose blockquote {
				font-weight: 500;
				font-style: italic;
				color: ${colors.proseText};
				border-left-width: 0.25rem;
				border-left-style: solid;
				border-left-color: ${colors.borderColor};
				margin-bottom: 1.6rem;
				padding-left: 1rem;
			}
			.prose table {
				width: 100%;
				table-layout: auto;
				text-align: left;
				margin-bottom: 2rem;
				font-size: 0.875rem;
				line-height: 1.714;
			}
			.prose thead {
				border-bottom: 1px solid ${colors.borderColor};
			}
			.prose thead th {
				color: ${colors.proseText};
				font-weight: 600;
				vertical-align: bottom;
				padding: 0.571rem;
			}
			.prose tbody tr {
				border-bottom: 1px solid ${colors.borderColor};
			}
			.prose tbody tr:last-child {
				border-bottom-width: 0;
			}
			.prose tbody td {
				vertical-align: baseline;
				padding: 0.571rem;
			}
			.prose a {
				color: ${colors.linkColor};
				text-decoration: none;
				cursor: pointer;
			}
			.prose a:hover {
				text-decoration: underline;
			}
			.prose img {
				max-width: 100%;
				height: auto;
				border-radius: 0.5rem;
				margin: 1rem 0;
			}
			/* User message images */
			.message.user .message-content img {
				max-width: 100%;
				height: auto;
				border-radius: 0.375rem;
			}
		`;

		const messageElements: string[] = [];

		// System prompt - with "System" label
		if (includeSystemPrompt && hasSystemPrompt) {
			messageElements.push(`
				<div class="message system">
					<div class="system-label">System</div>
					<div class="message-content">${escapeHtml(systemPrompt)}</div>
				</div>
			`);
		}

		// Messages
		for (const msg of messages) {
			if (!selectedMessageIds.has(msg.id)) continue;

			const role = msg.role;

			if (role === "user") {
				// User message - no label, just purple bubble
				const textContent = getMessageContent(msg, false);
				messageElements.push(`
					<div class="message user">
						<div class="message-content">${escapeHtml(textContent)}</div>
					</div>
				`);
			} else if (role === "assistant") {
				// Assistant message - with model icon and name
				const modelName = msg.metadata?.model || "AI";
				const modelIconUrl = getModelIconUrl(modelName);
				let contentHtml = "";

				// Thinking content
				if (includeThinking) {
					const reasoningParts = msg.parts.filter((p) => p.type === "reasoning");
					if (reasoningParts.length > 0) {
						const thinkingText = reasoningParts.map((p) => p.text).join("\n");
						contentHtml += `
							<div class="thinking">
								<div class="thinking-header">
									<svg class="thinking-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
										<path d="M9 18h6"/>
										<path d="M10 22h4"/>
									</svg>
									<span class="thinking-label">${m.title_thinking()}</span>
								</div>
								<div class="thinking-content">${escapeHtml(thinkingText)}</div>
							</div>
						`;
					}
				}

				// Main content with markdown
				const textContent = getMessageContent(msg, false);
				contentHtml += `<div class="prose">${md.render(textContent)}</div>`;

				messageElements.push(`
					<div class="message assistant">
						<div class="model-header">
							<img class="model-icon" src="${modelIconUrl}" alt="${escapeHtmlAttr(modelName)}" />
							<span class="model-name">${escapeHtmlAttr(modelName)}</span>
						</div>
						<div class="message-content">${contentHtml}</div>
					</div>
				`);
			}
		}

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Chat Export</title>
	<style>${styles}</style>
</head>
<body>
	<div class="container">
		${messageElements.join("\n")}
	</div>
</body>
</html>`;
	}

	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;")
			.replace(/\n/g, "<br>");
	}

	function escapeHtmlAttr(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
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
				case "html":
					content = formatAsHtml();
					extension = "html";
					filterName = "HTML";
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
