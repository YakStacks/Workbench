# Workbench

Local-first AI task runner. Build automations by chatting.

No cloud. No subscription. Your tools, your data, your machine.

![Workbench v2.0.0-dev](https://img.shields.io/badge/version-2.0.0--dev-blue)
![License MIT](https://img.shields.io/badge/license-MIT-green)
![Platform Windows](https://img.shields.io/badge/platform-Windows%20%7C%20Mac%20%7C%20Linux-lightgrey)

## 🎉 What's New in V2.0

Workbench V2.0 is a major upgrade focused on **Trust, Safety, and User Experience**:

- **🔐 Secrets Safety**: OS-level encrypted credential storage (Windows DPAPI, macOS Keychain, Linux Secret Service)
- **👁️ Dry Run / Preview Mode**: See what tools will do before they execute
- **📋 Tool Manifest Standard**: Standardized metadata for ecosystem hygiene
- **🧠 User Memory**: Opt-in learning system that remembers your preferences
- **🎯 Natural Language Tool Dispatch**: AI-powered tool selection from plain English
- **🌍 Environment Detection**: Clear messaging for supported/unsupported platforms

📚 **[Read the V2.0 Features Guide →](./V2_FEATURES_GUIDE.md)**  
⚡ **[Quick Reference →](./V2_QUICK_REFERENCE.md)**

---

## Why Workbench?

I built this because Goose was too hard to extend and Claude Desktop needed a Mac.

Workbench is the **cross-platform, open, easy-to-extend** alternative. Create new tools by asking AI to write them. Chain tools together. Run everything locally.

## Quickstart

```bash
git clone https://github.com/YakStacks/Workbench.git
cd Workbench
npm install
npm run dev
```

Add your API key in **Settings** tab (supports OpenRouter, OpenAI, or Azure OpenAI).

## What You Get

- 💬 **Chat** - Messenger-style AI conversation with tool access
- 🔧 **11 Built-in Tools** - Weather, clipboard, files, CSV analysis, and more
- ⛓️ **Tool Chains** - Connect tools with `{{lastResult}}` interpolation
- 🔌 **Plugin System** - Drop a folder in `plugins/`, restart, done
- 🛠️ **PipeWrench** - MCP server diagnostics built-in
- 📁 **File Browser** - Safe, sandboxed file access

## Features

### Chat with Tools

Ask the AI to use tools naturally:

> "What's the weather in Tokyo?"

The AI calls `weather.temperature`, gets the result, and responds conversationally.

### Tool Chains

Build multi-step automations in the Chains tab:

1. **Step 1:** `example.echo` → `{"text": "Hello"}` → saves to `step1`
2. **Step 2:** `example.currentTime` → `{}` → saves to `step2`

Reference previous results with `{{step1.content}}` or `{{lastResult}}`.

### Create Plugins by Chatting

Ask the AI:

> "Create a plugin that fetches the top story from Hacker News"

Copy the code to `plugins/hackernews/index.js`, restart, and your new tool appears.

## Built-in Tools

| Tool | Description |
|------|-------------|
| `example.echo` | Echo text back |
| `example.helloWorld` | Simple greeting |
| `example.currentTime` | Current date/time |
| `weather.temperature` | Weather by city |
| `system.clipboardHistory` | Clipboard access |
| `data.csvAnalyzer` | Parse and analyze CSVs |
| `web.urlSummary` | Summarize web pages |
| `media.youtubeTranscript` | Get YouTube transcripts |
| `system.fileWatcher` | Monitor file changes |
| `workbench.convertArtifact` | Convert Claude artifacts |
| `debug.mcpDoctor` | Diagnose MCP servers |
| `debug.mcpTrace` | Trace MCP protocol |
| `debug.mcpTest` | Quick MCP connection test |

Plus 12 `builtin.*` system tools for files, shell, clipboard, and more.

## Creating Plugins

Create a folder in `plugins/` with an `index.js`:

```javascript
// plugins/my-tool/index.js
module.exports.register = (api) => {
  api.registerTool({
    name: 'my.tool',
    description: 'Does something useful',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'The input' }
      },
      required: ['input']
    },
    run: async (params) => {
      return {
        content: `You said: ${params.input}`,
        metadata: { timestamp: new Date().toISOString() }
      };
    }
  });
};
```

Restart Workbench or click **Refresh Plugins**. Your tool appears in the Tools tab.

See [PLUGIN_API.md](PLUGIN_API.md) for the full guide.

## API Providers

Workbench supports multiple LLM providers. Configure in Settings:

| Provider | What You Need |
|----------|---------------|
| **OpenRouter** | API key from [openrouter.ai](https://openrouter.ai) |
| **OpenAI** | API key from [platform.openai.com](https://platform.openai.com) |
| **Azure OpenAI** | Endpoint URL, API key, deployment name |

OpenRouter is recommended - it gives you access to Claude, GPT-4, Llama, and dozens of other models with one API key.

## Building

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Package installer
npm run package          # Windows
npm run package:all      # All platforms
```

Installers output to `release/` folder.

## Project Structure

```
Workbench/
├── src/App.tsx       # React UI (single file)
├── main.ts           # Electron main process
├── plugins/          # Drop-in plugins
│   ├── echo/
│   ├── weather_temperature/
│   ├── pipewrench/
│   └── ...
├── build/            # Icons and assets
└── dist/             # Built frontend
```

## Roadmap

### v0.1.0 (Current)
- ✅ Chat with AI
- ✅ 11 plugins + builtin tools
- ✅ Tool chaining
- ✅ Plugin system
- ✅ PipeWrench diagnostics

### v0.2.0 (Planned)
- 📲 MCP server integration (via PipeWrench proxy)
- 📲 Chat persistence (SQLite)
- 📲 Natural language tool dispatch
- 📲 Keyboard shortcuts

## Known Issues

**MCP servers don't connect** - Electron has stdio pipe issues on Windows. Use PipeWrench standalone (`pipewrench proxy`) as a workaround, or wait for v0.2 which will include proper MCP support. See [MCP_KNOWN_ISSUES.md](MCP_KNOWN_ISSUES.md).

## License

MIT © 2025 YakStacks

---

**Any questions or concerns? Start a Discussion or submit an issue. I'd love to hear from you.**

**Local-first. Open source. Yours to extend.**
