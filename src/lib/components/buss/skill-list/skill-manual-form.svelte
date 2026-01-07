<script lang="ts">
	import Input from "$lib/components/ui/input/input.svelte";
	import { Label } from "$lib/components/ui/label";
	import Textarea from "$lib/components/ui/textarea/textarea.svelte";
	import { m } from "$lib/paraglide/messages";
	import { toast } from "svelte-sonner";

	export interface SkillFormData {
		name: string;
		description: string;
		content: string;
	}

	interface Props {
		formData: SkillFormData;
	}

	let { formData = $bindable() }: Props = $props();

	// 解析 front matter
	function parseFrontMatter(content: string): { data: Record<string, string>; body: string } {
		const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
		if (!match) return { data: {}, body: content };

		const yamlStr = match[1];
		const body = match[2];
		const data: Record<string, string> = {};

		for (const line of yamlStr.split(/\r?\n/)) {
			const colonIdx = line.indexOf(":");
			if (colonIdx > 0) {
				const key = line.slice(0, colonIdx).trim();
				const value = line.slice(colonIdx + 1).trim();
				data[key] = value;
			}
		}
		return { data, body };
	}

	// 生成 front matter
	function stringifyFrontMatter(data: Record<string, string>, body: string): string {
		const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
		return `---\n${lines.join("\n")}\n---\n${body}`;
	}

	// 用于追踪上一次的值，避免循环更新
	let prevName = $state(formData.name);
	let prevDesc = $state(formData.description);
	let prevContent = $state(formData.content);

	// 监听 name/description 变化，同步到 content
	$effect(() => {
		const nameChanged = formData.name !== prevName;
		const descChanged = formData.description !== prevDesc;

		if (nameChanged || descChanged) {
			// textarea 为空时，自动生成带 front matter 的模板
			if (!formData.content.trim()) {
				if (formData.name || formData.description) {
					const newContent = stringifyFrontMatter(
						{
							name: formData.name,
							description: formData.description,
							license: "Complete terms in LICENSE.txt",
						},
						"",
					);
					formData.content = newContent;
					prevContent = newContent;
				}
			} else {
				// textarea 有内容时，更新 front matter
				const parsed = parseFrontMatter(formData.content);
				if (
					parsed.data.name !== formData.name ||
					parsed.data.description !== formData.description
				) {
					parsed.data.name = formData.name;
					parsed.data.description = formData.description;
					const newContent = stringifyFrontMatter(parsed.data, parsed.body);
					formData.content = newContent;
					prevContent = newContent;
				}
			}
		}
		prevName = formData.name;
		prevDesc = formData.description;
	});

	// 监听 content 变化，同步到 name/description
	$effect(() => {
		if (formData.content !== prevContent) {
			// textarea 被清空时，清空 form
			if (!formData.content.trim()) {
				formData.name = "";
				formData.description = "";
				prevName = "";
				prevDesc = "";
			} else {
				const parsed = parseFrontMatter(formData.content);
				if (parsed.data.name !== undefined && parsed.data.name !== formData.name) {
					formData.name = parsed.data.name;
					prevName = parsed.data.name;
				}
				if (
					parsed.data.description !== undefined &&
					parsed.data.description !== formData.description
				) {
					formData.description = parsed.data.description;
					prevDesc = parsed.data.description;
				}
			}
			prevContent = formData.content;
		}
	});

	export function validate(): boolean {
		if (!formData.name.trim()) {
			toast.warning(m.skills_form_name_required());
			return false;
		}
		if (!formData.description.trim()) {
			toast.warning(m.skills_form_desc_required());
			return false;
		}
		if (!formData.content.trim()) {
			toast.warning(m.skills_form_content_required());
			return false;
		}
		return true;
	}
</script>

<div class="space-y-4 px-6 py-6">
	<div class="space-y-2">
		<Label for="skill-name" class="text-sm font-medium">
			{m.skills_form_name()} <span class="text-destructive">*</span>
		</Label>
		<Input
			id="skill-name"
			bind:value={formData.name}
			placeholder={m.skills_form_name_placeholder()}
		/>
	</div>

	<div class="space-y-2">
		<Label for="skill-desc" class="text-sm font-medium">
			{m.skills_form_desc()} <span class="text-destructive">*</span>
		</Label>
		<Input
			id="skill-desc"
			bind:value={formData.description}
			placeholder={m.skills_form_desc_placeholder()}
		/>
	</div>

	<div class="space-y-2">
		<Label for="skill-content" class="text-sm font-medium">
			{m.skills_form_content()} <span class="text-destructive">*</span>
		</Label>
		<Textarea
			id="skill-content"
			bind:value={formData.content}
			class="min-h-[200px] max-h-[300px] w-full max-w-full resize-none overflow-y-auto overflow-x-hidden break-all font-mono text-sm"
		/>
		<p class="text-muted-foreground text-xs">{m.skills_form_content_hint()}</p>
	</div>
</div>
