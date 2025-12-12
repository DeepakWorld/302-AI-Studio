/**
 * Sandbox File System API Client
 * 302.AI 沙盒文件系统 API
 */

export interface SandboxFileInfo {
	name: string;
	path: string;
	type: "file" | "dir";
	size?: number;
	modified_time?: string;
}

export interface SandboxFileListResponse {
	success: boolean;
	filelist: SandboxFileInfo[];
}

export interface SandboxFileDownloadResponse {
	result: Array<{
		path: string;
		path_type: string;
		file_list: Array<{
			upload_url: string;
			sandbox_path: string;
		}>;
	}>;
	// 当 API 直接返回文件内容时，保存原始内容
	_directContent?: string;
	_blobContent?: Blob;
	_contentType?: string;
}

/**
 * 查询沙盒中指定路径下的文件列表
 */
export async function listSandboxFiles(
	sandboxId: string,
	path: string | string[],
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
	depth: number = 1,
): Promise<SandboxFileListResponse> {
	const response = await fetch(`${baseUrl}/302/claude-code/sandbox/file/list`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			sandbox_id: sandboxId,
			path,
			depth,
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to list files}`);
	}

	return response.json();
}

/**
 * 下载沙盒文件内容
 */
export async function downloadSandboxFile(
	sandboxId: string,
	path: string | string[],
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
): Promise<SandboxFileDownloadResponse> {
	const response = await fetch(`${baseUrl}/302/claude-code/sandbox/file/download`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			sandbox_id: sandboxId,
			path,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("[downloadSandboxFile] Error response:", errorText);
		throw new Error(`Failed to download file: ${response.statusText}`);
	}

	const contentType = response.headers.get("content-type");
	console.log("[downloadSandboxFile] Content-Type:", contentType);

	// 如果是 JSON，尝试解析
	if (contentType && contentType.includes("application/json")) {
		// 克隆 response 以防需要回退到 blob（虽然 text() 也会消耗流，但这里逻辑是互斥的）
		const text = await response.text();
		try {
			const jsonData = JSON.parse(text);
			console.log("[downloadSandboxFile] Parsed JSON response:", jsonData);

			// 验证返回的数据结构（标准的 API 响应格式）
			if (jsonData.result && Array.isArray(jsonData.result)) {
				return jsonData;
			} else {
				// 如果结构不对，可能是 API 直接返回了文件内容（JSON 格式的文件，如 package.json）
				console.log("[downloadSandboxFile] API returned file content directly (JSON format)");
				return {
					result: [
						{
							path: typeof path === "string" ? path : path[0],
							path_type: "file",
							file_list: [
								{
									upload_url: "",
									sandbox_path: typeof path === "string" ? path : path[0],
								},
							],
						},
					],
					_directContent: text,
					_contentType: contentType,
				};
			}
		} catch (e) {
			console.warn(
				"[downloadSandboxFile] Failed to parse JSON response, treating as file content:",
				e,
			);
			// 如果 JSON 解析失败，我们已经读取了 text，所以只能用 text 返回
			// 注意：如果二进制数据被 text() 读取，可能会损坏。
			// 但前提是 Content-Type 是 application/json，所以理论上不应该是二进制。
			return {
				result: [
					{
						path: typeof path === "string" ? path : path[0],
						path_type: "file",
						file_list: [
							{
								upload_url: "",
								sandbox_path: typeof path === "string" ? path : path[0],
							},
						],
					},
				],
				_directContent: text,
				_contentType: contentType,
			};
		}
	}

	// 对于非 JSON 内容，作为 Blob 读取
	const blob = await response.blob();
	console.log("[downloadSandboxFile] Received blob content, size:", blob.size);

	return {
		result: [
			{
				path: typeof path === "string" ? path : path[0],
				path_type: "file",
				file_list: [
					{
						upload_url: "",
						sandbox_path: typeof path === "string" ? path : path[0],
					},
				],
			},
		],
		_blobContent: blob,
		_contentType: contentType || "application/octet-stream",
	};
}

/**
 * 写入文件到沙盒
 */
export async function writeSandboxFile(
	sandboxId: string,
	fileList: Array<{ file: string; save_path: string }>,
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
): Promise<{ result: string }> {
	const response = await fetch(`${baseUrl}/302/claude-code/sandbox/file/write`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			sandbox_id: sandboxId,
			file_list: fileList,
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to write file: ${response.statusText}`);
	}

	return response.json();
}

/**
 * 获取文件内容（下载并读取）
 * @param signal - Optional AbortSignal to cancel the request
 */
