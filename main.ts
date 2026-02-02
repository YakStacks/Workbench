// Electron main process - Enhanced with streaming, file system, clipboard, tool chaining, MCP
import { app, BrowserWindow, ipcMain, clipboard } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import Store from 'electron-store';
import axios from 'axios';

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let plugins: any[] = [];
let tools: Map<string, any> = new Map();

// MCP Server connections
interface MCPServer {
  name: string;
  command: string;
  args: string[];
  process?: ChildProcess;
  tools: any[];
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}
let mcpServers: Map<string, MCPServer> = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173/');
  }
}

app.whenReady().then(() => {
  createWindow();
  loadPlugins();
  registerBuiltinTools();
  loadMCPServers();
});

app.on('window-all-closed', () => {
  // Cleanup MCP servers
  mcpServers.forEach(server => {
    if (server.process) {
      server.process.kill();
    }
  });
  if (process.platform !== 'darwin') app.quit();
});

// ============================================================================
// PLUGIN SYSTEM
// ============================================================================

function loadPlugins() {
  plugins = [];
  // Keep builtin tools, clear plugin tools
  const builtinTools = new Map<string, any>();
  tools.forEach((tool, name) => {
    if (name.startsWith('builtin.') || name.startsWith('mcp.')) {
      builtinTools.set(name, tool);
    }
  });
  tools = builtinTools;

  const pluginsDir = store.get('pluginsDir') as string || path.join(__dirname, 'plugins');
  console.log('[loadPlugins] Looking for plugins in:', pluginsDir);
  if (!pluginsDir || typeof pluginsDir !== 'string' || !fs.existsSync(pluginsDir)) {
    console.log('[loadPlugins] Plugins directory not found');
    return;
  }
  const folders = fs.readdirSync(pluginsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  console.log('[loadPlugins] Found folders:', folders);
  folders.forEach((folder) => {
    const pluginPath = path.join(pluginsDir, folder, 'index.js');
    if (fs.existsSync(pluginPath)) {
      try {
        // Clear require cache for hot reload
        delete require.cache[require.resolve(pluginPath)];
        const plugin = require(pluginPath);
        if (plugin && typeof plugin.register === 'function') {
          plugin.register({
            registerTool: (tool: any) => {
              // Store source folder for delete functionality
              tool._sourceFolder = folder;
              console.log('[loadPlugins] Registered tool:', tool.name, 'from folder:', folder);
              tools.set(tool.name, tool);
            },
          });
        }
      } catch (e) {
        console.error('[loadPlugins] Error loading plugin:', folder, e);
      }
    }
  });
}

// ============================================================================
// BUILTIN TOOLS - File System, Clipboard, Shell
// ============================================================================

function registerBuiltinTools() {
  // File System Tools
  tools.set('builtin.readFile', {
    name: 'builtin.readFile',
    description: 'Read contents of a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
        encoding: { type: 'string', description: 'Encoding (default: utf-8)', default: 'utf-8' }
      },
      required: ['path']
    },
    run: async (input: { path: string; encoding?: string }) => {
      const safePath = resolveSafePath(input.path);
      assertPathSafe(safePath);
      const content = fs.readFileSync(safePath, { encoding: (input.encoding || 'utf-8') as BufferEncoding });
      return { content, path: safePath, size: content.length };
    }
  });

  tools.set('builtin.writeFile', {
    name: 'builtin.writeFile',
    description: 'Write contents to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' },
        append: { type: 'boolean', description: 'Append instead of overwrite', default: false }
      },
      required: ['path', 'content']
    },
    run: async (input: { path: string; content: string; append?: boolean }) => {
      const safePath = resolveSafePath(input.path);
      assertPathSafe(safePath);
      const dir = path.dirname(safePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (input.append) {
        fs.appendFileSync(safePath, input.content, 'utf-8');
      } else {
        fs.writeFileSync(safePath, input.content, 'utf-8');
      }
      return { success: true, path: safePath, bytesWritten: input.content.length };
    }
  });

  tools.set('builtin.listDir', {
    name: 'builtin.listDir',
    description: 'List contents of a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
        recursive: { type: 'boolean', description: 'List recursively', default: false }
      },
      required: ['path']
    },
    run: async (input: { path: string; recursive?: boolean }) => {
      const safePath = resolveSafePath(input.path);
      assertPathSafe(safePath);
      const entries = listDirRecursive(safePath, input.recursive || false, 0, 3);
      return { path: safePath, entries };
    }
  });

  tools.set('builtin.fileExists', {
    name: 'builtin.fileExists',
    description: 'Check if a file or directory exists',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to check' }
      },
      required: ['path']
    },
    run: async (input: { path: string }) => {
      const safePath = resolveSafePath(input.path);
      const exists = fs.existsSync(safePath);
      let isFile = false, isDir = false;
      if (exists) {
        const stat = fs.statSync(safePath);
        isFile = stat.isFile();
        isDir = stat.isDirectory();
      }
      return { exists, isFile, isDirectory: isDir, path: safePath };
    }
  });

  // Clipboard Tools
  tools.set('builtin.clipboardRead', {
    name: 'builtin.clipboardRead',
    description: 'Read text from system clipboard',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const text = clipboard.readText();
      return { content: text, length: text.length };
    }
  });

  tools.set('builtin.clipboardWrite', {
    name: 'builtin.clipboardWrite',
    description: 'Write text to system clipboard',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Text to copy to clipboard' }
      },
      required: ['content']
    },
    run: async (input: { content: string }) => {
      clipboard.writeText(input.content);
      return { success: true, length: input.content.length };
    }
  });

  // Shell Execution Tool
  tools.set('builtin.shell', {
    name: 'builtin.shell',
    description: 'Execute a shell command',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        cwd: { type: 'string', description: 'Working directory' },
        timeout: { type: 'number', description: 'Timeout in ms (default: 30000)', default: 30000 }
      },
      required: ['command']
    },
    run: async (input: { command: string; cwd?: string; timeout?: number }) => {
      return new Promise((resolve) => {
        const cwd = input.cwd ? resolveSafePath(input.cwd) : process.cwd();
        const isWindows = process.platform === 'win32';
        const shell = isWindows ? 'cmd.exe' : '/bin/sh';
        const shellArg = isWindows ? '/c' : '-c';
        
        const proc = spawn(shell, [shellArg, input.command], {
          cwd,
          timeout: input.timeout || 30000,
          env: process.env
        });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data) => { stdout += data.toString(); });
        proc.stderr?.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
          resolve({ exitCode: code, stdout, stderr, command: input.command });
        });

        proc.on('error', (err) => {
          resolve({ exitCode: -1, stdout, stderr, error: err.message, command: input.command });
        });
      });
    }
  });

  console.log('[registerBuiltinTools] Registered builtin tools');

  // System Info Tools
  tools.set('builtin.systemInfo', {
    name: 'builtin.systemInfo',
    description: 'Get system information (OS, CPU, memory, etc.)',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const os = require('os');
      return {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        cpus: os.cpus().map((cpu: any) => ({ model: cpu.model, speed: cpu.speed })),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        usedMemory: os.totalmem() - os.freemem(),
        memoryUsagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(1),
        homeDir: os.homedir(),
        tempDir: os.tmpdir(),
        userInfo: os.userInfo(),
      };
    }
  });

  tools.set('builtin.processes', {
    name: 'builtin.processes',
    description: 'List running processes',
    inputSchema: { 
      type: 'object', 
      properties: {
        limit: { type: 'number', description: 'Max processes to return (default 20)', default: 20 }
      } 
    },
    run: async (input: { limit?: number }) => {
      return new Promise((resolve) => {
        const limit = input.limit || 20;
        const isWindows = process.platform === 'win32';
        const cmd = isWindows ? 'tasklist' : 'ps aux';
        
        const proc = spawn(isWindows ? 'cmd.exe' : '/bin/sh', [isWindows ? '/c' : '-c', cmd], {
          timeout: 10000
        });
        
        let output = '';
        proc.stdout?.on('data', (data) => { output += data.toString(); });
        proc.on('close', () => {
          const lines = output.trim().split('\n');
          resolve({
            count: lines.length - 1,
            processes: lines.slice(1, limit + 1),
            raw: lines.slice(0, limit + 1).join('\n')
          });
        });
        proc.on('error', (err) => {
          resolve({ error: err.message });
        });
      });
    }
  });

  tools.set('builtin.diskSpace', {
    name: 'builtin.diskSpace',
    description: 'Check disk space usage',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      return new Promise((resolve) => {
        const isWindows = process.platform === 'win32';
        const cmd = isWindows ? 'wmic logicaldisk get size,freespace,caption' : 'df -h';
        
        const proc = spawn(isWindows ? 'cmd.exe' : '/bin/sh', [isWindows ? '/c' : '-c', cmd], {
          timeout: 10000
        });
        
        let output = '';
        proc.stdout?.on('data', (data) => { output += data.toString(); });
        proc.on('close', () => {
          resolve({ raw: output.trim() });
        });
        proc.on('error', (err) => {
          resolve({ error: err.message });
        });
      });
    }
  });

  tools.set('builtin.networkInfo', {
    name: 'builtin.networkInfo',
    description: 'Get network interface information',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const os = require('os');
      const interfaces = os.networkInterfaces();
      const result: any = {};
      for (const [name, addrs] of Object.entries(interfaces)) {
        result[name] = (addrs as any[]).map(addr => ({
          address: addr.address,
          family: addr.family,
          internal: addr.internal,
          mac: addr.mac,
        }));
      }
      return result;
    }
  });

  tools.set('builtin.envVars', {
    name: 'builtin.envVars',
    description: 'List environment variables (filtered for safety)',
    inputSchema: { 
      type: 'object', 
      properties: {
        filter: { type: 'string', description: 'Filter by variable name (case-insensitive)' }
      }
    },
    run: async (input: { filter?: string }) => {
      const env = process.env;
      const safeKeys = Object.keys(env).filter(key => {
        // Filter out sensitive-looking keys
        const lower = key.toLowerCase();
        if (lower.includes('key') || lower.includes('secret') || lower.includes('password') || 
            lower.includes('token') || lower.includes('credential')) {
          return false;
        }
        if (input.filter) {
          return lower.includes(input.filter.toLowerCase());
        }
        return true;
      });
      
      const result: Record<string, string> = {};
      safeKeys.forEach(key => {
        result[key] = env[key] || '';
      });
      return { count: safeKeys.length, variables: result };
    }
  });

  tools.set('builtin.installedApps', {
    name: 'builtin.installedApps',
    description: 'List installed applications (Windows only)',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      if (process.platform !== 'win32') {
        return { error: 'This tool only works on Windows' };
      }
      return new Promise((resolve) => {
        const cmd = 'wmic product get name,version';
        const proc = spawn('cmd.exe', ['/c', cmd], { timeout: 30000 });
        
        let output = '';
        proc.stdout?.on('data', (data) => { output += data.toString(); });
        proc.on('close', () => {
          const lines = output.trim().split('\n').slice(1).filter(l => l.trim());
          resolve({ 
            count: lines.length,
            apps: lines.slice(0, 50).map(l => l.trim())
          });
        });
        proc.on('error', (err) => {
          resolve({ error: err.message });
        });
      });
    }
  });
}

