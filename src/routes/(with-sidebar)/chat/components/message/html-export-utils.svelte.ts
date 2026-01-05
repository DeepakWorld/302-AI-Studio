import { persistedThemeState } from "$lib/stores/theme.state.svelte";

// ============================================================================
// Types
// ============================================================================

export interface ThemeColors {
	background: string;
	text: string;
	userBg: string;
	userText: string;
	proseText: string;
	proseHeading: string;
	systemBg: string;
	systemText: string;
	thinkingBg: string;
	thinkingBorder: string;
	codeBg: string;
	codeText: string;
	linkColor: string;
	borderColor: string;
	mutedFg: string;
	hrColor: string;
}

// ============================================================================
// Constants
// ============================================================================

const CDN_BASE = "https://unpkg.com/@lobehub/icons-static-svg@latest/icons";

const MODEL_ICON_MAP: Record<string, string> = {
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

const LANGUAGE_NAMES: Record<string, string> = {
	js: "JavaScript",
	jsx: "JavaScript",
	ts: "TypeScript",
	tsx: "TypeScript",
	py: "Python",
	python: "Python",
	html: "HTML",
	css: "CSS",
	scss: "SCSS",
	sass: "Sass",
	less: "Less",
	json: "JSON",
	xml: "XML",
	yaml: "YAML",
	yml: "YAML",
	md: "Markdown",
	markdown: "Markdown",
	sh: "Shell",
	bash: "Bash",
	zsh: "Zsh",
	fish: "Fish",
	powershell: "PowerShell",
	sql: "SQL",
	java: "Java",
	cpp: "C++",
	c: "C",
	cs: "C#",
	php: "PHP",
	rb: "Ruby",
	ruby: "Ruby",
	go: "Go",
	rust: "Rust",
	swift: "Swift",
	kotlin: "Kotlin",
	dart: "Dart",
	vue: "Vue",
	svelte: "Svelte",
	angular: "Angular",
	react: "React",
	svg: "SVG",
};

export const KATEX_MACROS: Record<string, string> = {
	// Number sets
	"\\N": "\\mathbb{N}",
	"\\Z": "\\mathbb{Z}",
	"\\Q": "\\mathbb{Q}",
	"\\R": "\\mathbb{R}",
	"\\RR": "\\mathbb{R}",
	"\\C": "\\mathbb{C}",
	"\\F": "\\mathbb{F}",
	"\\H": "\\mathbb{H}",
	"\\PP": "\\mathbb{P}",
	// Common operators
	"\\eps": "\\varepsilon",
	"\\epsilon": "\\varepsilon",
	"\\vphi": "\\varphi",
	"\\deg": "\\mathrm{deg}",
	"\\tr": "\\mathrm{tr}",
	"\\rank": "\\mathrm{rank}",
	"\\dim": "\\mathrm{dim}",
	"\\ker": "\\mathrm{ker}",
	"\\im": "\\mathrm{im}",
	"\\coker": "\\mathrm{coker}",
	"\\Hom": "\\mathrm{Hom}",
	"\\End": "\\mathrm{End}",
	"\\Aut": "\\mathrm{Aut}",
	"\\Isom": "\\mathrm{Isom}",
	// Probability and statistics
	"\\Pr": "\\mathbb{P}",
	"\\prob": "\\mathbb{P}",
	"\\Ex": "\\mathbb{E}",
	"\\Var": "\\mathrm{Var}",
	"\\Cov": "\\mathrm{Cov}",
	"\\Cor": "\\mathrm{Cor}",
	// Common functions
	"\\argmax": "\\mathop{\\mathrm{arg\\,max}}",
	"\\argmin": "\\mathop{\\mathrm{arg\\,min}}",
	"\\sgn": "\\mathrm{sgn}",
	"\\erf": "\\mathrm{erf}",
	"\\diag": "\\mathrm{diag}",
	// Arrows and relations
	"\\into": "\\hookrightarrow",
	"\\onto": "\\twoheadrightarrow",
	"\\isom": "\\cong",
	"\\iso": "\\cong",
	"\\equiv": "\\Leftrightarrow",
	"\\iff": "\\Leftrightarrow",
	"\\implies": "\\Rightarrow",
	"\\impliedby": "\\Leftarrow",
	// Delimiters
	"\\abs": "\\left|#1\\right|",
	"\\norm": "\\left\\|#1\\right\\|",
	"\\ceil": "\\left\\lceil#1\\right\\rceil",
	"\\floor": "\\left\\lfloor#1\\right\\rfloor",
	"\\avg": "\\left\\langle#1\\right\\rangle",
	"\\inner": "\\left\\langle#1\\right\\rangle",
	"\\set": "\\left\\{#1\\right\\}",
	"\\paren": "\\left(#1\\right)",
	"\\bracket": "\\left[#1\\right]",
	// Derivatives and calculus
	"\\diff": "\\mathrm{d}",
	"\\dd": "\\,\\mathrm{d}",
	"\\dv": "\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}",
	"\\pdv": "\\frac{\\partial#1}{\\partial#2}",
	"\\grad": "\\nabla",
	"\\divg": "\\nabla\\cdot",
	"\\curl": "\\nabla\\times",
	"\\laplacian": "\\nabla^2",
	// Linear algebra
	"\\adj": "\\mathrm{adj}",
	"\\span": "\\mathrm{span}",
	"\\nullity": "\\mathrm{nullity}",
	"\\range": "\\mathrm{range}",
	"\\det": "\\mathrm{det}",
	// Logic and boolean
	"\\true": "\\mathrm{true}",
	"\\false": "\\mathrm{false}",
	// Complexity classes
	"\\NP": "\\mathsf{NP}",
	"\\PSPACE": "\\mathsf{PSPACE}",
	"\\EXP": "\\mathsf{EXP}",
	"\\EXPSPACE": "\\mathsf{EXPSPACE}",
	// Misc
	"\\st": "\\text{ s.t. }",
	"\\suchthat": "\\text{ such that }",
	"\\defeq": "\\triangleq",
	"\\define": "\\triangleq",
	"\\given": "\\mid",
	// Additional
	"\\half": "\\frac{1}{2}",
	"\\quarter": "\\frac{1}{4}",
	"\\third": "\\frac{1}{3}",
	"\\twothirds": "\\frac{2}{3}",
	// Vector notation
	"\\vv": "\\vec{#1}",
	"\\bb": "\\mathbf{#1}",
	"\\bm": "\\boldsymbol{#1}",
	"\\ii": "\\mathbf{i}",
	"\\jj": "\\mathbf{j}",
	"\\kk": "\\mathbf{k}",
	// Matrix and determinant
	"\\mat": "\\begin{matrix}#1\\end{matrix}",
	"\\pmat": "\\begin{pmatrix}#1\\end{pmatrix}",
	"\\bmat": "\\begin{bmatrix}#1\\end{bmatrix}",
	"\\vmat": "\\begin{vmatrix}#1\\end{vmatrix}",
	"\\Vmat": "\\begin{Vmatrix}#1\\end{Vmatrix}",
	// Common limits and integrals
	"\\limn": "\\lim_{n\\to\\infty}",
	"\\liminf": "\\liminf_{#1}",
	"\\limsup": "\\limsup_{#1}",
	"\\sumn": "\\sum_{n=1}^{\\infty}",
	"\\sumk": "\\sum_{k=1}^{\\infty}",
	"\\prodn": "\\prod_{n=1}^{\\infty}",
	"\\prodk": "\\prod_{k=1}^{\\infty}",
	// Big O notation
	"\\bigO": "\\mathcal{O}",
	"\\littleO": "o",
	"\\bigOmega": "\\Omega",
	"\\bigTheta": "\\Theta",
	// Topology
	"\\interior": "\\text{int}",
	"\\closure": "\\overline{#1}",
	"\\boundary": "\\partial",
	// Abstract algebra
	"\\GL": "\\mathrm{GL}",
	"\\SL": "\\mathrm{SL}",
	"\\SO": "\\mathrm{SO}",
	"\\SU": "\\mathrm{SU}",
	"\\U": "\\mathrm{U}",
	"\\Sp": "\\mathrm{Sp}",
	// Category theory
	"\\Obj": "\\mathrm{Obj}",
	"\\Mor": "\\mathrm{Mor}",
	"\\id": "\\mathrm{id}",
	"\\op": "\\mathrm{op}",
	// Theorems and proofs
	"\\qed": "\\square",
	"\\contradiction": "\\Rightarrow\\!\\Leftarrow",
};

// ============================================================================
// HTML Export Utilities Class
// ============================================================================

class HtmlExportUtils {
	// Derived state for current theme
	isDark = $derived(persistedThemeState.current.shouldUseDarkColors);
	theme = $derived(this.isDark ? "vitesse-dark" : "vitesse-light");
	colors = $derived(this.getThemeColors(this.isDark));

	getThemeColors(isDark: boolean): ThemeColors {
		return isDark
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
	}

	getStyles(colors: ThemeColors, isDark: boolean): string {
		return `
			* { margin: 0; padding: 0; box-sizing: border-box; }
			body {
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
				background-color: ${colors.background};
				color: ${colors.text};
				line-height: 1.6;
				padding: 20px;
			}
			.container { max-width: 720px; margin: 0 auto; }
			.message { margin-bottom: 16px; display: flex; flex-direction: column; }
			.message.user { align-items: flex-end; }
			.message.assistant, .message.system { align-items: flex-start; }
			.message.user .message-content {
				max-width: 80%;
				padding: 8px 16px;
				border-radius: 0.5rem;
				background-color: ${colors.userBg};
				color: ${colors.userText};
				white-space: pre-wrap;
				word-break: break-all;
			}
			.message.assistant .model-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
			.message.assistant .model-icon { width: 24px; height: 24px; border-radius: 50%; object-fit: contain; }
			.message.assistant .model-name { font-size: 12px; color: ${colors.mutedFg}; }
			.message.assistant .message-content { max-width: 100%; }
			.message.system .system-label { font-size: 12px; color: ${colors.mutedFg}; margin-bottom: 4px; }
			.message.system .message-content {
				background-color: ${colors.systemBg};
				color: ${colors.systemText};
				padding: 12px 16px;
				border-radius: 0.5rem;
				font-style: italic;
				max-width: 100%;
			}
			.thinking {
				background-color: ${colors.thinkingBg};
				border: 1px solid ${colors.thinkingBorder};
				border-radius: 0.5rem;
				padding: 12px;
				margin-bottom: 8px;
			}
			.thinking-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
			.thinking-icon { color: ${colors.mutedFg}; }
			.thinking-label { font-size: 14px; font-weight: 500; color: ${colors.mutedFg}; }
			.thinking-content { font-size: 12px; color: ${colors.mutedFg}; line-height: 1.5; white-space: pre-wrap; }
			.prose { color: ${colors.proseText}; max-width: none; }
			.prose h1 { font-size: 1.25rem; font-weight: 800; line-height: 1.5; margin-bottom: 1rem; color: ${colors.proseHeading}; }
			.prose h2 { font-size: 1.125rem; font-weight: 700; line-height: 1.375; margin-bottom: 1rem; color: ${colors.proseHeading}; }
			.prose h3, .prose h4, .prose h5, .prose h6 { font-size: 1rem; font-weight: 600; line-height: 1.375; margin-bottom: 1rem; color: ${colors.proseHeading}; }
			.prose p { margin-bottom: 1rem; font-size: 1rem; font-weight: 400; line-height: 1.375; color: ${colors.proseText}; }
			.prose strong { font-weight: 600; color: ${colors.proseText}; }
			.prose em { font-style: italic; }
			.prose code {
				background-color: ${colors.codeBg};
				padding: 0.125rem 0.375rem;
				border-radius: 0.375rem;
				font-size: 0.875rem;
				font-weight: 600;
				color: ${colors.codeText};
				font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
			}
			.code-block-wrapper {
				border-radius: 0.75rem;
				overflow: hidden;
				border: 1px solid ${colors.borderColor};
				margin: 1.75rem 0;
				background-color: ${isDark ? "#1f1f1f" : "#ffffff"};
			}
			.code-block-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 0.5rem 1rem;
				background-color: ${isDark ? "#2d2d2d" : "#f5f5f5"};
				border-bottom: 1px solid ${colors.borderColor};
				min-height: 2.5rem;
			}
			.code-block-lang { font-size: 0.875rem; font-weight: 500; color: ${colors.mutedFg}; user-select: none; }
			.code-block-wrapper pre {
				margin: 0 !important;
				border-radius: 0 !important;
				border: none !important;
				padding: 1rem;
				overflow-x: auto;
				background-color: ${isDark ? "#1f1f1f" : "#fafafa"} !important;
			}
			.code-block-wrapper pre code {
				background-color: transparent;
				padding: 0;
				font-weight: 400;
				display: block;
				white-space: pre;
				line-height: 1.45;
				font-size: 0.875rem;
				font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
			}
			.prose pre { background-color: ${colors.codeBg}; border-radius: 0.75rem; padding: 1rem; margin-top: 1.714rem; margin-bottom: 1.714rem; overflow-x: auto; }
			.prose pre code { background-color: transparent; padding: 0; font-weight: 400; display: block; white-space: pre; line-height: 1.45; }
			.prose ul, .prose ol { list-style: none; margin-bottom: 1.25rem; padding-left: 1.625rem; }
			.prose ol { counter-reset: list-counter; }
			.prose li { margin-bottom: 0.5rem; }
			.prose ul > li { position: relative; }
			.prose ul > li::before { content: ""; position: absolute; background-color: #d1d5db; border-radius: 50%; width: 0.375rem; height: 0.375rem; top: calc(0.875rem - 0.1875rem); left: -1.625rem; }
			.prose ol > li { position: relative; counter-increment: list-counter; }
			.prose ol > li::before { content: counter(list-counter) "."; position: absolute; font-weight: 400; color: #6b7280; left: -1.625rem; }
			.prose hr { margin: 1rem 0; border: none; border-top: 1px solid ${colors.hrColor}; }
			.prose blockquote { font-weight: 500; font-style: italic; color: ${colors.proseText}; border-left: 0.25rem solid ${colors.borderColor}; margin-bottom: 1.6rem; padding-left: 1rem; }
			.prose table { width: 100%; table-layout: auto; text-align: left; margin-bottom: 2rem; font-size: 0.875rem; line-height: 1.714; border-collapse: collapse; }
			.prose thead { border-bottom: 1px solid ${colors.borderColor}; }
			.prose thead th { color: ${colors.proseText}; font-weight: 600; vertical-align: bottom; padding: 0.571rem; }
			.prose tbody tr { border-bottom: 1px solid ${colors.borderColor}; }
			.prose tbody tr:last-child { border-bottom-width: 0; }
			.prose tbody td { vertical-align: baseline; padding: 0.571rem; }
			.prose a { color: ${colors.linkColor}; text-decoration: none; cursor: pointer; }
			.prose a:hover { text-decoration: underline; }
			.prose img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1rem 0; }
			.message.user .message-content img { max-width: 100%; height: auto; border-radius: 0.375rem; }
		`;
	}

	getModelIconUrl(modelName: string): string {
		if (!modelName || typeof modelName !== "string") {
			return `${CDN_BASE}/ai302-color.svg`;
		}

		const modelNameLower = modelName.toLowerCase();

		// Direct match
		if (MODEL_ICON_MAP[modelNameLower]) {
			return `${CDN_BASE}/${MODEL_ICON_MAP[modelNameLower]}`;
		}

		// Partial match
		for (const [key, icon] of Object.entries(MODEL_ICON_MAP)) {
			if (modelNameLower.includes(key)) {
				return `${CDN_BASE}/${icon}`;
			}
		}

		// Provider pattern match
		const providerPatterns = [/^([^/\-_]+)[/\-_]/, /^(\w+)/];
		for (const pattern of providerPatterns) {
			const match = modelNameLower.match(pattern);
			if (match?.[1] && MODEL_ICON_MAP[match[1]]) {
				return `${CDN_BASE}/${MODEL_ICON_MAP[match[1]]}`;
			}
		}

		return `${CDN_BASE}/ai302-color.svg`;
	}

	formatLanguageName(lang: string): string {
		if (!lang || lang === "plaintext") return "Text";
		return LANGUAGE_NAMES[lang.toLowerCase()] || lang.charAt(0).toUpperCase() + lang.slice(1);
	}

	escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;")
			.replace(/\n/g, "<br>");
	}

	escapeHtmlAttr(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
}

export const htmlExportUtils = new HtmlExportUtils();
