// Electron main process
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';
import axios from 'axios';


const store = new Store();
let mainWindow: BrowserWindow | null = null;
let plugins: any[] = [];
let tools: any[] = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function loadPlugins() {
  plugins = [];
  tools = [];
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
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const plugin = require(pluginPath);
        if (plugin && typeof plugin.register === 'function') {
          plugin.register({
            registerTool: (tool: any) => {
              console.log('[loadPlugins] Registered tool:', tool.name);
              tools.push(tool);
            },
          });
        }
      } catch (e) {
        console.error('[loadPlugins] Error loading plugin:', folder, e);
      }
    } else {
      console.log('[loadPlugins] Plugin index.js not found:', pluginPath);
    }
  });
}

// IPC handlers
ipcMain.handle('config:get', () => store.store);
ipcMain.handle('config:set', (_e, partial) => {
  store.set(partial);
  return store.store;
});
ipcMain.handle('plugins:reload', () => {
  loadPlugins();
  return true;
});
ipcMain.handle('tools:list', () => tools.map(t => ({ name: t.name, inputSchema: t.inputSchema })));
ipcMain.handle('tools:run', async (_e, name, input) => {
  const tool = tools.find(t => t.name === name);
  if (!tool) throw new Error('Tool not found');
  return await tool.run(input);
});

// Task runner with role-based model selection
ipcMain.handle('task:run', async (_e, taskType: string, prompt: string) => {
  const config = store.store;
  const router = config.router || {};
  const roleConfig = router[taskType];
  if (!roleConfig?.model) throw new Error(`No model configured for task type: ${taskType}`);
  const model = roleConfig.model;
  const apiKey = config.openrouterApiKey;
  if (!apiKey) throw new Error('No OpenRouter API key');
  console.log('[task:run] Task type:', taskType, 'Model:', model);
  // (Token counting is not implemented, just log fake value)
  console.log('[task:run] Prompt tokens: (fake)');
  const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model,
    messages: [{ role: 'user', content: prompt }],
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  const data = res.data;
  // Extract message content from response
  const content = data.choices?.[0]?.message?.content || '';
  return { content, usage: data.usage, model: data.model };
});

// Save a generated plugin to disk
ipcMain.handle('plugins:save', async (_e, pluginName: string, code: string) => {
  const pluginsDir = store.get('pluginsDir') as string || path.join(__dirname, 'plugins');
  // Sanitize plugin name to be filesystem-safe
  const safeName = pluginName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
  if (!safeName) throw new Error('Invalid plugin name');
  
  const pluginPath = path.join(pluginsDir, safeName);
  
  // Create plugin directory
  if (!fs.existsSync(pluginPath)) {
    fs.mkdirSync(pluginPath, { recursive: true });
  }
  
  // Extract code from markdown fences if present
  let cleanCode = code;
  const fenceMatch = code.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    cleanCode = fenceMatch[1].trim();
  }
  
  // Write index.js
  fs.writeFileSync(path.join(pluginPath, 'index.js'), cleanCode, 'utf-8');
  
  // Write package.json
  fs.writeFileSync(path.join(pluginPath, 'package.json'), '{\n  "type": "commonjs"\n}\n', 'utf-8');
  
  console.log('[plugins:save] Saved plugin:', safeName);
  
  // Reload plugins to pick up the new one
  loadPlugins();
  
  return { success: true, path: pluginPath, name: safeName };
});

