# PipeWrench Plugin for Workbench

Diagnose MCP server connection issues from within Workbench.

## Installation

1. Copy this folder to `C:\Workbench\plugins\pipewrench\`
2. Make sure standalone PipeWrench is at `C:\Workbench\pipewrench\`
3. Restart Workbench

## Tools

### debug.mcpDoctor

Full diagnostic report for an MCP server.

**Input:**
```json
{
  "target": "mcp-stdio:npx -y @modelcontextprotocol/server-memory",
  "timeout": 15000,
  "verbose": false
}
```

**Example targets:**
- `mcp-stdio:npx -y @modelcontextprotocol/server-memory`
- `mcp-stdio:npx -y @modelcontextprotocol/server-filesystem C:\Projects`
- `mcp-http:http://localhost:3000/mcp`

### debug.mcpTrace

Detailed I/O trace showing raw protocol messages.

**Input:**
```json
{
  "target": "mcp-stdio:npx -y @modelcontextprotocol/server-memory",
  "timeout": 15000
}
```

### debug.mcpTest

Quick pass/fail test for an MCP server.

**Input:**
```json
{
  "command": "npx",
  "args": "-y @modelcontextprotocol/server-memory"
}
```

## Usage in Chat

Ask Claude:
- "Run MCP diagnostics on the memory server"
- "Test if the filesystem MCP server is working"
- "Trace the MCP protocol for server-memory"
- "Why isn't my MCP server connecting?"

## Requirements

- Standalone PipeWrench must be installed (see `pipewrench/` folder)
- Node.js available in PATH