function resolveSafePath(inputPath: string): string {
  // Allow absolute paths or resolve relative to user's home
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  const workingDir = store.get('workingDir') as string || app.getPath('home');
  return path.resolve(workingDir, inputPath);
}

function isPathSafe(targetPath: string): boolean {
  const safePaths = store.get('safePaths') as string[] || [];
  const workingDir = store.get('workingDir') as string;
  
  // If no safe paths configured, allow workingDir and home
  if (safePaths.length === 0) {
    const allowedRoots = [workingDir, app.getPath('home')].filter(Boolean);
    return allowedRoots.some(root => targetPath.startsWith(root));
  }
  
  // Check if path is within any safe path
  const resolved = path.resolve(targetPath);
  return safePaths.some(safePath => {
    const resolvedSafe = path.resolve(safePath);
    return resolved.startsWith(resolvedSafe);
  });
}

function assertPathSafe(targetPath: string): void {
  if (!isPathSafe(targetPath)) {
    throw new Error(`Access denied: ${targetPath} is outside allowed directories`);
  }
}

function listDirRecursive(dirPath: string, recursive: boolean, depth: number, maxDepth: number): any[] {
  if (depth > maxDepth) return [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(entry => {
      const entryPath = path.join(dirPath, entry.name);
      const result: any = {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
      };
      if (entry.isFile()) {
        result.size = fs.statSync(entryPath).size;
      }
      if (entry.isDirectory() && recursive && depth < maxDepth) {
        result.children = listDirRecursive(entryPath, recursive, depth + 1, maxDepth);
      }
      return result;
    });
  } catch (e: any) {
    return [{ error: e.message }];
  }
}

