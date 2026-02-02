# Workbench v0.3.0

A local-first AI task runner with messenger-style chat, AI-powered artifact generation, file browser/editor, MCP support, streaming responses, tool chaining, and a plugin system. Build tools by simply asking the AI - it generates, saves, and loads them automatically.

## ✨ Key Features

### 🤖 AI-Powered Tool Generation
- **Just ask and it builds** - "Build a tool that gives me the temperature" → AI generates working plugin code
- **Auto-save plugins** - Detects generated code and saves to plugins folder automatically  
- **Instant reload** - Restart to load new tools, no manual setup needed
- **Real API integration** - Generated tools use real APIs (weather, data, etc.)

### 💬 Chat (Messenger Style)
- **Conversation history** - Messages persist in a chat bubble UI
- **Multi-turn context** - Full conversation memory
- **Tool detection** - AI knows when to use tools vs just chat
- **Streaming responses** - Real-time output as the LLM generates
- **Role selection** - Choose Writer, Coder, Structurer, or Reviewer per conversation
- **Template variables** - Use `{{today}}`, `{{time}}`, `{{user}}`, `{{clipboard}}` in prompts

### 🔧 Tools System  
- **Browse all tools** - Automatically categorized by prefix (BUILTIN, your custom categories, WORKBENCH, etc.)
- **Run tools manually** - Fill parameters, run, see output
- **Refresh button** - Reload plugins without restarting the app
- **In-app editor** - Edit tool code directly in Tools tab, save and refresh
- **Test mode** - Dry-run tools to preview execution without actually running
- **Standardized responses** - All tools return `{ content, metadata?, error? }` format
- **Error handling** - User-friendly error messages with troubleshooting hints
- **Cost tracking** - Real-time display of API costs per conversation ($0.0024 / 3 reqs)

### 📁 File Browser & Editor
- **Safe path boundaries** - Configure which directories are accessible
- **Browse and navigate** - Full directory tree with breadcrumbs  
- **Edit files** - Built-in text editor with save detection
- **Quick access** - Dropdown to jump between configured safe paths

### 🔗 Tool Chaining
- **Multi-step workflows** - Pipe outputs between tools
- **Variable interpolation** - Use `{{variable}}` to reference previous results
- **Save presets** - One-click reuse of complex chains

### 🌐 MCP Integration
- **Model Context Protocol** - Connect to any MCP server
- **Auto-discovery** - MCP tools appear automatically with `mcp.servername.toolname` prefix
- **Popular servers** - Filesystem, GitHub, Brave Search, SQLite, Memory, and more

### 🎨 Modern UI
- **Full dark mode** - No white borders, clean dark theme throughout
- **Role explanations** - Settings shows what each worker type does
- **Better errors** - Clear messages like "No API key configured" with instructions

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API
1. Get an API key:
   - **OpenRouter**: https://openrouter.ai (access to 200+ models)
   - **OpenAI**: https://platform.openai.com (GPT models)
   - **Azure OpenAI**: Your Azure portal
2. Run the app: `npm run dev`
3. Go to **Settings** tab
4. Enter your **API Key**
5. Enter your **API Endpoint**:
   - OpenRouter: `https://openrouter.ai/api/v1` (default)
   - OpenAI: `https://api.openai.com/v1`
   - Azure: `https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT`
   - Local/Other: Any OpenAI-compatible endpoint
6. Click "Load Available Models" (OpenRouter only)
7. Assign models to each role (Writer, Structurer, Coder, Reviewer)
8. Click Save

### 3. Build Your First Tool
Go to the **Chat** tab and say:
```
Build a tool that gives me the temperature
```

The AI will:
- Generate the complete plugin code
- Automatically save it to `plugins/weather_temperature/`
- Tell you to restart

Restart the app and the tool appears in the **Tools** tab!

## 📖 Usage Guide

