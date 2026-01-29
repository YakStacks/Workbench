// Electron main process
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';


const store = new Store();
let mainWindow: BrowserWindow | null = null;
let plugins: any[] = [];
let tools: any[] = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadURL(
    app.isPackaged
      ? `file://${path.join(__dirname, 'dist/index.html')}`
      : 'http://localhost:5173/'
  );
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
  if (!pluginsDir || typeof pluginsDir !== 'string' || !fs.existsSync(pluginsDir)) return;
  const folders = fs.readdirSync(pluginsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  folders.forEach((folder) => {
    const pluginPath = path.join(pluginsDir, folder, 'index.js');
    if (fs.existsSync(pluginPath)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const plugin = require(pluginPath);
        if (plugin && typeof plugin.register === 'function') {
          plugin.register({
            registerTool: (tool: any) => tools.push(tool),
          });
        }
      } catch (e) {
        // Ignore plugin errors
      }
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

// Task runner
import fetch from 'node-fetch';
ipcMain.handle('task:run', async (_e, { taskType, prompt }) => {
  const config = store.store;
  const router = config.router as Record<string, { provider: string; model: string }> || {};
  const role = router[taskType];
  if (!role) throw new Error('No model mapped for this taskType');
  const { provider, model } = role;
  if (provider === 'openrouter') {
    const apiKey = config.openrouterApiKey;
    if (!apiKey) throw new Error('No OpenRouter API key');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    return data;
  }
  throw new Error('Unknown provider');
});