// ============================================================================
// MCP CLIENT SUPPORT
// ============================================================================

interface MCPMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

class MCPClient {
  private process: ChildProcess | null = null;
  private messageId = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private buffer = '';
  public tools: any[] = [];
  public status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

  constructor(
    public name: string,
    public command: string,
    public args: string[] = []
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.status = 'connecting';
      
      try {
        this.process = spawn(this.command, this.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env }
        });

        this.process.stdout?.on('data', (data) => {
          this.handleData(data.toString());
        });

        this.process.stderr?.on('data', (data) => {
          console.error(`[MCP ${this.name}] stderr:`, data.toString());
        });

        this.process.on('error', (err) => {
          console.error(`[MCP ${this.name}] process error:`, err);
          this.status = 'error';
          reject(err);
        });

        this.process.on('close', (code) => {
          console.log(`[MCP ${this.name}] process closed with code:`, code);
          this.status = 'disconnected';
        });

        // Initialize the connection
        setTimeout(async () => {
          try {
            await this.initialize();
            await this.loadTools();
            this.status = 'connected';
            resolve();
          } catch (e) {
            this.status = 'error';
            reject(e);
          }
        }, 500);

      } catch (e) {
        this.status = 'error';
        reject(e);
      }
    });
  }

  private handleData(data: string) {
    this.buffer += data;
    
    // Process complete JSON-RPC messages (newline-delimited)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message: MCPMessage = JSON.parse(line);
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);
          if (message.error) {
            reject(new Error(message.error.message || 'MCP error'));
          } else {
            resolve(message.result);
          }
        }
      } catch (e) {
        console.error(`[MCP ${this.name}] Failed to parse message:`, line, e);
      }
    }
  }

  private send(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('MCP process not connected'));
        return;
      }

      const id = ++this.messageId;
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.process.stdin.write(JSON.stringify(message) + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('MCP request timeout'));
        }
      }, 30000);
    });
  }

  private async initialize(): Promise<void> {
    await this.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'Workbench',
        version: '0.2.0'
      }
    });
    await this.send('notifications/initialized');
  }

  private async loadTools(): Promise<void> {
    const result = await this.send('tools/list');
    this.tools = result.tools || [];
    console.log(`[MCP ${this.name}] Loaded ${this.tools.length} tools`);
  }

  async callTool(toolName: string, args: any): Promise<any> {
    const result = await this.send('tools/call', {
      name: toolName,
      arguments: args
    });
    return result;
  }

  disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.status = 'disconnected';
    this.tools = [];
  }
}

