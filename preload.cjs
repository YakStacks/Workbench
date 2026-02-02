"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Electron preload script - Enhanced with streaming, tool chaining, and MCP
var electron_1 = require("electron");
var streamCallbacks = new Map();
// Listen for stream events from main process
electron_1.ipcRenderer.on('stream:chunk', function (_e, data) {
    var _a;
    var callbacks = streamCallbacks.get(data.requestId);
    (_a = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onChunk) === null || _a === void 0 ? void 0 : _a.call(callbacks, data);
});
electron_1.ipcRenderer.on('stream:done', function (_e, data) {
    var _a;
    var callbacks = streamCallbacks.get(data.requestId);
    (_a = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onDone) === null || _a === void 0 ? void 0 : _a.call(callbacks, data);
    streamCallbacks.delete(data.requestId);
});
electron_1.ipcRenderer.on('stream:error', function (_e, data) {
    var _a;
    var callbacks = streamCallbacks.get(data.requestId);
    (_a = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onError) === null || _a === void 0 ? void 0 : _a.call(callbacks, data);
    streamCallbacks.delete(data.requestId);
});
electron_1.contextBridge.exposeInMainWorld('workbench', {
    // Config
    getConfig: function () { return electron_1.ipcRenderer.invoke('config:get'); },
    setConfig: function (partial) { return electron_1.ipcRenderer.invoke('config:set', partial); },
    // Plugins
    reloadPlugins: function () { return electron_1.ipcRenderer.invoke('plugins:reload'); },
    savePlugin: function (pluginName, code) { return electron_1.ipcRenderer.invoke('plugins:save', pluginName, code); },
    // Tools
    listTools: function () { return electron_1.ipcRenderer.invoke('tools:list'); },
    runTool: function (name, input) { return electron_1.ipcRenderer.invoke('tools:run', name, input); },
    // Task runner (non-streaming)
    runTask: function (taskType, prompt) { return electron_1.ipcRenderer.invoke('task:run', taskType, prompt); },
    // Task runner (streaming)
    runTaskStream: function (taskType, prompt, callbacks) {
        var requestId = "stream_".concat(Date.now(), "_").concat(Math.random().toString(36).slice(2));
        streamCallbacks.set(requestId, callbacks);
        return electron_1.ipcRenderer.invoke('task:runStream', taskType, prompt, requestId);
    },
    // Tool chaining
    runChain: function (steps) {
        return electron_1.ipcRenderer.invoke('chain:run', steps);
    },
    // MCP Management
    mcp: {
        list: function () { return electron_1.ipcRenderer.invoke('mcp:list'); },
        add: function (config) {
            return electron_1.ipcRenderer.invoke('mcp:add', config);
        },
        remove: function (name) { return electron_1.ipcRenderer.invoke('mcp:remove', name); },
        reconnect: function (name) { return electron_1.ipcRenderer.invoke('mcp:reconnect', name); },
    },
    // Cost tracking
    costs: {
        get: function () { return electron_1.ipcRenderer.invoke('costs:get'); },
        reset: function () { return electron_1.ipcRenderer.invoke('costs:reset'); },
    },
    // Models
    models: {
        list: function () { return electron_1.ipcRenderer.invoke('models:list'); },
    },
});
