"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Electron main process
var electron_1 = require("electron");
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var electron_store_1 = __importDefault(require("electron-store"));
var axios_1 = __importDefault(require("axios"));
var store = new electron_store_1.default();
var mainWindow = null;
var plugins = [];
var tools = [];
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    if (electron_1.app.isPackaged) {
        mainWindow.loadFile(path_1.default.join(__dirname, 'dist', 'index.html'));
    }
    else {
        mainWindow.loadURL('http://localhost:5173/');
    }
}
electron_1.app.whenReady().then(function () {
    createWindow();
    loadPlugins();
});
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
function loadPlugins() {
    plugins = [];
    tools = [];
    var pluginsDir = store.get('pluginsDir') || path_1.default.join(__dirname, 'plugins');
    console.log('[loadPlugins] Looking for plugins in:', pluginsDir);
    if (!pluginsDir || typeof pluginsDir !== 'string' || !fs_1.default.existsSync(pluginsDir)) {
        console.log('[loadPlugins] Plugins directory not found');
        return;
    }
    var folders = fs_1.default.readdirSync(pluginsDir, { withFileTypes: true })
        .filter(function (dirent) { return dirent.isDirectory(); })
        .map(function (dirent) { return dirent.name; });
    console.log('[loadPlugins] Found folders:', folders);
    folders.forEach(function (folder) {
        var pluginPath = path_1.default.join(pluginsDir, folder, 'index.js');
        if (fs_1.default.existsSync(pluginPath)) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                var plugin = require(pluginPath);
                if (plugin && typeof plugin.register === 'function') {
                    plugin.register({
                        registerTool: function (tool) {
                            console.log('[loadPlugins] Registered tool:', tool.name);
                            tools.push(tool);
                        },
                    });
                }
            }
            catch (e) {
                console.error('[loadPlugins] Error loading plugin:', folder, e);
            }
        }
        else {
            console.log('[loadPlugins] Plugin index.js not found:', pluginPath);
        }
    });
}
// IPC handlers
electron_1.ipcMain.handle('config:get', function () { return store.store; });
electron_1.ipcMain.handle('config:set', function (_e, partial) {
    store.set(partial);
    return store.store;
});
electron_1.ipcMain.handle('plugins:reload', function () {
    loadPlugins();
    return true;
});
electron_1.ipcMain.handle('tools:list', function () { return tools.map(function (t) { return ({ name: t.name, inputSchema: t.inputSchema }); }); });
electron_1.ipcMain.handle('tools:run', function (_e, name, input) { return __awaiter(void 0, void 0, void 0, function () {
    var tool;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tool = tools.find(function (t) { return t.name === name; });
                if (!tool)
                    throw new Error('Tool not found');
                return [4 /*yield*/, tool.run(input)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); });
// Task runner with role-based model selection
electron_1.ipcMain.handle('task:run', function (_e, taskType, prompt) { return __awaiter(void 0, void 0, void 0, function () {
    var config, router, roleConfig, model, apiKey, res, data, content;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                config = store.store;
                router = config.router || {};
                roleConfig = router[taskType];
                if (!(roleConfig === null || roleConfig === void 0 ? void 0 : roleConfig.model))
                    throw new Error("No model configured for task type: ".concat(taskType));
                model = roleConfig.model;
                apiKey = config.openrouterApiKey;
                if (!apiKey)
                    throw new Error('No OpenRouter API key');
                console.log('[task:run] Task type:', taskType, 'Model:', model);
                // (Token counting is not implemented, just log fake value)
                console.log('[task:run] Prompt tokens: (fake)');
                return [4 /*yield*/, axios_1.default.post('https://openrouter.ai/api/v1/chat/completions', {
                        model: model,
                        messages: [{ role: 'user', content: prompt }],
                    }, {
                        headers: {
                            'Authorization': "Bearer ".concat(apiKey),
                            'Content-Type': 'application/json',
                        },
                    })];
            case 1:
                res = _d.sent();
                data = res.data;
                content = ((_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || '';
                return [2 /*return*/, { content: content, usage: data.usage, model: data.model }];
        }
    });
}); });
// Save a generated plugin to disk
electron_1.ipcMain.handle('plugins:save', function (_e, pluginName, code) { return __awaiter(void 0, void 0, void 0, function () {
    var pluginsDir, safeName, pluginPath, cleanCode, fenceMatch;
    return __generator(this, function (_a) {
        pluginsDir = store.get('pluginsDir') || path_1.default.join(__dirname, 'plugins');
        safeName = pluginName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
        if (!safeName)
            throw new Error('Invalid plugin name');
        pluginPath = path_1.default.join(pluginsDir, safeName);
        // Create plugin directory
        if (!fs_1.default.existsSync(pluginPath)) {
            fs_1.default.mkdirSync(pluginPath, { recursive: true });
        }
        cleanCode = code;
        fenceMatch = code.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/);
        if (fenceMatch) {
            cleanCode = fenceMatch[1].trim();
        }
        // Write index.js
        fs_1.default.writeFileSync(path_1.default.join(pluginPath, 'index.js'), cleanCode, 'utf-8');
        // Write package.json
        fs_1.default.writeFileSync(path_1.default.join(pluginPath, 'package.json'), '{\n  "type": "commonjs"\n}\n', 'utf-8');
        console.log('[plugins:save] Saved plugin:', safeName);
        // Reload plugins to pick up the new one
        loadPlugins();
        return [2 /*return*/, { success: true, path: pluginPath, name: safeName }];
    });
}); });