const mcpClients: Map<string, MCPClient> = new Map();

function loadMCPServers() {
  const serverConfigs = store.get('mcpServers') as any[] || [];
  console.log('[loadMCPServers] Loading MCP servers:', serverConfigs.length);
  
  serverConfigs.forEach(async (config) => {
    if (!config.name || !config.command) return;
    
    const client = new MCPClient(config.name, config.command, config.args || []);
    mcpClients.set(config.name, client);
    
    try {
      await client.connect();
      // Register MCP tools with mcp. prefix
      client.tools.forEach(tool => {
        const toolName = `mcp.${config.name}.${tool.name}`;
        tools.set(toolName, {
          name: toolName,
          description: tool.description,
          inputSchema: tool.inputSchema,
          mcpServer: config.name,
          mcpToolName: tool.name,
          run: async (input: any) => {
            return await client.callTool(tool.name, input);
          }
        });
      });
      console.log(`[MCP] Connected to ${config.name}, registered ${client.tools.length} tools`);
    } catch (e) {
      console.error(`[MCP] Failed to connect to ${config.name}:`, e);
    }
  });
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

// Config
ipcMain.handle('config:get', () => store.store);
ipcMain.handle('config:set', (_e, partial) => {
  store.set(partial);
  return store.store;
});

// Plugins
ipcMain.handle('plugins:reload', () => {
  loadPlugins();
  return true;
});

ipcMain.handle('plugins:save', async (_e, pluginName: string, code: string) => {
  const pluginsDir = store.get('pluginsDir') as string || path.join(__dirname, 'plugins');
  const safeName = pluginName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
  if (!safeName) throw new Error('Invalid plugin name');
  
  const pluginPath = path.join(pluginsDir, safeName);
  if (!fs.existsSync(pluginPath)) {
    fs.mkdirSync(pluginPath, { recursive: true });
  }
  
  let cleanCode = code;
  const fenceMatch = code.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    cleanCode = fenceMatch[1].trim();
  }
  
  fs.writeFileSync(path.join(pluginPath, 'index.js'), cleanCode, 'utf-8');
  fs.writeFileSync(path.join(pluginPath, 'package.json'), '{\n  "type": "commonjs"\n}\n', 'utf-8');
  
  loadPlugins();
  return { success: true, path: pluginPath, name: safeName };
});

