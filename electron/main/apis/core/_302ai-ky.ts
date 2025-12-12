import { providerStorage } from "@electron/main/services/storage-service/provider-storage";
import ky from "ky";

export const _302AIKy = ky.create({
	timeout: 60000,
	prefixUrl: "https://api.302.ai",
	hooks: {
		beforeRequest: [
			async (request) => {
				const { valid, apiKey } = await providerStorage.validate302AIProvider();
				if (!valid) throw new Error("302.ai API key validation failed");
				request.headers.set("Authorization", `Bearer ${apiKey}`);
			},
		],
	},
});
