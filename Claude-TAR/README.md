# Workbench v0.2.0

A local-first AI task runner with MCP support, streaming responses, tool chaining, and a plugin system. Think Goose or Claude Cowork, but cheaper and hackable.

## Features

### Core
- **Streaming Responses** - Real-time output as the LLM generates
- **Role-Based Model Routing** - Route tasks to different models via OpenRouter (cheap vs quality)
- **Tool Chaining** - Pipe outputs between tools with `{{variable}}` interpolation
- **Plugin System** - Create custom tools with a simple CommonJS API

### Built-in Tools
- **File System** - `readFile`, `writeFile`, `listDir`, `fileExists`
- **Clipboard** - `clipboardRead`, `clipboardWrite`  
- **Shell** - Execute bash/cmd commands

### MCP Integration
- Connect to any MCP server (filesystem, GitHub, Brave Search, SQLite, etc.)
- MCP tools automatically appear in the Tools tab with `mcp.servername.toolname` prefix
- Manage servers from the MCP tab - add, remove, reconnect

### Artifact Converter
- Paste Claude artifacts or React components
- Auto-converts them to Workbench plugins via LLM
- One-click save to your plugins directory

## Installation

```bash
npm install
```

## Usage

### Development Mode
```bash
npm run dev
```
Starts both Vite (hot reload) and Electron.

### Production Build
```bash
npm run build && npm start
```

### Package for Distribution
```bash
npm run package        # Windows
npm run package:all    # Windows, Mac, Linux
```

## Tabs

### Chat
Simple streaming chat interface. Select a model role, type a prompt, get a response. Ctrl+Enter to send.

### Tools
Browse and run all available tools:
- **builtin.*** - File system, clipboard, shell
- **mcp.*** - Tools from connected MCP servers
- **clinical.*** - Custom domain plugins (ASAM tools, etc.)
- **workbench.*** - Meta tools (artifact converter)

Click a tool to see its schema and run it. "Run with LLM" sends the tool's prompt output through your configured model.

### Chains
Build multi-step workflows:
1. Add steps
2. Select a tool for each step
3. Use `{{outputKey}}` to reference previous step outputs
4. Run the chain

Example chain:
```
Step 1: builtin.readFile → { path: "notes.txt" } → fileContent
Step 2: clinical.asamUpdater → { previousASAM: "{{fileContent.content}}" } → asamResult  
Step 3: builtin.clipboardWrite → { content: "{{lastResult.prompt}}" }
```

### MCP
Manage MCP server connections:
- Add servers by name, command, and arguments
- View connection status and available tools
- Reconnect or remove servers

Popular servers:
```
Filesystem: npx -y @modelcontextprotocol/server-filesystem /path
GitHub: npx -y @modelcontextprotocol/server-github
Brave Search: npx -y @modelcontextprotocol/server-brave-search
SQLite: npx -y @modelcontextprotocol/server-sqlite /path/db.sqlite
Memory: npx -y @modelcontextprotocol/server-memory
```

### Settings
- OpenRouter API key
- Model routing (which model handles which task type)
- Working directory for file operations
- Plugins directory

## Creating Plugins

Plugins are CommonJS modules in the `plugins/` directory:

```javascript
// plugins/myTool/index.js
module.exports.register = (api) => {
  api.registerTool({
    name: 'custom.myTool',
    description: 'Does something useful',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'The input text' }
      },
      required: ['input']
    },
    run: async (input) => {
      // Option A: Return data directly
      return { result: input.input.toUpperCase() };
      
      // Option B: Return a prompt for LLM processing
      return {
        prompt: `Process this: ${input.input}`,
        metadata: {
          suggestedRole: 'writer_cheap'
        }
      };
    }
  });
};
```

Each plugin folder needs a `package.json`:
```json
{
  "type": "commonjs"
}
```

## Model Routing

Configure different models for different task types in Settings:

| Role | Use Case | Suggested Model |
|------|----------|-----------------|
| writer_cheap | General text, summaries | `anthropic/claude-3-haiku` |
| structurer | JSON, structured output | `anthropic/claude-3-haiku` |
| coder_cheap | Code generation | `deepseek/deepseek-coder` |
| reviewer | Quality review | `anthropic/claude-3-sonnet` |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Electron Main                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Plugins   │  │   Builtin   │  │     MCP     │  │
│  │   System    │  │    Tools    │  │   Clients   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│           │              │               │           │
│           └──────────────┼───────────────┘           │
│                          ▼                           │
│               ┌─────────────────┐                    │
│               │  Tool Registry  │                    │
│               └─────────────────┘                    │
│                          │                           │
│           ┌──────────────┼──────────────┐           │
│           ▼              ▼              ▼           │
│    ┌───────────┐  ┌───────────┐  ┌───────────┐     │
│    │  Task     │  │   Tool    │  │   Chain   │     │
│    │  Runner   │  │  Runner   │  │  Runner   │     │
│    │(Streaming)│  │           │  │           │     │
│    └───────────┘  └───────────┘  └───────────┘     │
│           │              │              │           │
│           └──────────────┼──────────────┘           │
│                          ▼                           │
│               ┌─────────────────┐                    │
│               │   OpenRouter    │                    │
│               └─────────────────┘                    │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│  ┌────┐ ┌─────┐ ┌──────┐ ┌────┐ ┌────────┐        │
│  │Chat│ │Tools│ │Chains│ │MCP │ │Settings│        │
│  └────┘ └─────┘ └──────┘ └────┘ └────────┘        │
└─────────────────────────────────────────────────────┘
```

## Roadmap

- [ ] Conversation history / multi-turn chat
- [ ] Global hotkey launcher
- [ ] Template variables ({{today}}, {{clipboard}})
- [ ] Plugin marketplace
- [ ] Chain templates / presets
- [ ] Cost tracking per task

## License

MIT
