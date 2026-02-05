// Electron preload script - Enhanced with streaming, tool chaining, and MCP
import { contextBridge, ipcRenderer } from 'electron';

// Stream event callbacks
type StreamCallback = (data: { requestId: string; chunk?: string; content?: string; error?: string }) => void;
const streamCallbacks: Map<string, { onChunk?: StreamCallback; onDone?: StreamCallback; onError?: StreamCallback }> = new Map();

// Listen for stream events from main process
ipcRenderer.on('stream:chunk', (_e, data) => {
  const callbacks = streamCallbacks.get(data.requestId);
  callbacks?.onChunk?.(data);
});

ipcRenderer.on('stream:done', (_e, data) => {
  const callbacks = streamCallbacks.get(data.requestId);
  callbacks?.onDone?.(data);
  streamCallbacks.delete(data.requestId);
});

ipcRenderer.on('stream:error', (_e, data) => {
  const callbacks = streamCallbacks.get(data.requestId);
  callbacks?.onError?.(data);
  streamCallbacks.delete(data.requestId);
});

contextBridge.exposeInMainWorld('workbench', {
  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial: any) => ipcRenderer.invoke('config:set', partial),

  // Plugins
  reloadPlugins: () => ipcRenderer.invoke('plugins:reload'),
  savePlugin: (pluginName: string, code: string) => ipcRenderer.invoke('plugins:save', pluginName, code),
  deletePlugin: (pluginName: string) => ipcRenderer.invoke('plugins:delete', pluginName),

  // Tools
  listTools: () => ipcRenderer.invoke('tools:list'),
  refreshTools: () => ipcRenderer.invoke('tools:refresh'),
  runTool: (name: string, input: any) => ipcRenderer.invoke('tools:run', name, input),

  // Task runner (non-streaming)
  runTask: (taskType: string, prompt: string) => ipcRenderer.invoke('task:run', taskType, prompt),

  // Task runner (streaming)
  runTaskStream: (
    taskType: string,
    prompt: string,
    callbacks: { onChunk?: StreamCallback; onDone?: StreamCallback; onError?: StreamCallback }
  ) => {
    const requestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    streamCallbacks.set(requestId, callbacks);
    return ipcRenderer.invoke('task:runStream', taskType, prompt, requestId);
  },

  // Tool chaining
  runChain: (steps: { tool: string; input: any; outputKey?: string }[]) => 
    ipcRenderer.invoke('chain:run', steps),

  // MCP Management
  mcp: {
    list: () => ipcRenderer.invoke('mcp:list'),
    add: (config: { name: string; command: string; args?: string[] }) => 
      ipcRenderer.invoke('mcp:add', config),
    remove: (name: string) => ipcRenderer.invoke('mcp:remove', name),
    reconnect: (name: string) => ipcRenderer.invoke('mcp:reconnect', name),
  },

  // Cost tracking
  costs: {
    get: () => ipcRenderer.invoke('costs:get'),
    reset: () => ipcRenderer.invoke('costs:reset'),
  },

  // Models
  models: {
    list: () => ipcRenderer.invoke('models:list'),
  },

  // Doctor - System Diagnostics
  doctor: {
    run: () => ipcRenderer.invoke('doctor:run'),
    getLastReport: () => ipcRenderer.invoke('doctor:getLastReport'),
    getReportText: (sanitize: boolean = true) => ipcRenderer.invoke('doctor:getReportText', sanitize),
    export: (sanitize: boolean = true) => ipcRenderer.invoke('doctor:export', sanitize),
  },

  // Permissions - Declarative permissions system
  permissions: {
    register: (toolName: string, permissions: any) => 
      ipcRenderer.invoke('permissions:register', toolName, permissions),
    check: (toolName: string, category: string, action: string) => 
      ipcRenderer.invoke('permissions:check', toolName, category, action),
    getToolPermissions: (toolName: string) => 
      ipcRenderer.invoke('permissions:getToolPermissions', toolName),
    grant: (toolName: string, category: string, permanent: boolean = false) => 
      ipcRenderer.invoke('permissions:grant', toolName, category, permanent),
    deny: (toolName: string, category: string, permanent: boolean = false) => 
      ipcRenderer.invoke('permissions:deny', toolName, category, permanent),
    getPolicy: (toolName: string) => 
      ipcRenderer.invoke('permissions:getPolicy', toolName),
    resetPolicy: (toolName: string) => 
      ipcRenderer.invoke('permissions:resetPolicy', toolName),
    resetAll: () => 
      ipcRenderer.invoke('permissions:resetAll'),
  },
});
