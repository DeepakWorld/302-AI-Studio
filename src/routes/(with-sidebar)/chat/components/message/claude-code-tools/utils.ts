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
			return "Task List";
		case "Write":
			return "Write File";
		case "Edit":
			return "Edit File";
		case "Read":
			return "Read File";
		case "Bash":
			return "Execute Command";
		case "BashOutput":
			return "Shell Output";
		case "Glob":
			return "Find Files";
		case "Grep":
			return "Search Content";
		case "WebFetch":
			return "Fetch URL";
		case "WebSearch":
			return "Web Search";
		case "NotebookEdit":
			return "Edit Notebook";
		case "KillShell":
			return "Kill Process";
		case "Task":
			return "Launch Agent";
		case "Skill":
			return "Execute Skill";
		case "SlashCommand":
			return "Slash Command";
		case "AskUserQuestion":
			return "Ask User";
		case "ListMcpResourcesTool":
			return "List Resources";
		case "ReadMcpResourceTool":
			return "Read Resource";
		case "ExitPlanMode":
			return "Exit Plan Mode";
		case "EnterPlanMode":
			return "Enter Plan Mode";
		default:
			return "Claude Code";
	}
}
