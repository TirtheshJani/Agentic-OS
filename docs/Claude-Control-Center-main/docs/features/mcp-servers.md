# MCP Servers

The Model Context Protocol (MCP) allows Claude Code to connect to external tools and data sources. The MCP Servers page (`/mcp-servers`) lists all servers currently configured in your environment.

## Server List
The page displays a card for each configured MCP server:
- **Name**: The identifier for the server.
- **Command**: The shell command used to start the server.
- **Arguments**: Any parameters passed to the server on startup.
- **Status**: (Optional) Indicates if the server is currently reachable.

## Configuration
MCP servers are defined in your Claude settings. While the MCP Servers page is currently **read-only**, you can modify your server configurations through the **Settings** editor:

1. Go to the **Settings** page.
2. Locate the `mcpServers` key in the JSON editor.
3. Add, edit, or remove server definitions.
4. Click **Save**.

## Common MCP Servers
Users often configure MCP servers for:
- **Database Access**: Querying Postgres, MySQL, or SQLite.
- **Google Search**: Enabling real-time web search capabilities.
- **Local Filesystem**: Enhanced file manipulation tools.
- **Slack/Discord**: Interacting with communication platforms.

For more information on the Model Context Protocol, visit the [official MCP documentation](https://modelcontextprotocol.io).
