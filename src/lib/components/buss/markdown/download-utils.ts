/**
 * Map of language names to file extensions
 */
export const LANGUAGE_EXTENSION_MAP: Record<string, string> = {
	javascript: "js",
	typescript: "ts",
	python: "py",
	html: "html",
	htm: "html",
	css: "css",
	scss: "scss",
	sass: "sass",
	less: "less",
	json: "json",
	xml: "xml",
	yaml: "yaml",
	yml: "yml",
	markdown: "md",
	shell: "sh",
	bash: "sh",
	zsh: "sh",
	powershell: "ps1",
	sql: "sql",
	java: "java",
	cpp: "cpp",
	c: "c",
	csharp: "cs",
	php: "php",
	ruby: "rb",
	go: "go",
	rust: "rs",
	swift: "swift",
	kotlin: "kt",
	dart: "dart",
	vue: "vue",
	svelte: "svelte",
	jsx: "jsx",
	tsx: "tsx",
	svg: "svg",
	js: "js",
	ts: "ts",
	py: "py",
	md: "md",
	rb: "rb",
	cs: "cs",
};

/**
 * Download code as a file with appropriate extension based on language
 */
export function downloadCode(code: string, language: string): void {
	const lang = language.toLowerCase();
	const extension = LANGUAGE_EXTENSION_MAP[lang] || "md";
	const fileName = `${Date.now()}.${extension}`;

	const blob = new Blob([code], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/**
 * Extract filename from a URL
 */
function extractFilenameFromUrl(url: string): string | null {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const filename = pathname.split("/").pop();
		if (filename && filename.includes(".")) {
			return filename;
		}
	} catch {
		// Invalid URL, try simple extraction
		const parts = url.split("/");
		const lastPart = parts.pop();
		if (lastPart && lastPart.includes(".")) {
			return lastPart.split("?")[0];
		}
	}
	return null;
}

/**
 * Download an image from a URL or data URL
 */
export async function downloadImage(src: string, filename?: string): Promise<void> {
	const response = await fetch(src);
	const blob = await response.blob();
	const url = URL.createObjectURL(blob);

	// Determine filename
	let name: string = filename ?? extractFilenameFromUrl(src) ?? "";
	if (!name) {
		// Determine extension from blob type
		const ext = blob.type.split("/")[1] || "png";
		name = `image-${Date.now()}.${ext}`;
	}

	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