### Development Mode
```bash
npm run dev
```
Starts both Vite (hot reload) and Electron. The app will open automatically.

### Production Build
```bash
npm run build && npm start
```

### Package for Distribution
```bash
npm run package        # Windows only
npm run package:all    # Windows, Mac, Linux
```

## 🎯 How to Use Each Tab

### Chat Tab
**Purpose**: Talk to AI and build tools by describing what you want

**How to use:**
1. Select a role (Writer/Coder/Structurer/Reviewer) - hover for description in Settings
2. Type your request: "Build a tool that..." or "Create an artifact for..."
3. AI generates code and auto-saves it
4. Restart app to load new tools
5. Conversation history persists - AI remembers context

**Pro tips:**
- Be specific: "Build a tool that fetches weather from wttr.in API"
- AI generates complete, working code with real API calls
- Check the **Tools** tab after restart to see your new tool

### Tools Tab
**Purpose**: Browse and run all available tools manually

**Categories:**
- **BUILTIN** - Core file operations, clipboard, shell, system info
- **Custom categories** - Any tools you create appear here, organized by prefix (e.g., weather.*, data.*, finance.*)
- **WORKBENCH** - Meta tools like convertArtifact

**How to run a tool:**
1. Click a tool from the list
2. Fill in required parameters
3. Click "Run Tool" - see JSON output
4. Or click "Run with LLM" - sends output to AI for processing
5. Or click "Open in Chat" - starts conversation with this tool ready

### Files Tab
**Purpose**: Browse and edit files on your computer safely

**Setup:**
1. Go to Settings → Directories → Safe Paths
2. Add paths you want accessible (one per line)
3. Save settings
4. Return to Files tab

**Features:**
- Navigate directory tree
- Click files to open in editor
- Edit and save (auto-detects changes)
- Only accesses paths you configured

### Chains Tab  
**Purpose**: Build multi-step workflows that pipe data between tools

**How to build a chain:**
1. Click "Add Step"
2. Select a tool for each step
3. Fill parameters, use `{{outputKey}}` to reference previous steps
4. Click "Run Chain"
5. Save as preset for one-click reuse

**Example:**
```
Step 1: builtin.readFile → { path: "data.txt" } → fileData
Step 2: weather.temperature → { city: "{{fileData.content}}" } → weather
Step 3: builtin.clipboardWrite → { content: "{{weather.message}}" }
```

### MCP Tab
**Purpose**: Connect to Model Context Protocol servers for extra tools

**Popular MCP Servers:**
```bash
# Filesystem access
npx -y @modelcontextprotocol/server-filesystem /path/to/folder

# GitHub operations  
npx -y @modelcontextprotocol/server-github

# Web search
npx -y @modelcontextprotocol/server-brave-search

# Database
npx -y @modelcontextprotocol/server-sqlite /path/to/db.sqlite

# Memory/notes
npx -y @modelcontextprotocol/server-memory
```

**How to add:**
1. Enter server name
2. Enter command (e.g., `npx`)
3. Enter args (e.g., `-y @modelcontextprotocol/server-github`)
4. Click Add
5. Tools appear as `mcp.servername.toolname`

### Settings Tab
**Configure everything:**

**API Configuration:**
- API key (OpenRouter, OpenAI, Azure, etc.)
- API endpoint (supports any OpenAI-compatible API)
- Load available models button (OpenRouter only)

**Model Routing:**
- **writer_cheap** - General chat, content generation
- **structurer** - Data formatting, JSON output  
- **coder_cheap** - Plugin generation, code tasks
- **reviewer** - Quality checks, reviews

**Directories:**
- Working directory for file operations
- Plugins directory (default: `./plugins`)
- Safe paths for Files tab access

## 🛠️ Creating Plugins

### Automatic Way (Recommended)
Just ask the AI in Chat:
```
Build a tool that converts Celsius to Fahrenheit
```

AI generates, saves, you restart. Done!

