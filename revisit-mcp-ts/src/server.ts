import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerInfoTools } from './tools/info';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'RevisitMCP',
    description: 'MCP server for building reVISit studies',
    version: '1.0.0',
  });

  registerInfoTools(server);

  return server;
}
