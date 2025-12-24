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
