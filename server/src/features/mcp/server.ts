import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { selectMcpToolDefinitions, type McpToolContext } from "./tools";

export const MCP_SERVER_NAME = "rin";
export const MCP_SERVER_VERSION = "1.0.0";

export function createRinMcpServer(context: McpToolContext): McpServer {
    const server = new McpServer({
        name: MCP_SERVER_NAME,
        version: MCP_SERVER_VERSION,
    });

    for (const tool of selectMcpToolDefinitions(context.scopes)) {
        server.registerTool(tool.name, {
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
        }, async (args: any) => tool.handler(args, context));
    }

    return server;
}

export function createRinMcpHandler(context: McpToolContext) {
    return createMcpHandler(() => createRinMcpServer(context), {
        onerror: (error) => {
            console.error("[mcp] request failed", error);
        },
    });
}
