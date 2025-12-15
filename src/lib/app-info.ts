/**
 * Application metadata
 * Version is injected at build time from package.json (via Vite define) to keep it single-sourced.
 */
export const appInfo = {
	productName: "302 AI Studio",
	version: __APP_VERSION__,
	description: "302 AI Studio",
	author: {
		name: "302.AI",
		email: "support@302.ai",
	},
	license: "AGPL-3.0",
	repository: "https://github.com/302ai/302-AI-Studio-sv",
	homepage: "https://302.ai",
	bugs: "https://github.com/302ai/302-AI-Studio-sv/issues",
} as const;
