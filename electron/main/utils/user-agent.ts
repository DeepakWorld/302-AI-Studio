import { app } from "electron";

export function getCustomUserAgentFragment(): string {
	const version = app.getVersion();
	const platformMap: Record<string, string> = {
		win32: "windows",
		darwin: "mac",
		linux: "linux",
	};
	const platform = platformMap[process.platform] || process.platform;
	const arch = process.arch;
	return `Studio302/${version} (${platform}; ${arch})`;
}