### Manual Way
Create a folder in `plugins/` with this structure:

```
plugins/
  myTool/
    index.js
    package.json
```

**index.js:**
```javascript
module.exports.register = (api) => {
  api.registerTool({
    name: 'custom.myTool',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input text' }
      },
      required: ['input']
    },
    run: async (input) => {
      // MUST return standardized format
      return {
        content: `Result: ${input.input.toUpperCase()}`,
        metadata: {
          processedAt: new Date().toISOString()
        }
      };
    }
  });
};
```

**package.json:**
```json
{
  "type": "commonjs"
}
```

### Standard Response Format
**All tools MUST return:**
```typescript
{
  content: string | Array<{type: string, text: string}>,  // Required
  metadata?: object,  // Optional extra data
  error?: string      // Optional error details
}
```

**See [PLUGIN_API.md](PLUGIN_API.md) for complete documentation.**

### Using External APIs
```javascript
run: async (input) => {
  const fetch = (await import('node-fetch')).default;
  
  try {
    const response = await fetch(`https://api.example.com/data`);
    const data = await response.json();
    
    return {
      content: `Temperature: ${data.temp}°F`,
      metadata: data
    };
  } catch (error) {
    return {
      content: `Failed to fetch data: ${error.message}`,
      error: error.message
    };
  }
}
```

**Note:** Use dynamic import for ES modules: `(await import('module-name')).default`

## 🎛️ Model Routing

Configure different models for different task types in Settings:

| Role | Use Case | Default Model |
|------|----------|---------------|
| **writer_cheap** | General chat, content generation, conversations | `openai/gpt-4o-mini` |
| **structurer** | Data formatting, JSON, structured output | `qwen/qwen-2.5-coder-32b-instruct` |
| **coder_cheap** | Plugin generation, code tasks, technical work | `openai/gpt-4o-mini` |
| **reviewer** | Quality checks, reviews, validation | `arcee-ai/trinity-large-preview-free` |

**Cost Optimization:**
- Use cheap models for most tasks
- Use expensive models only for complex work
- Monitor costs in the future cost tracking feature

**Recommended Free/Cheap Models:**
- `openai/gpt-4o-mini` - Fast, cheap, good quality
- `qwen/qwen-2.5-coder-32b-instruct` - Excellent for structured output
- `google/gemini-flash-1.5` - Free tier available
- `anthropic/claude-3-haiku` - Good balance

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Electron Main Process               │
│                                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │           Plugin System                      │   │
│  │  • Auto-load from plugins/                   │   │
│  │  • Hot reload on save                        │   │
│  │  • Standard response normalization           │   │
│  └──────────────────────────────────────────────┘   │
│                          │                           │
│  ┌──────────────────────────────────────────────┐   │
│  │      Built-in Tools                          │   │
│  │  • File system (read/write/list)             │   │
│  │  • Clipboard (read/write)                    │   │
│  │  • Shell execution                           │   │
│  │  • System info                               │   │
│  └──────────────────────────────────────────────┘   │
│                          │                           │
│  ┌──────────────────────────────────────────────┐   │
│  │      MCP Clients                             │   │
│  │  • Connect to external MCP servers           │   │
│  │  • Auto-register tools as mcp.server.tool    │   │
│  │  • Status monitoring & reconnect             │   │
│  └──────────────────────────────────────────────┘   │
│                          │                           │
│                  ┌───────┴───────┐                   │
│                  │ Tool Registry │                   │
│                  │ (Normalized)  │                   │
│                  └───────┬───────┘                   │
│                          │                           │
│         ┌────────────────┼────────────────┐          │
│         ▼                ▼                ▼          │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│   │  Chat    │    │  Tools   │    │  Chain   │     │
│   │ Runner   │    │  Runner  │    │  Runner  │     │
│   │(Stream)  │    │          │    │          │     │
│   └────┬─────┘    └────┬─────┘    └────┬─────┘     │
│        └───────────────┼───────────────┘            │
│                        ▼                             │
│             ┌─────────────────────┐                  │
│             │   OpenRouter API    │                  │
│             │  (Model Routing)    │                  │
│             └─────────────────────┘                  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                React Frontend (Vite)                 │
│                                                       │
│  ┌────────┐ ┌─────────┐ ┌───────┐ ┌─────┐ ┌────┐   │
│  │ Chat   │ │ Tools   │ │Chains │ │ MCP │ │Set │   │
│  │ Tab    │ │ Tab     │ │ Tab   │ │ Tab │ │Tab │   │
│  │        │ │         │ │       │ │     │ │    │   │
│  │• Conv  │ │• Browse │ │• Build│ │•Add │ │•API│   │
│  │• Tool  │ │• Run    │ │• Save │ │•Mgmt│ │•Rte│   │
│  │  Auto  │ │• Manual │ │• Pipe │ │•Conn│ │•Dir│   │
│  └────────┘ └─────────┘ └───────┘ └─────┘ └────┘   │
└─────────────────────────────────────────────────────┘
```

