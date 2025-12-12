/**
 * Sandbox Deploy API Client
 * 302.AI 沙盒部署 API
 */

import type { ModelProvider } from "@shared/types";

export interface DeploySandboxRequest {
	sandbox_id: string;
	session_id?: string;
}

export interface DeploySandboxResponse {
	success: boolean;
	status: string;
	id: string;
	url: string;
	cover: string;
}

export interface DeploySandboxResult {
	success: boolean;
	data?: DeploySandboxResponse;
	error?: string;
}

/**
 * Deploy sandbox project to 302.AI hosting service
 */
export async function deploySandboxProject(
	provider: ModelProvider,
	request: DeploySandboxRequest,
): Promise<DeploySandboxResult> {
	try {
		// Use the base URL without /v1 suffix
		const baseUrl = provider.baseUrl.replace(/\/v1\/?$/, "");
		const endpoint = `${baseUrl}/302/claude-code/sandbox/deploy`;

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${provider.apiKey}`,
			},
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorMessage = `API request failed: ${response.status} ${response.statusText}`;

			try {
				const errorData = JSON.parse(errorText);
				if (errorData.error) {
					if (
						typeof errorData.error === "object" &&
						errorData.error !== null &&
						errorData.error.message
					) {
						errorMessage = errorData.error.message;
					} else if (typeof errorData.error === "string") {
						errorMessage = errorData.error;
					}
				} else if (errorData.message) {
					errorMessage = errorData.message;
				}
			} catch {
				// If error response is not JSON, use the text as is
				if (errorText) {
					errorMessage = errorText;
				}
			}

			return {
				success: false,
				error: errorMessage,
			};
		}

		const data = await response.json();

		return {
			success: true,
			data: data,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to deploy sandbox project",
		};
	}
}