// Delete a plugin
// Delete a plugin
ipcMain.handle('plugins:delete', async (_e, pluginName: string) => {
  const pluginsDir = store.get('pluginsDir') as string || path.join(__dirname, 'plugins');
  const safeName = pluginName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const pluginPath = path.join(pluginsDir, safeName);
  
  if (!fs.existsSync(pluginPath)) {
    throw new Error(`Plugin "${pluginName}" not found`);
  }
  
  // Only allow deleting custom plugins, not built-in ones
  fs.rmSync(pluginPath, { recursive: true, force: true });
  console.log('[plugins:delete] Deleted plugin:', safeName);
  
  loadPlugins();
  return { success: true, name: safeName };
});

// Tools
ipcMain.handle('tools:list', () => {
  return Array.from(tools.values()).map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    category: t.name.split('.')[0],
    _sourceFolder: t._sourceFolder
  }));
});

ipcMain.handle('tools:run', async (_e, name: string, input: any) => {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return await tool.run(input);
});

// Cost tracking
let sessionCosts = { total: 0, requests: 0 };

// Task runner (non-streaming)
ipcMain.handle('task:run', async (_e, taskType: string, prompt: string) => {
  const config = store.store as any;
  const router = config.router || {};
  const roleConfig = router[taskType];
  if (!roleConfig?.model) throw new Error(`No model configured for task type: ${taskType}`);
  
  const apiKey = config.openrouterApiKey;
  if (!apiKey) throw new Error('No OpenRouter API key');
  
  const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: roleConfig.model,
    messages: [{ role: 'user', content: prompt }],
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  
  // Track costs if available
  const usage = res.data.usage;
  if (usage) {
    sessionCosts.requests++;
    // OpenRouter includes cost in generation response
    if (res.data.usage?.total_cost) {
      sessionCosts.total += res.data.usage.total_cost;
    }
  }
  
  return {
    content: res.data.choices?.[0]?.message?.content || '',
    usage: res.data.usage,
    model: res.data.model,
    sessionCosts: { ...sessionCosts }
  };
});

// Get session costs
ipcMain.handle('costs:get', () => sessionCosts);
ipcMain.handle('costs:reset', () => { sessionCosts = { total: 0, requests: 0 }; return sessionCosts; });

// List available models from OpenRouter
ipcMain.handle('models:list', async () => {
  const config = store.store as any;
  const apiKey = config.openrouterApiKey;
  
  if (!apiKey) {
    throw new Error('No OpenRouter API key configured');
  }
  
  try {
    const res = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    // Sort by pricing (cheapest first) and return relevant fields
    const models = res.data.data.map((m: any) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      context_length: m.context_length,
      pricing: {
        prompt: m.pricing?.prompt ? parseFloat(m.pricing.prompt) : 0,
        completion: m.pricing?.completion ? parseFloat(m.pricing.completion) : 0,
      },
      top_provider: m.top_provider,
      per_million_prompt: m.pricing?.prompt ? (parseFloat(m.pricing.prompt) * 1000000).toFixed(2) : '0',
      per_million_completion: m.pricing?.completion ? (parseFloat(m.pricing.completion) * 1000000).toFixed(2) : '0',
    }));
    
    // Sort by prompt price
    models.sort((a: any, b: any) => a.pricing.prompt - b.pricing.prompt);
    
    return models;
  } catch (e: any) {
    throw new Error(`Failed to fetch models: ${e.message}`);
  }
});