export async function getFileContent(
	sandboxId: string,
	filePath: string,
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
	signal?: AbortSignal,
): Promise<string> {
	// 直接调用下载 API，它会返回文件内容
	const response = await fetch(`${baseUrl}/302/claude-code/sandbox/file/download`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			sandbox_id: sandboxId,
			path: filePath,
		}),
		signal, // 传递 AbortSignal 以支持请求取消
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("[getFileContent] Error response:", errorText);
		throw new Error(`Failed to download file: ${response.statusText}`);
	}

	const contentType = response.headers.get("content-type");
	console.log("[getFileContent] Content-Type:", contentType);

	// 如果返回的是 JSON，说明返回的是下载 URL
	if (contentType?.includes("application/json")) {
		const jsonResponse = await response.json();
		console.log("[getFileContent] JSON response:", jsonResponse);

		// 如果有 download_url，则获取文件内容
		if (jsonResponse.download_url) {
			const contentResponse = await fetch(jsonResponse.download_url, { signal });
			if (!contentResponse.ok) {
				throw new Error(`Failed to fetch file content: ${contentResponse.statusText}`);
			}
			return contentResponse.text();
		}

		throw new Error("No download URL in response");
	}

	// 否则，直接返回文本内容
	return response.text();
}

export enum Operation {
	Copy = "copy",
	Move = "move",
	Remove = "remove",
	Rename = "rename",
	Mkdir = "mkdir",
}

export interface SandboxFileOperationRequest {
	operation: Operation;
	original_path: string;
	sandbox_id: string;
	target_path?: string;
	[property: string]: unknown;
}

export interface SandboxFileOperationResponse {
	success: boolean;
	result?: string;
	error?: string;
}

/**
 * 文件操作接口
 */
async function sandboxFileOperation(
	sandboxId: string,
	operation: Operation,
	originalPath: string,
	targetPath?: string,
	apiKey: string = "",
	baseUrl: string = "https://api.302.ai",
): Promise<SandboxFileOperationResponse> {
	const requestBody: SandboxFileOperationRequest = {
		operation,
		original_path: originalPath,
		sandbox_id: sandboxId,
	};

	if (targetPath !== undefined) {
		requestBody.target_path = targetPath;
	}

	const response = await fetch(`${baseUrl}/302/claude-code/sandbox/file/operation`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("[sandboxFileOperation] Error response:", errorText);
		throw new Error(`Failed to perform file operation: ${response.statusText}`);
	}

	return response.json();
}

/**
 * 重命名文件或文件夹
 */
export async function renameSandboxFile(
	sandboxId: string,
	oldPath: string,
	newPath: string,
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
): Promise<SandboxFileOperationResponse> {
	return sandboxFileOperation(sandboxId, Operation.Rename, oldPath, newPath, apiKey, baseUrl);
}

/**
 * 删除文件或文件夹
 */
export async function deleteSandboxFile(
	sandboxId: string,
	path: string,
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
): Promise<SandboxFileOperationResponse> {
	return sandboxFileOperation(sandboxId, Operation.Remove, path, undefined, apiKey, baseUrl);
}

/**
 * 复制文件或文件夹
 */
export async function copySandboxFile(
	sandboxId: string,
	sourcePath: string,
	destPath: string,
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
): Promise<SandboxFileOperationResponse> {
	return sandboxFileOperation(sandboxId, Operation.Copy, sourcePath, destPath, apiKey, baseUrl);
}

/**
 * 创建文件夹
 */
export async function createSandboxFolder(
	sandboxId: string,
	path: string,
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
): Promise<SandboxFileOperationResponse> {
	return sandboxFileOperation(sandboxId, Operation.Mkdir, path, undefined, apiKey, baseUrl);
}

/**
 * 上传文件到沙盒
 */
export async function uploadSandboxFile(
	sandboxId: string,
	path: string,
	file: File,
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
	auto_unzip: boolean = false,
): Promise<SandboxFileOperationResponse> {
	try {
		const formData = new FormData();
		formData.append("sandbox_id", sandboxId);
		formData.append("path", path);
		formData.append("file", file);
		if (auto_unzip) {
			formData.append("auto_unzip", "true");
		}

		const response = await fetch(`${baseUrl}/302/claude-code/sandbox/file/upload`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
			body: formData,
		});

		const data = await response.json();
		if (!data.success && data.error && typeof data.error === "object") {
			return {
				success: false,
				error: data.error.message || JSON.stringify(data.error),
			};
		}
		return data;
	} catch (error) {
		console.error("Error uploading sandbox file:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
