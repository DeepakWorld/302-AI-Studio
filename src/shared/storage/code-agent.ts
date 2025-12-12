import { type } from "arktype";

export const codeAgentType = type("'local' | 'remote'");
export type CodeAgentType = typeof codeAgentType.infer;
export const CodeAgentConfigMetadata = type({
	enabled: "boolean",
	threadId: "string",
	type: codeAgentType,
	currentAgentId: "string",
	isDeleted: "boolean",
});
export type CodeAgentConfigMetadata = typeof CodeAgentConfigMetadata.infer;

export const codeAgentMetadata = type({
	model: "string",
	/**
	 * local agent only
	 */
	currentWorkspacePath: "string",
	workspacePaths: "string[]",
	variables: "string[]",
	/**
	 * remote agent only
	 */
	currentSessionId: "string",
	sandboxId: "string",
	sandboxRemark: "string",
});
export type CodeAgentMetadata = typeof codeAgentMetadata.infer;

export const codeAgentCfgs = type({
	baseUrl: "string",
	model: "string",
});
export type CodeAgentCfgs = typeof codeAgentCfgs.infer;

export const codeAgentCreateResult = type("'already-exist' | 'success' | 'failed'");
export type CodeAgentCreateResult = typeof codeAgentCreateResult.infer;

export const codeAgentSandboxStatus = type("'waiting-for-sandbox' | 'sandbox-created'");
export type CodeAgentSandboxStatus = typeof codeAgentSandboxStatus.infer;

export const claudeCodeSessionInfo = type({
	sessionId: "string",
	workspacePath: "string",
	note: "string",
	usedAt: "string",
});
export type ClaudeCodeSessionInfo = typeof claudeCodeSessionInfo.infer;

export const claudeCodeSandboxInfo = type({
	sandboxId: "string",
	sandboxRemark: "string",
	diskTotal: "number",
	diskUsed: "number",
	diskUsage: "'normal' | 'insufficient'",
	status: "'killed' | 'running' | 'paused'",
	llmModel: "string",
	createdAt: "string",
	updatedAt: "string",
	deletedAt: "string",
	sessionInfos: claudeCodeSessionInfo.array(),
});
export type ClaudeCodeSandboxInfo = typeof claudeCodeSandboxInfo.infer;

export const createClaudeCodeSandboxRequest = type({
	llm_model: "string",
	system_prompt: "string?",
	mcp_servers: "string[]?",
	sandbox_name: "string?",
	max_thinking_token: "number?",
});
export type CreateClaudeCodeSandboxRequest = typeof createClaudeCodeSandboxRequest.infer;
export const createClaudeCodeSandboxResponse = type({
	success: "boolean",
	data: {
		sandbox_id: "string",
		sandbox_name: "string",
	},
});
export type CreateClaudeCodeSandboxResponse = typeof createClaudeCodeSandboxResponse.infer;