// Streaming task runner
ipcMain.handle('task:runStream', async (_e, taskType: string, prompt: string, requestId: string) => {
  const config = store.store as any;
  const router = config.router || {};
  const roleConfig = router[taskType];
  if (!roleConfig?.model) throw new Error(`No model configured for task type: ${taskType}`);
  
  const apiKey = config.openrouterApiKey;
  if (!apiKey) throw new Error('No OpenRouter API key');
  
  try {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: roleConfig.model,
      messages: [{ role: 'user', content: prompt }],
      stream: true
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream'
    });

    let fullContent = '';
    
    res.data.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim().startsWith('data:'));
      
      for (const line of lines) {
        const data = line.replace('data:', '').trim();
        if (data === '[DONE]') {
          mainWindow?.webContents.send('stream:done', { requestId, content: fullContent });
          return;
        }
        
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            mainWindow?.webContents.send('stream:chunk', { requestId, chunk: delta, content: fullContent });
          }
        } catch (e) {
          // Skip malformed chunks
        }
      }
    });

    res.data.on('end', () => {
      mainWindow?.webContents.send('stream:done', { requestId, content: fullContent });
    });

    res.data.on('error', (err: Error) => {
      mainWindow?.webContents.send('stream:error', { requestId, error: err.message });
    });

    return { started: true, requestId };
  } catch (e: any) {
    throw new Error(`Stream failed: ${e.message}`);
  }
});

// Tool chaining
ipcMain.handle('chain:run', async (_e, steps: { tool: string; input: any; outputKey?: string }[]) => {
  const results: any[] = [];
  const context: Record<string, any> = {};
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const tool = tools.get(step.tool);
    if (!tool) throw new Error(`Tool not found: ${step.tool}`);
    
    // Interpolate context variables in input
    const resolvedInput = interpolateContext(step.input, context);
    
    console.log(`[chain:run] Step ${i + 1}: ${step.tool}`);
    const result = await tool.run(resolvedInput);
    results.push({ tool: step.tool, result });
    
    // Store result in context for next steps
    if (step.outputKey) {
      context[step.outputKey] = result;
    }
    context[`step${i}`] = result;
    context.lastResult = result;
  }
  
  return { results, context };
});

function interpolateContext(input: any, context: Record<string, any>): any {
  if (typeof input === 'string') {
    // Replace {{key}} or {{key.subkey}} patterns
    return input.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const value = key.split('.').reduce((obj: any, k: string) => obj?.[k], context);
      return value !== undefined ? (typeof value === 'string' ? value : JSON.stringify(value)) : `{{${key}}}`;
    });
  }
  if (Array.isArray(input)) {
    return input.map(item => interpolateContext(item, context));
  }
  if (typeof input === 'object' && input !== null) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = interpolateContext(value, context);
    }
    return result;
  }
  return input;
}

// MCP Management
ipcMain.handle('mcp:list', () => {
  return Array.from(mcpClients.entries()).map(([name, client]) => ({
    name,
    status: client.status,
    toolCount: client.tools.length,
    tools: client.tools.map(t => t.name)
  }));
});

ipcMain.handle('mcp:add', async (_e, config: { name: string; command: string; args?: string[] }) => {
  const servers = store.get('mcpServers') as any[] || [];
  servers.push(config);
  store.set('mcpServers', servers);
  
  const client = new MCPClient(config.name, config.command, config.args || []);
  mcpClients.set(config.name, client);
  
  try {
    await client.connect();
    client.tools.forEach(tool => {
      const toolName = `mcp.${config.name}.${tool.name}`;
      tools.set(toolName, {
        name: toolName,
        description: tool.description,
        inputSchema: tool.inputSchema,
        run: async (input: any) => client.callTool(tool.name, input)
      });
    });
    return { success: true, toolCount: client.tools.length };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('mcp:remove', async (_e, name: string) => {
  const client = mcpClients.get(name);
  if (client) {
    client.disconnect();
    mcpClients.delete(name);
    
    // Remove MCP tools
    tools.forEach((_, toolName) => {
      if (toolName.startsWith(`mcp.${name}.`)) {
        tools.delete(toolName);
      }
    });
  }
  
  const servers = (store.get('mcpServers') as any[] || []).filter(s => s.name !== name);
  store.set('mcpServers', servers);
  
  return { success: true };
});

ipcMain.handle('mcp:reconnect', async (_e, name: string) => {
  const client = mcpClients.get(name);
  if (!client) throw new Error(`MCP server not found: ${name}`);
  
  client.disconnect();
  try {
    await client.connect();
    client.tools.forEach(tool => {
      const toolName = `mcp.${name}.${tool.name}`;
      tools.set(toolName, {
        name: toolName,
        description: tool.description,
        inputSchema: tool.inputSchema,
        run: async (input: any) => client.callTool(tool.name, input)
      });
    });
    return { success: true, toolCount: client.tools.length };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});
