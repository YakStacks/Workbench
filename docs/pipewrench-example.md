# PipeWrench Example Output

## Example: Testing MCP Memory Server

### Input:
```json
{
  "target": "mcp-stdio:npx -y @modelcontextprotocol/server-memory"
}
```

### Output:
```
🔧 PipeWrench MCP Diagnostics
═══════════════════════════════════════════

Target: mcp-stdio:npx -y @modelcontextprotocol/server-memory
Status: ✅ HEALTHY

Connection Test:
✅ Server process spawned successfully
✅ Initialize handshake completed
✅ Server version: 0.1.0
✅ Protocol version: 2024-11-05

Available Tools:
• memory_store - Store information in memory
• memory_retrieve - Retrieve stored information
• memory_list - List all stored items
• memory_delete - Delete stored information

Latency Test:
• Initialize: 127ms
• List tools: 45ms
• Call tool: 82ms

Health Score: 100/100

Recommendations:
✅ All checks passed
✅ Server is responding normally
✅ Ready for production use
```

## Example: Diagnosing Failed Server

### Input:
```json
{
  "target": "mcp-stdio:npx -y @modelcontextprotocol/server-broken"
}
```

### Output:
```
🔧 PipeWrench MCP Diagnostics
═══════════════════════════════════════════

Target: mcp-stdio:npx -y @modelcontextprotocol/server-broken
Status: ❌ FAILED

Connection Test:
❌ Server process failed to spawn
Error: Module not found: @modelcontextprotocol/server-broken

Health Score: 0/100

Recommendations:
⚠️  Check that the package name is correct
⚠️  Try running: npm install -g @modelcontextprotocol/server-broken
⚠️  Verify Node.js and npm are in PATH
```

## Using in Workbench

1. Open the **Tools** tab
2. Select `debug.mcpDoctor` or `debug.mcpTest`
3. Enter your MCP server target
4. Click "Run Tool"
5. Review the diagnostic output

Or simply ask in Chat:
> "Test if the memory MCP server is working"

The AI will automatically use PipeWrench to diagnose the issue.
