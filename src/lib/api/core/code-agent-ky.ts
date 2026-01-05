// import ky from "ky";

// export const codeAgentKy = ky.create({
// 	timeout: 60000,
// 	prefixUrl: "https://api.302.ai",
// 	headers: {
// 		"HTTP-Referer": "https://studio.302.ai/",
// 		"X-Title": "302.AI Studio",
// 	},
// 	hooks: {
// 		beforeRequest: [
// 			async (request) => {
// 				const userAgent = await window.electronAPI.appService.getUserAgentFragment();
// 				request.headers.set("User-Agent", userAgent);

// 				const { isOK, data } = await window.electronAPI.codeAgentService.getGlobalConfigs();
// 				if (!isOK) throw new Error("302.ai API key validation failed");
// 				request.headers.set("Authorization", `Bearer ${data.apiKey}`);
// 			},
// 		],
// 	},
// });
