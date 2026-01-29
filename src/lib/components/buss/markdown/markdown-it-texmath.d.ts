declare module "markdown-it-texmath" {
	import type { PluginWithOptions } from "markdown-it";

	type DelimiterType =
		| "dollars"
		| "brackets"
		| "doxygen"
		| "gitlab"
		| "julia"
		| "kramdown"
		| "beg_end";

	interface TexmathOptions {
		engine?: unknown;
		delimiters?: DelimiterType | DelimiterType[];
		katexOptions?: Record<string, unknown>;
	}

	const texmath: PluginWithOptions<TexmathOptions>;
	export default texmath;
}
