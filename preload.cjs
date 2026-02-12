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
    deletePlugin: function (pluginName) { return electron_1.ipcRenderer.invoke('plugins:delete', pluginName); },
    // Tools
    listTools: function () { return electron_1.ipcRenderer.invoke('tools:list'); },
    refreshTools: function () { return electron_1.ipcRenderer.invoke('tools:refresh'); },
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
    // Doctor - System Diagnostics
    doctor: {
        run: function () { return electron_1.ipcRenderer.invoke('doctor:run'); },
        getLastReport: function () { return electron_1.ipcRenderer.invoke('doctor:getLastReport'); },
        getReportText: function (sanitize) {
            if (sanitize === void 0) { sanitize = true; }
            return electron_1.ipcRenderer.invoke('doctor:getReportText', sanitize);
        },
        export: function (sanitize) {
            if (sanitize === void 0) { sanitize = true; }
            return electron_1.ipcRenderer.invoke('doctor:export', sanitize);
        },
        suggestFailure: function (toolName, errorText) {
            return electron_1.ipcRenderer.invoke('doctor:suggestFailure', toolName, errorText);
        },
        getHistory: function () { return electron_1.ipcRenderer.invoke('doctor:getHistory'); },
        onAutoReport: function (callback) {
            var handler = function (_e, report) { return callback(report); };
            electron_1.ipcRenderer.on('doctor:autoReport', handler);
            return function () { return electron_1.ipcRenderer.removeListener('doctor:autoReport', handler); };
        },
    },
    // Permissions - Declarative permissions system
    permissions: {
        register: function (toolName, permissions) {
            return electron_1.ipcRenderer.invoke('permissions:register', toolName, permissions);
        },
        check: function (toolName, category, action) {
            return electron_1.ipcRenderer.invoke('permissions:check', toolName, category, action);
        },
        getToolPermissions: function (toolName) {
            return electron_1.ipcRenderer.invoke('permissions:getToolPermissions', toolName);
        },
        grant: function (toolName, category, permanent) {
            if (permanent === void 0) { permanent = false; }
            return electron_1.ipcRenderer.invoke('permissions:grant', toolName, category, permanent);
        },
        deny: function (toolName, category, permanent) {
            if (permanent === void 0) { permanent = false; }
            return electron_1.ipcRenderer.invoke('permissions:deny', toolName, category, permanent);
        },
        getPolicy: function (toolName) {
            return electron_1.ipcRenderer.invoke('permissions:getPolicy', toolName);
        },
        resetPolicy: function (toolName) {
            return electron_1.ipcRenderer.invoke('permissions:resetPolicy', toolName);
        },
        resetAll: function () {
            return electron_1.ipcRenderer.invoke('permissions:resetAll');
        },
    },
    // Chat history persistence
    chat: {
        save: function (history) { return electron_1.ipcRenderer.invoke('chat:save', history); },
        load: function () { return electron_1.ipcRenderer.invoke('chat:load'); },
        clear: function () { return electron_1.ipcRenderer.invoke('chat:clear'); },
    },
    // Run manager - Execution tracking
    runs: {
        getActive: function () { return electron_1.ipcRenderer.invoke('runs:getActive'); },
        getHistory: function (limit) { return electron_1.ipcRenderer.invoke('runs:getHistory', limit); },
        getAll: function () { return electron_1.ipcRenderer.invoke('runs:getAll'); },
        get: function (runId) { return electron_1.ipcRenderer.invoke('runs:get', runId); },
        getStats: function () { return electron_1.ipcRenderer.invoke('runs:getStats'); },
        kill: function (runId) { return electron_1.ipcRenderer.invoke('runs:kill', runId); },
        clearHistory: function () { return electron_1.ipcRenderer.invoke('runs:clearHistory'); },
        clearAll: function () { return electron_1.ipcRenderer.invoke('runs:clearAll'); },
        getInterrupted: function () { return electron_1.ipcRenderer.invoke('runs:getInterrupted'); },
        clearInterrupted: function () { return electron_1.ipcRenderer.invoke('runs:clearInterrupted'); },
        hasInterrupted: function () { return electron_1.ipcRenderer.invoke('runs:hasInterrupted'); },
        exportBundle: function (runId) { return electron_1.ipcRenderer.invoke('runs:exportBundle', runId); },
        // Listen to run updates
        onUpdate: function (callback) {
            var handler = function (_e, run) { return callback(run); };
            electron_1.ipcRenderer.on('run:update', handler);
            return function () { return electron_1.ipcRenderer.removeListener('run:update', handler); };
        },
        // Listen to stats updates
        onStatsUpdate: function (callback) {
            var handler = function (_e, stats) { return callback(stats); };
            electron_1.ipcRenderer.on('run:stats', handler);
            return function () { return electron_1.ipcRenderer.removeListener('run:stats', handler); };
        },
    },
    // Tool Health Signals
    toolHealth: {
        get: function (toolName) { return electron_1.ipcRenderer.invoke('toolHealth:get', toolName); },
        addKnownIssue: function (toolName, note) {
            return electron_1.ipcRenderer.invoke('toolHealth:addKnownIssue', toolName, note);
        },
        removeKnownIssue: function (toolName, index) {
            return electron_1.ipcRenderer.invoke('toolHealth:removeKnownIssue', toolName, index);
        },
    },
    // Safe fix flow (preview + explicit apply)
    safeFix: {
        preview: function (fixId) { return electron_1.ipcRenderer.invoke('safeFix:preview', fixId); },
        apply: function (token) { return electron_1.ipcRenderer.invoke('safeFix:apply', token); },
    },
    // Secrets Manager - Secure credential storage
    secrets: {
        isAvailable: function () { return electron_1.ipcRenderer.invoke('secrets:isAvailable'); },
        store: function (name, value, type, tags) {
            return electron_1.ipcRenderer.invoke('secrets:store', name, value, type, tags);
        },
        get: function (secretId) { return electron_1.ipcRenderer.invoke('secrets:get', secretId); },
        delete: function (secretId) { return electron_1.ipcRenderer.invoke('secrets:delete', secretId); },
        list: function () { return electron_1.ipcRenderer.invoke('secrets:list'); },
        updateMetadata: function (secretId, updates) {
            return electron_1.ipcRenderer.invoke('secrets:updateMetadata', secretId, updates);
        },
        findByTool: function (toolName) { return electron_1.ipcRenderer.invoke('secrets:findByTool', toolName); },
        redact: function (data) { return electron_1.ipcRenderer.invoke('secrets:redact', data); },
    },
    // Tool Manifest - Tool metadata registry
    manifest: {
        register: function (manifest) { return electron_1.ipcRenderer.invoke('manifest:register', manifest); },
        get: function (toolName) { return electron_1.ipcRenderer.invoke('manifest:get', toolName); },
        list: function () { return electron_1.ipcRenderer.invoke('manifest:list'); },
        checkCompatibility: function (toolName) {
            return electron_1.ipcRenderer.invoke('manifest:checkCompatibility', toolName);
        },
        getToolInfo: function (toolName) { return electron_1.ipcRenderer.invoke('manifest:getToolInfo', toolName); },
        findByTag: function (tag) { return electron_1.ipcRenderer.invoke('manifest:findByTag', tag); },
        findByStability: function (stability) {
            return electron_1.ipcRenderer.invoke('manifest:findByStability', stability);
        },
    },
    // Preview Manager - Dry run / Preview mode
    preview: {
        getHistory: function (limit) { return electron_1.ipcRenderer.invoke('preview:getHistory', limit); },
        approve: function (index) { return electron_1.ipcRenderer.invoke('preview:approve', index); },
        get: function (index) { return electron_1.ipcRenderer.invoke('preview:get', index); },
        format: function (preview) { return electron_1.ipcRenderer.invoke('preview:format', preview); },
        clear: function () { return electron_1.ipcRenderer.invoke('preview:clear'); },
    },
    // User Memory - Learning system
    memory: {
        remember: function (category, key, value, options) {
            return electron_1.ipcRenderer.invoke('memory:remember', category, key, value, options);
        },
        recall: function (category, key) {
            return electron_1.ipcRenderer.invoke('memory:recall', category, key);
        },
        forget: function (memoryId) { return electron_1.ipcRenderer.invoke('memory:forget', memoryId); },
        forgetAll: function () { return electron_1.ipcRenderer.invoke('memory:forgetAll'); },
        update: function (memoryId, updates) {
            return electron_1.ipcRenderer.invoke('memory:update', memoryId, updates);
        },
        listAll: function () { return electron_1.ipcRenderer.invoke('memory:listAll'); },
        listByCategory: function (category) {
            return electron_1.ipcRenderer.invoke('memory:listByCategory', category);
        },
        search: function (query) { return electron_1.ipcRenderer.invoke('memory:search', query); },
        getMostUsed: function (limit) { return electron_1.ipcRenderer.invoke('memory:getMostUsed', limit); },
        getRecentlyUsed: function (limit) { return electron_1.ipcRenderer.invoke('memory:getRecentlyUsed', limit); },
        getStats: function () { return electron_1.ipcRenderer.invoke('memory:getStats'); },
        setEnabled: function (enabled) { return electron_1.ipcRenderer.invoke('memory:setEnabled', enabled); },
        isEnabled: function () { return electron_1.ipcRenderer.invoke('memory:isEnabled'); },
        rememberPreference: function (key, value) {
            return electron_1.ipcRenderer.invoke('memory:rememberPreference', key, value);
        },
        recallPreference: function (key) { return electron_1.ipcRenderer.invoke('memory:recallPreference', key); },
    },
    // Tool Dispatcher - V3 Smart Tool Selection
    dispatch: {
        // V2-compatible
        createPlan: function (query, context) {
            return electron_1.ipcRenderer.invoke('dispatch:createPlan', query, context);
        },
        suggest: function (context, limit) {
            return electron_1.ipcRenderer.invoke('dispatch:suggest', context, limit);
        },
        formatPlan: function (plan) { return electron_1.ipcRenderer.invoke('dispatch:formatPlan', plan); },
        // V3: Tool ranking
        rankTools: function (query) {
            return electron_1.ipcRenderer.invoke('dispatch:rankTools', query);
        },
        // V3: Usage tracking
        recordUsage: function (toolName, query, success) {
            return electron_1.ipcRenderer.invoke('dispatch:recordUsage', toolName, query, success);
        },
        getUsageData: function () {
            return electron_1.ipcRenderer.invoke('dispatch:getUsageData');
        },
        // V3: Disambiguation
        disambiguate: function (query) {
            return electron_1.ipcRenderer.invoke('dispatch:disambiguate', query);
        },
        resolveDisambiguation: function (disambiguation, selectedIndex) {
            return electron_1.ipcRenderer.invoke('dispatch:resolveDisambiguation', disambiguation, selectedIndex);
        },
        // V3: Chain planning
        buildChain: function (query) {
            return electron_1.ipcRenderer.invoke('dispatch:buildChain', query);
        },
        parseChain: function (llmResponse) {
            return electron_1.ipcRenderer.invoke('dispatch:parseChain', llmResponse);
        },
        validateChain: function (plan) {
            return electron_1.ipcRenderer.invoke('dispatch:validateChain', plan);
        },
        formatChain: function (plan) {
            return electron_1.ipcRenderer.invoke('dispatch:formatChain', plan);
        },
        // V3: Config
        getConfig: function () {
            return electron_1.ipcRenderer.invoke('dispatch:getConfig');
        },
        updateConfig: function (updates) {
            return electron_1.ipcRenderer.invoke('dispatch:updateConfig', updates);
        },
    },
    // Guardrails - V2 Trust Core
    guardrails: {
        validateSchema: function (input, schema) {
            return electron_1.ipcRenderer.invoke('guardrails:validateSchema', input, schema);
        },
        checkCommand: function (command, args) {
            return electron_1.ipcRenderer.invoke('guardrails:checkCommand', command, args);
        },
        checkPath: function (filePath) {
            return electron_1.ipcRenderer.invoke('guardrails:checkPath', filePath);
        },
        assessRisk: function (toolName, input) {
            return electron_1.ipcRenderer.invoke('guardrails:assessRisk', toolName, input);
        },
    },
    // Assets - V2 File Upload System
    assets: {
        upload: function () { return electron_1.ipcRenderer.invoke('assets:upload'); },
        ingest: function (sourcePath) { return electron_1.ipcRenderer.invoke('assets:ingest', sourcePath); },
        ingestBuffer: function (buffer, filename) {
            return electron_1.ipcRenderer.invoke('assets:ingestBuffer', buffer, filename);
        },
        list: function () { return electron_1.ipcRenderer.invoke('assets:list'); },
        get: function (assetId) { return electron_1.ipcRenderer.invoke('assets:get', assetId); },
        open: function (assetId) { return electron_1.ipcRenderer.invoke('assets:open', assetId); },
        delete: function (assetId) { return electron_1.ipcRenderer.invoke('assets:delete', assetId); },
        export: function (assetId) { return electron_1.ipcRenderer.invoke('assets:export', assetId); },
        resolvePath: function (assetId) { return electron_1.ipcRenderer.invoke('assets:resolvePath', assetId); },
    },
    // Session Logs - V2 Persistence
    logs: {
        getSessionLog: function () { return electron_1.ipcRenderer.invoke('logs:getSessionLog'); },
        exportSessionLog: function () { return electron_1.ipcRenderer.invoke('logs:exportSessionLog'); },
    },
    // Environment Detection
    environment: {
        getInfo: function () { return electron_1.ipcRenderer.invoke('environment:getInfo'); },
        format: function (info) { return electron_1.ipcRenderer.invoke('environment:format', info); },
        getUnsupportedMessage: function (info) {
            return electron_1.ipcRenderer.invoke('environment:getUnsupportedMessage', info);
        },
        getLockdownWarning: function (info) {
            return electron_1.ipcRenderer.invoke('environment:getLockdownWarning', info);
        },
    },
});
