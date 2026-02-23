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
  // Product branding
  getProductConfig: () => ipcRenderer.invoke('product:config'),

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
    suggestFailure: (toolName: string, errorText: string) =>
      ipcRenderer.invoke('doctor:suggestFailure', toolName, errorText),
    getHistory: () => ipcRenderer.invoke('doctor:getHistory'),
    onAutoReport: (callback: (report: any) => void) => {
      const handler = (_e: any, report: any) => callback(report);
      ipcRenderer.on('doctor:autoReport', handler);
      return () => ipcRenderer.removeListener('doctor:autoReport', handler);
    },
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

  // Sessions
  sessions: {
    getAll: () => ipcRenderer.invoke('sessions:getAll'),
    getCurrent: () => ipcRenderer.invoke('sessions:getCurrent'),
    getById: (sessionId: string) => ipcRenderer.invoke('sessions:getById', sessionId),
    create: (name?: string) => ipcRenderer.invoke('sessions:create', name),
    switch: (sessionId: string) => ipcRenderer.invoke('sessions:switch', sessionId),
    rename: (sessionId: string, newName: string) => ipcRenderer.invoke('sessions:rename', sessionId, newName),
    delete: (sessionId: string) => ipcRenderer.invoke('sessions:delete', sessionId),
    updateHistory: (sessionId: string, history: any[]) => ipcRenderer.invoke('sessions:updateHistory', sessionId, history),
    updateMode: (sessionId: string, mode: 'read' | 'propose' | 'execute') => ipcRenderer.invoke('sessions:updateMode', sessionId, mode),
    updateModel: (sessionId: string, model: string) => ipcRenderer.invoke('sessions:updateModel', sessionId, model),
    updateProvider: (sessionId: string, provider: string) => ipcRenderer.invoke('sessions:updateProvider', sessionId, provider),
  },

  // Chat history persistence (legacy - uses current session)
  chat: {
    save: (history: any[]) => ipcRenderer.invoke('chat:save', history),
    load: () => ipcRenderer.invoke('chat:load'),
    clear: () => ipcRenderer.invoke('chat:clear'),
  },

  // Run manager - Execution tracking
  runs: {
    getActive: () => ipcRenderer.invoke('runs:getActive'),
    getHistory: (limit?: number) => ipcRenderer.invoke('runs:getHistory', limit),
    getAll: () => ipcRenderer.invoke('runs:getAll'),
    get: (runId: string) => ipcRenderer.invoke('runs:get', runId),
    getStats: () => ipcRenderer.invoke('runs:getStats'),
    kill: (runId: string) => ipcRenderer.invoke('runs:kill', runId),
    clearHistory: () => ipcRenderer.invoke('runs:clearHistory'),
    clearAll: () => ipcRenderer.invoke('runs:clearAll'),
    getInterrupted: () => ipcRenderer.invoke('runs:getInterrupted'),
    clearInterrupted: () => ipcRenderer.invoke('runs:clearInterrupted'),
    hasInterrupted: () => ipcRenderer.invoke('runs:hasInterrupted'),
    exportBundle: (runId?: string) => ipcRenderer.invoke('runs:exportBundle', runId),
    // Listen to run updates
    onUpdate: (callback: (run: any) => void) => {
      const handler = (_e: any, run: any) => callback(run);
      ipcRenderer.on('run:update', handler);
      return () => ipcRenderer.removeListener('run:update', handler);
    },
    // Listen to stats updates
    onStatsUpdate: (callback: (stats: any) => void) => {
      const handler = (_e: any, stats: any) => callback(stats);
      ipcRenderer.on('run:stats', handler);
      return () => ipcRenderer.removeListener('run:stats', handler);
    },
  },

  // Tool Health Signals
  toolHealth: {
    get: (toolName: string) => ipcRenderer.invoke('toolHealth:get', toolName),
    addKnownIssue: (toolName: string, note: string) =>
      ipcRenderer.invoke('toolHealth:addKnownIssue', toolName, note),
    removeKnownIssue: (toolName: string, index: number) =>
      ipcRenderer.invoke('toolHealth:removeKnownIssue', toolName, index),
  },

  // Safe fix flow (preview + explicit apply)
  safeFix: {
    preview: (fixId: string) => ipcRenderer.invoke('safeFix:preview', fixId),
    apply: (token: string) => ipcRenderer.invoke('safeFix:apply', token),
  },

  // Secrets Manager - Secure credential storage
  secrets: {
    isAvailable: () => ipcRenderer.invoke('secrets:isAvailable'),
    store: (name: string, value: string, type: string, tags?: string[]) => 
      ipcRenderer.invoke('secrets:store', name, value, type, tags),
    get: (secretId: string) => ipcRenderer.invoke('secrets:get', secretId),
    delete: (secretId: string) => ipcRenderer.invoke('secrets:delete', secretId),
    list: () => ipcRenderer.invoke('secrets:list'),
    updateMetadata: (secretId: string, updates: any) => 
      ipcRenderer.invoke('secrets:updateMetadata', secretId, updates),
    findByTool: (toolName: string) => ipcRenderer.invoke('secrets:findByTool', toolName),
    redact: (data: any) => ipcRenderer.invoke('secrets:redact', data),
  },

  // Tool Manifest - Tool metadata registry
  manifest: {
    register: (manifest: any) => ipcRenderer.invoke('manifest:register', manifest),
    get: (toolName: string) => ipcRenderer.invoke('manifest:get', toolName),
    list: () => ipcRenderer.invoke('manifest:list'),
    checkCompatibility: (toolName: string) => 
      ipcRenderer.invoke('manifest:checkCompatibility', toolName),
    getToolInfo: (toolName: string) => ipcRenderer.invoke('manifest:getToolInfo', toolName),
    findByTag: (tag: string) => ipcRenderer.invoke('manifest:findByTag', tag),
    findByStability: (stability: string) => 
      ipcRenderer.invoke('manifest:findByStability', stability),
  },

  // Preview Manager - Dry run / Preview mode
  preview: {
    getHistory: (limit?: number) => ipcRenderer.invoke('preview:getHistory', limit),
    approve: (index: number) => ipcRenderer.invoke('preview:approve', index),
    get: (index: number) => ipcRenderer.invoke('preview:get', index),
    format: (preview: any) => ipcRenderer.invoke('preview:format', preview),
    clear: () => ipcRenderer.invoke('preview:clear'),
  },

  // User Memory - Learning system
  memory: {
    remember: (category: string, key: string, value: any, options?: any) => 
      ipcRenderer.invoke('memory:remember', category, key, value, options),
    recall: (category: string, key: string) => 
      ipcRenderer.invoke('memory:recall', category, key),
    forget: (memoryId: string) => ipcRenderer.invoke('memory:forget', memoryId),
    forgetAll: () => ipcRenderer.invoke('memory:forgetAll'),
    update: (memoryId: string, updates: any) => 
      ipcRenderer.invoke('memory:update', memoryId, updates),
    listAll: () => ipcRenderer.invoke('memory:listAll'),
    listByCategory: (category: string) => 
      ipcRenderer.invoke('memory:listByCategory', category),
    search: (query: string) => ipcRenderer.invoke('memory:search', query),
    getMostUsed: (limit?: number) => ipcRenderer.invoke('memory:getMostUsed', limit),
    getRecentlyUsed: (limit?: number) => ipcRenderer.invoke('memory:getRecentlyUsed', limit),
    getStats: () => ipcRenderer.invoke('memory:getStats'),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('memory:setEnabled', enabled),
    isEnabled: () => ipcRenderer.invoke('memory:isEnabled'),
    rememberPreference: (key: string, value: any) => 
      ipcRenderer.invoke('memory:rememberPreference', key, value),
    recallPreference: (key: string) => ipcRenderer.invoke('memory:recallPreference', key),
  },

  // Tool Dispatcher - V3 Smart Tool Selection
  dispatch: {
    // V2-compatible
    createPlan: (query: string, context?: any) =>
      ipcRenderer.invoke('dispatch:createPlan', query, context),
    suggest: (context: string, limit?: number) =>
      ipcRenderer.invoke('dispatch:suggest', context, limit),
    formatPlan: (plan: any) => ipcRenderer.invoke('dispatch:formatPlan', plan),
    // V3: Tool ranking
    rankTools: (query: string) =>
      ipcRenderer.invoke('dispatch:rankTools', query),
    // V3: Usage tracking
    recordUsage: (toolName: string, query: string, success: boolean) =>
      ipcRenderer.invoke('dispatch:recordUsage', toolName, query, success),
    getUsageData: () =>
      ipcRenderer.invoke('dispatch:getUsageData'),
    // V3: Disambiguation
    disambiguate: (query: string) =>
      ipcRenderer.invoke('dispatch:disambiguate', query),
    resolveDisambiguation: (disambiguation: any, selectedIndex: number) =>
      ipcRenderer.invoke('dispatch:resolveDisambiguation', disambiguation, selectedIndex),
    // V3: Chain planning
    buildChain: (query: string) =>
      ipcRenderer.invoke('dispatch:buildChain', query),
    parseChain: (llmResponse: string) =>
      ipcRenderer.invoke('dispatch:parseChain', llmResponse),
    validateChain: (plan: any) =>
      ipcRenderer.invoke('dispatch:validateChain', plan),
    formatChain: (plan: any) =>
      ipcRenderer.invoke('dispatch:formatChain', plan),
    // V3: Config
    getConfig: () =>
      ipcRenderer.invoke('dispatch:getConfig'),
    updateConfig: (updates: any) =>
      ipcRenderer.invoke('dispatch:updateConfig', updates),
  },

  // Guardrails - V2 Trust Core
  guardrails: {
    validateSchema: (input: any, schema: any) =>
      ipcRenderer.invoke('guardrails:validateSchema', input, schema),
    checkCommand: (command: string, args: string[]) =>
      ipcRenderer.invoke('guardrails:checkCommand', command, args),
    checkPath: (filePath: string) =>
      ipcRenderer.invoke('guardrails:checkPath', filePath),
    assessRisk: (toolName: string, input: any) =>
      ipcRenderer.invoke('guardrails:assessRisk', toolName, input),
  },

  // Assets - V2 File Upload System
  assets: {
    upload: () => ipcRenderer.invoke('assets:upload'),
    ingest: (sourcePath: string) => ipcRenderer.invoke('assets:ingest', sourcePath),
    ingestBuffer: (buffer: ArrayBuffer, filename: string) =>
      ipcRenderer.invoke('assets:ingestBuffer', buffer, filename),
    list: () => ipcRenderer.invoke('assets:list'),
    get: (assetId: string) => ipcRenderer.invoke('assets:get', assetId),
    open: (assetId: string) => ipcRenderer.invoke('assets:open', assetId),
    delete: (assetId: string) => ipcRenderer.invoke('assets:delete', assetId),
    export: (assetId: string) => ipcRenderer.invoke('assets:export', assetId),
    resolvePath: (assetId: string) => ipcRenderer.invoke('assets:resolvePath', assetId),
  },

  // Session Logs - V2 Persistence
  logs: {
    getSessionLog: () => ipcRenderer.invoke('logs:getSessionLog'),
    exportSessionLog: () => ipcRenderer.invoke('logs:exportSessionLog'),
  },

  // Environment Detection
  environment: {
    getInfo: () => ipcRenderer.invoke('environment:getInfo'),
    format: (info: any) => ipcRenderer.invoke('environment:format', info),
    getUnsupportedMessage: (info: any) => 
      ipcRenderer.invoke('environment:getUnsupportedMessage', info),
    getLockdownWarning: (info: any) => 
      ipcRenderer.invoke('environment:getLockdownWarning', info),
  },
});
