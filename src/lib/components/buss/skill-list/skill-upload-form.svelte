<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import { Loader2, Upload } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { SvelteMap } from "svelte/reactivity";
	import SkillManualForm from "./skill-manual-form.svelte";

	interface SkillUploadData {
		skillRootDir: string;
		formData: {
			name: string;
			description: string;
			content: string;
		};
		changedFiles: Map<string, string>;
	}

	type UploadState = "idle" | "extracting" | "ready" | "error";

	let uploadState = $state<UploadState>("idle");
	let extractedPath = $state("");
	let skillRootDir = $state("");
	let skillMdFilePath = $state("");
	let errorMessage = $state("");
	let changedFiles = $state<Map<string, string>>(new Map());
	let formData = $state({
		name: "",
		description: "",
		content: "",
	});
	let manualFormRef = $state<SkillManualForm | undefined>();
	let fileInputRef = $state<HTMLInputElement | undefined>();
	let isDragOver = $state(false);

	const { extractZipBlob, scanDirectory, readFile, writeFile } = window.electronAPI.appService;

	// Find ALL SKILL.md files recursively (to detect multiple skills)
	function findAllSkillMd(
		node: { name: string; path: string; children?: unknown[] },
		results: string[] = [],
	): string[] {
		if (node.name === "SKILL.md") {
			results.push(node.path);
		}
		if (node.children) {
			for (const child of node.children as (typeof node)[]) {
				findAllSkillMd(child, results);
			}
		}
		return results;
	}

	// Get SKILL.md parent directory as skill root
	function getSkillRootDir(skillMdPath: string): string {
		return skillMdPath.replace(/[/\\]SKILL\.md$/i, "");
	}

	// Parse YAML front matter
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

	// Handle file drop or select
	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;

		const file = files[0];
		if (!file.name.toLowerCase().endsWith(".zip")) {
			toast.error(m.skills_upload_invalid_file());
			return;
		}

		uploadState = "extracting";
		errorMessage = "";

		try {
			const arrayBuffer = await file.arrayBuffer();
			extractedPath = await extractZipBlob(arrayBuffer);

			// Scan and find ALL SKILL.md files
			const tree = await scanDirectory(extractedPath);
			const skillMdPaths = findAllSkillMd(tree);

			if (skillMdPaths.length === 0) {
				uploadState = "error";
				errorMessage = m.skills_upload_no_skill_found();
				return;
			}

			if (skillMdPaths.length > 1) {
				uploadState = "error";
				errorMessage = m.skills_upload_multiple_skills_found();
				return;
			}

			const skillMdPath = skillMdPaths[0];
			skillRootDir = getSkillRootDir(skillMdPath);
			skillMdFilePath = skillMdPath;

			// Read and parse SKILL.md
			const content = await readFile(skillMdPath);
			const parsed = parseFrontMatter(content);
			formData = {
				name: parsed.data.name || "",
				description: parsed.data.description || "",
				content: content,
			};

			uploadState = "ready";
		} catch (error) {
			console.error("Failed to extract ZIP:", error);
			uploadState = "error";
			errorMessage = m.skills_create_failed();
		}
	}

	// Handle file content change from file tree
	function handleFileChange(path: string, content: string) {
		const newMap = new SvelteMap(changedFiles);
		newMap.set(path, content);
		changedFiles = newMap;

		// Sync SKILL.md content to formData
		if (path === skillMdFilePath) {
			formData.content = content;
		}
	}

	// Drag and drop handlers
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
		handleFiles(event.dataTransfer?.files ?? null);
	}

	function handleClick() {
		fileInputRef?.click();
	}

	function handleFileInputChange(event: Event) {
		const input = event.target as HTMLInputElement;
		handleFiles(input.files);
		// Reset input so the same file can be selected again
		input.value = "";
	}

	// Sync formData.content changes to changedFiles for SKILL.md
	let prevFormContent = $state("");
	$effect(() => {
		if (skillMdFilePath && formData.content !== prevFormContent) {
			const newMap = new SvelteMap(changedFiles);
			newMap.set(skillMdFilePath, formData.content);
			changedFiles = newMap;
			prevFormContent = formData.content;
		}
	});

	// Exported methods
	export function validate(): boolean {
		if (uploadState !== "ready") {
			toast.warning(m.skills_upload_no_skill_found());
			return false;
		}
		return manualFormRef?.validate() ?? false;
	}

	export function getSkillData(): SkillUploadData {
		return {
			skillRootDir,
			formData: { ...formData },
			changedFiles,
		};
	}

	export async function writeChangedFiles(): Promise<void> {
		for (const [path, content] of changedFiles) {
			await writeFile(path, content);
		}
	}

	export function reset() {
		uploadState = "idle";
		extractedPath = "";
		skillRootDir = "";
		skillMdFilePath = "";
		errorMessage = "";
		changedFiles = new Map();
		formData = { name: "", description: "", content: "" };
		prevFormContent = "";
		isDragOver = false;
	}
</script>

{#if uploadState === "idle" || uploadState === "error"}
	<!-- Drop zone UI -->
	<div class="px-6 py-6">
		<button
			type="button"
			class="flex w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors {isDragOver
				? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
				: 'border-muted-foreground/30 hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-950/20'}"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			onclick={handleClick}
		>
			<div
				class="flex h-16 w-16 items-center justify-center rounded-2xl {isDragOver
					? 'bg-violet-500 text-white'
					: 'bg-primary/10 text-primary'}"
			>
				<Upload class="h-8 w-8" />
			</div>
			<div class="text-center">
				<p class="text-foreground text-sm font-medium">{m.skills_upload_dropzone()}</p>
			</div>
		</button>

		{#if uploadState === "error" && errorMessage}
			<div class="mt-4 rounded-lg bg-red-50 p-3 text-center dark:bg-red-950/30">
				<p class="text-destructive text-sm">{errorMessage}</p>
			</div>
		{/if}
	</div>

	<input
		bind:this={fileInputRef}
		type="file"
		accept=".zip"
		class="hidden"
		onchange={handleFileInputChange}
	/>
{:else if uploadState === "extracting"}
	<!-- Loading state -->
	<div class="flex flex-col items-center justify-center px-6 py-12">
		<div
			class="bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
		>
			<Loader2 class="h-8 w-8 animate-spin" />
		</div>
		<p class="text-muted-foreground text-sm">{m.skills_upload_extracting()}</p>
	</div>
{:else}
	<!-- Ready state: show form -->
	<SkillManualForm
		bind:formData
		bind:this={manualFormRef}
		rootPath={skillRootDir}
		readOnly={false}
		{changedFiles}
		onFileChange={handleFileChange}
	/>
{/if}