## 📝 What Makes Workbench Different?

**vs Claude Desktop:**
- ✅ Multi-model routing (use cheap models for simple tasks)
- ✅ Local-first (your data stays on your PC)
- ✅ Plugin system (extend it yourself)
- ✅ AI generates tools for you
- ✅ Cost control (use free/cheap models)

**vs Cursor/Windsurf:**
- ✅ Not just for coding - general task automation
- ✅ Tool chaining (pipe data between tools)
- ✅ MCP integration (connect to any data source)
- ✅ Conversation-based workflow

**vs Custom API Scripts:**
- ✅ GUI for everything (no command line needed)
- ✅ Conversation history & context
- ✅ Auto-saving plugins
- ✅ Visual tool builder

## 🗺️ Roadmap & Future Ideas

### ✅ Completed  
- [x] Dark mode (no white borders)
- [x] AI-powered tool generation
- [x] Auto-save generated plugins
- [x] Standardized tool response format
- [x] Role explanations in Settings
- [x] Better error messages
- [x] Real API integration (weather example)
- [x] **Refresh Tools button** - Reload plugins without restart
- [x] **Cost tracking** - Real-time API costs per conversation
- [x] **Template variables** - {{today}}, {{time}}, {{user}}, {{clipboard}}
- [x] **In-app tool editor** - Edit plugin code in Tools tab
- [x] **Test mode** - Dry-run tools without execution
- [x] **5 General-use plugins** - URL Summarizer, CSV Analyzer, YouTube Transcript, File Watcher, Clipboard History

### 🚧 High Priority
- [ ] Tool versioning - Track changes to generated tools
- [ ] Better tool editing - Syntax highlighting in code editor
- [ ] Global hotkey launcher (Ctrl+Shift+Space to open anywhere)
- [ ] Export/import tools and chains

### 💡 Medium Priority
- [ ] Search - Find tools/conversations quickly
- [ ] Favorites - Pin frequently used tools
- [ ] Scheduled tasks - Run tools on a schedule
- [ ] Webhooks - Trigger tools from external events

### 🌟 Nice to Have
- [ ] Plugin marketplace - Browse and install community plugins
- [ ] Multi-file editing - Edit multiple files at once
- [ ] Database browser - Visual interface for SQLite/other DBs
- [ ] Git integration - Commit, push, pull from UI
- [ ] Export conversations - Save chat history

## 🤝 Contributing

Want to help? Here's what we need:

1. **More example plugins** - Share useful tools you've built
2. **Documentation improvements** - Make it easier for newcomers  
3. **Bug reports** - Found something broken? Let us know
4. **Feature requests** - What would make Workbench more useful?
5. **MCP server guides** - How to set up popular servers

## 📄 License

MIT - Do whatever you want with it!
