export type McpServerType = "stdio" | "sse" | "streamableHTTP";

export interface McpServerAdvancedSettings {
	timeout?: number;
	customHeaders?: Record<string, unknown>;
	customEnvVars?: Record<string, unknown>;
	autoUseTool?: boolean;
	keepLongTaskConnection?: boolean;
}

export interface McpServer {
	id: string;
	name: string;
	description: string;
	type: McpServerType;
	url: string | null;
	command: string | null;
	icon: string;
	enabled: boolean;
	order: number;
	createdAt: Date;
	updatedAt: Date;
	advancedSettings?: McpServerAdvancedSettings;
	/** Whether this MCP server is associated with the logged-in account (auto-imported on login) */
	associatedWithAccount?: boolean;
	/** Original URL when first imported, used to detect critical field changes */
	originalUrl?: string | null;
	/** Original type when first imported, used to detect critical field changes */
	originalType?: McpServerType;
	/** Original command when first imported, used to detect critical field changes */
	originalCommand?: string | null;
}

export interface McpServerWithRelations extends McpServer {
	tools?: Array<unknown>;
	threads?: Array<unknown>;
}
