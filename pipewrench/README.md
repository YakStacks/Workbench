# PipeWrench 🔧

**MCP Connection Diagnostic & Proxy Tool for Workbench**

Solves the stdio pipe issues between Electron and MCP servers on Windows by acting as a standalone Node.js proxy process.

## The Problem

On Windows, Electron apps have difficulty with stdio-based communication to child processes. This causes MCP server connections to fail silently or hang, making debugging extremely difficult.

## The Solution

PipeWrench provides:

1. **Diagnostics** - Test MCP server connections and get detailed reports
2. **Auto-Detection** - Automatically detect framing type (line-delimited vs content-length)
3. **Path Resolution** - Resolve npx packages to local node_modules for faster startup
4. **TCP Proxy** - Bridge TCP connections to stdio for reliable communication

## Usage

### Quick Diagnostic

```javascript
import { testConnection, FramingType } from "./index.js";

const result = await testConnection(
  "npx",
  ["-y", "@modelcontextprotocol/server-memory"],
  FramingType.LINE_DELIMITED,
  15000,
);

console.log(result.toString());
// ╔══════════════════════════════════════════════════════════════╗
// ║                    PipeWrench Diagnostic                     ║
// ╠══════════════════════════════════════════════════════════════╣
// ║  Server Found:      ✅                                       ║
// ║  Server Started:    ✅                                       ║
// ║  Stdin Writable:    ✅                                       ║
// ║  Stdout Readable:   ✅                                       ║
// ║  Initialize OK:     ✅                                       ║
// ║  Framing Type:      line-delimited                           ║
// ╚══════════════════════════════════════════════════════════════╝
```

### Auto-Detect Framing

```javascript
import { detectFraming } from "./index.js";

const result = await detectFraming("npx", [
  "-y",
  "@modelcontextprotocol/server-memory",
]);
console.log("Detected framing:", result.framingType);
```

### Resolve Server Paths

```javascript
import { resolveServerPath } from "./index.js";

const resolved = resolveServerPath("npx", [
  "-y",
  "@modelcontextprotocol/server-memory",
]);
console.log("Package:", resolved.packageName);
console.log(
  "Local path:",
  resolved.localModulePath || "(not installed locally)",
);
```

### TCP Proxy Server

```javascript
import { MCPProxy } from "./index.js";

const proxy = new MCPProxy({ port: 9876 });

proxy.on("listening", ({ host, port }) => {
  console.log(`Proxy listening on ${host}:${port}`);
});

proxy.on("connection", ({ id }) => {
  console.log(`New connection: ${id}`);
});

await proxy.start();
```

Clients connect via TCP and send JSON commands:

```json
{"type": "connect", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"]}
{"type": "message", "payload": {"jsonrpc": "2.0", "id": 1, "method": "initialize", ...}}
{"type": "disconnect"}
```

## API

### `testConnection(command, args, framingType, timeout)`

Test an MCP server connection with specific framing.

- **command**: Executable to run (e.g., 'npx', 'node')
- **args**: Array of arguments
- **framingType**: `FramingType.LINE_DELIMITED` or `FramingType.CONTENT_LENGTH`
- **timeout**: Connection timeout in milliseconds

Returns a `DiagnosticResult` with detailed diagnostics.

### `detectFraming(command, args, timeout)`

Automatically detect which framing type a server uses.

### `resolveServerPath(command, args)`

Resolve an MCP server command to an executable path. Useful for:

- Detecting npx packages
- Finding locally installed packages
- Optimizing startup by using direct node execution

### `MCPProxy`

TCP-to-stdio proxy server for reliable MCP communication.

```javascript
const proxy = new MCPProxy({
  port: 9876, // 0 = auto-assign
  host: "127.0.0.1",
});
```

Events:

- `listening` - Server started
- `connection` - New client connected
- `disconnection` - Client disconnected

## Integration with Workbench

Workbench can use pipewrench in two ways:

1. **Diagnostic Mode** - Run tests before connecting to identify issues
2. **Proxy Mode** - Route MCP connections through the TCP proxy

This solves the Windows-specific stdio issues that plague Electron-based MCP clients.

## Running Tests

```bash
npm test
```
