import {
	BookOpen,
	FilePenLine,
	FileSearch,
	FileText,
	FolderSearch,
	Globe,
	ListTodo,
	LogIn,
	LogOut,
	MessageCircleQuestionMark,
	Notebook,
	Search,
	Server,
	Skull,
	Slash,
	Terminal,
	Zap,
	type Icon,
} from "@lucide/svelte";
import { m } from "$lib/paraglide/messages.js";

// Claude Code tool names
export const CLAUDE_CODE_TOOLS = [
	"Task",
	"Bash",
	"Glob",
	"Grep",
	"Read",
	"Edit",
	"Write",
	"NotebookEdit",
	"WebFetch",
	"TodoWrite",
	"WebSearch",
	"BashOutput",
	"KillShell",
	"Skill",
	"SlashCommand",
	"ExitPlanMode",
	"EnterPlanMode",
	"AskUserQuestion",
	"ListMcpResourcesTool",
	"ReadMcpResourceTool",
] as const;

export type ClaudeCodeToolName = (typeof CLAUDE_CODE_TOOLS)[number];

export function isClaudeCodeTool(toolName: string): boolean {
	// Claude Code tools don't have "__" prefix (unlike MCP tools which use "serverId__toolName")
	return !toolName.includes("__") && CLAUDE_CODE_TOOLS.includes(toolName as ClaudeCodeToolName);
}

/**
 * Check if a part type is a Claude Code tool type (e.g., "tool-Write", "tool-Bash")
 * 302.AI Claude Code uses "tool-{ToolName}" format instead of "dynamic-tool"
 */
export function isClaudeCodeToolType(partType: string): boolean {
	if (!partType.startsWith("tool-")) return false;
	const toolName = partType.slice(5); // Remove "tool-" prefix
	return CLAUDE_CODE_TOOLS.includes(toolName as ClaudeCodeToolName);
}

/**
 * Extract tool name from part type (e.g., "tool-Write" -> "Write")
 */
export function extractToolNameFromType(partType: string): string {
	if (partType.startsWith("tool-")) {
		return partType.slice(5); // Remove "tool-" prefix
	}
	return partType;
}

export function getClaudeCodeToolIcon(toolName: string): typeof Icon {
	switch (toolName) {
		case "TodoWrite":
			return ListTodo;
		case "Write":
			return FileText;
		case "Edit":
			return FilePenLine;
		case "Read":
			return BookOpen;
		case "Bash":
		case "BashOutput":
			return Terminal;
		case "Glob":
			return FolderSearch;
		case "Grep":
			return FileSearch;
		case "WebFetch":
		case "WebSearch":
			return Globe;
		case "NotebookEdit":
			return Notebook;
		case "KillShell":
			return Skull;
		case "Task":
			return Zap;
		case "Skill":
			return Zap;
		case "SlashCommand":
			return Slash;
		case "AskUserQuestion":
			return MessageCircleQuestionMark;
		case "ListMcpResourcesTool":
		case "ReadMcpResourceTool":
			return Server;
		case "ExitPlanMode":
			return LogOut;
		case "EnterPlanMode":
			return LogIn;
		case "Search":
			return Search;
		default:
			return Terminal;
	}
}

export function getClaudeCodeToolLabel(toolName: string): string {
	switch (toolName) {
		case "TodoWrite":
			return m.tool_call_label_task_list();
		case "Write":
			return m.tool_call_label_write_file();
		case "Edit":
			return m.tool_call_label_edit_file();
		case "Read":
			return m.tool_call_label_read_file();
		case "Bash":
			return m.tool_call_label_execute_command();
		case "BashOutput":
			return m.tool_call_label_shell_output();
		case "Glob":
			return m.tool_call_label_find_files();
		case "Grep":
			return m.tool_call_label_search_content();
		case "WebFetch":
			return m.tool_call_label_fetch_url();
		case "WebSearch":
			return m.tool_call_label_web_search();
		case "NotebookEdit":
			return m.tool_call_label_edit_notebook();
		case "KillShell":
			return m.tool_call_label_kill_process();
		case "Task":
			return m.tool_call_label_launch_agent();
		case "Skill":
			return m.tool_call_label_execute_skill();
		case "SlashCommand":
			return m.tool_call_label_slash_command();
		case "AskUserQuestion":
			return m.tool_call_label_ask_user();
		case "ListMcpResourcesTool":
			return m.tool_call_label_list_resources();
		case "ReadMcpResourceTool":
			return m.tool_call_label_read_resource();
		case "ExitPlanMode":
			return m.tool_call_label_exit_plan_mode();
		case "EnterPlanMode":
			return m.tool_call_label_enter_plan_mode();
		default:
			return m.tool_call_label_claude_code();
	}
}

/**
 * MCP tool type prefix for sandbox agent mode
 * Format: "tool-mcp__serverId__toolName"
 */
const MCP_TOOL_TYPE_PREFIX = "tool-mcp__";

/**
 * Parsed MCP tool info
 */
export interface McpToolInfo {
	serverId: string;
	toolName: string;
}

/**
 * Check if a part type is an MCP tool type (e.g., "tool-mcp__basic-mcp-server__calculator")
 * This is used in sandbox agent mode where MCP tools have a different format
 */
export function isMcpToolType(partType: string): boolean {
	return partType.startsWith(MCP_TOOL_TYPE_PREFIX);
}

/**
 * Extract MCP server ID and tool name from part type
 * Format: "tool-mcp__serverId__toolName" -> { serverId: "serverId", toolName: "toolName" }
 *
 * @param partType - The part type string (e.g., "tool-mcp__basic-mcp-server__calculator")
 * @returns The parsed MCP tool info or null if not a valid MCP tool type
 */
export function extractMcpToolInfo(partType: string): McpToolInfo | null {
	if (!isMcpToolType(partType)) {
		return null;
	}

	// Remove "tool-mcp__" prefix
	const remainder = partType.slice(MCP_TOOL_TYPE_PREFIX.length);

	// Split by "__" - the first part is serverId, the rest is toolName
	const parts = remainder.split("__");
	if (parts.length < 2) {
		return null;
	}

	const serverId = parts[0];
	// Join the rest with "__" in case tool name contains "__"
	const toolName = parts.slice(1).join("__");

	return { serverId, toolName };
}
