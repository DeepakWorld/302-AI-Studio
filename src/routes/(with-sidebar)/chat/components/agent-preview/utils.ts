/**
 * Utility functions for agent-preview module
 */

import type { SandboxFileInfo } from "$lib/api/sandbox-file";
import { toast } from "svelte-sonner";

/**
 * Get threadId from window.tab or default to "shell"
 */
export function getThreadId(): string {
	const tab = window.tab;
	if (tab && typeof tab === "object" && "threadId" in tab && typeof tab.threadId === "string") {
		return tab.threadId;
	}
	return "shell";
}

/**
 * Validate sandbox ID format
 * @param id - Sandbox ID to validate
 * @returns true if valid, false otherwise
 */
export function validateSandboxId(id: string): boolean {
	return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Validate file path format
 * @param path - File path to validate
 * @returns true if valid, false otherwise
 */
export function validatePath(path: string): boolean {
	return path.startsWith("/") && !path.includes("..");
}

/**
 * Standardized error handler
 * @param error - Error to handle
 * @param context - Context where error occurred
 * @param showToast - Whether to show toast notification (default: true)
 */
export function handleError(error: unknown, context: string, showToast = true): void {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`[AgentPreview] ${context}:`, error);
	if (showToast) {
		toast.error(message);
	}
}

/**
 * Retry utility with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param delay - Initial delay in milliseconds (default: 1000)
 * @returns Promise that resolves with the function result
 */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
	for (let i = 0; i < maxRetries; i++) {
		try {
			return await fn();
		} catch (error) {
			if (i === maxRetries - 1) throw error;
			await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
		}
	}
	throw new Error("Max retries exceeded");
}

/**
 * Type guard to check if file is still selected
 * @param filePath - File path to check
 * @param currentFile - Current selected file
 * @returns true if file is still selected
 */
export function isFileStillSelected(
	filePath: string,
	currentFile: SandboxFileInfo | null,
): boolean {
	return currentFile?.path === filePath;
}
