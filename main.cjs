"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Electron main process - Enhanced with streaming, file system, clipboard, tool chaining, MCP
var electron_1 = require("electron");
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var child_process_1 = require("child_process");
var electron_store_1 = __importDefault(require("electron-store"));
var axios_1 = __importDefault(require("axios"));
var store = new electron_store_1.default();
var mainWindow = null;
var plugins = [];
var tools = new Map();
// Normalize tool output to standard format
function normalizeToolOutput(output) {
    // Already in correct format
    if (output && typeof output === 'object' && 'content' in output) {
        return output;
    }
    // Plain string
    if (typeof output === 'string') {
        return { content: output };
    }
    // Error object
    if (output && output.error) {
        return {
            content: output.message || output.error,
            error: output.error,
            metadata: output
        };
    }
    // Any other object - serialize it
    return {
        content: JSON.stringify(output, null, 2),
        metadata: output
    };
}
var mcpServers = new Map();
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
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
    registerBuiltinTools();
    loadMCPServers();
});
electron_1.app.on('window-all-closed', function () {
    // Cleanup MCP servers
    mcpServers.forEach(function (server) {
        if (server.process) {
            server.process.kill();
        }
    });
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// ============================================================================
// PLUGIN SYSTEM
// ============================================================================
function loadPlugins() {
    plugins = [];
    // Keep builtin tools, clear plugin tools
    var builtinTools = new Map();
    tools.forEach(function (tool, name) {
        if (name.startsWith('builtin.') || name.startsWith('mcp.')) {
            builtinTools.set(name, tool);
        }
    });
    tools = builtinTools;
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
                // Clear require cache for hot reload
                delete require.cache[require.resolve(pluginPath)];
                var plugin = require(pluginPath);
                if (plugin && typeof plugin.register === 'function') {
                    plugin.register({
                        registerTool: function (tool) {
                            // Store source folder for delete functionality
                            tool._sourceFolder = folder;
                            console.log('[loadPlugins] Registered tool:', tool.name, 'from folder:', folder);
                            tools.set(tool.name, tool);
                        },
                    });
                }
            }
            catch (e) {
                console.error('[loadPlugins] Error loading plugin:', folder, e);
            }
        }
    });
}
// ============================================================================
// BUILTIN TOOLS - File System, Clipboard, Shell
// ============================================================================
function registerBuiltinTools() {
    var _this = this;
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
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var safePath, content;
            return __generator(this, function (_a) {
                safePath = resolveSafePath(input.path);
                assertPathSafe(safePath);
                content = fs_1.default.readFileSync(safePath, { encoding: (input.encoding || 'utf-8') });
                return [2 /*return*/, { content: content, path: safePath, size: content.length }];
            });
        }); }
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
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var safePath, dir;
            return __generator(this, function (_a) {
                safePath = resolveSafePath(input.path);
                assertPathSafe(safePath);
                dir = path_1.default.dirname(safePath);
                if (!fs_1.default.existsSync(dir)) {
                    fs_1.default.mkdirSync(dir, { recursive: true });
                }
                if (input.append) {
                    fs_1.default.appendFileSync(safePath, input.content, 'utf-8');
                }
                else {
                    fs_1.default.writeFileSync(safePath, input.content, 'utf-8');
                }
                return [2 /*return*/, { success: true, path: safePath, bytesWritten: input.content.length }];
            });
        }); }
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
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var safePath, entries;
            return __generator(this, function (_a) {
                safePath = resolveSafePath(input.path);
                assertPathSafe(safePath);
                entries = listDirRecursive(safePath, input.recursive || false, 0, 3);
                return [2 /*return*/, { path: safePath, entries: entries }];
            });
        }); }
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
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var safePath, exists, isFile, isDir, stat;
            return __generator(this, function (_a) {
                safePath = resolveSafePath(input.path);
                exists = fs_1.default.existsSync(safePath);
                isFile = false, isDir = false;
                if (exists) {
                    stat = fs_1.default.statSync(safePath);
                    isFile = stat.isFile();
                    isDir = stat.isDirectory();
                }
                return [2 /*return*/, { exists: exists, isFile: isFile, isDirectory: isDir, path: safePath }];
            });
        }); }
    });
    // Clipboard Tools
    tools.set('builtin.clipboardRead', {
        name: 'builtin.clipboardRead',
        description: 'Read text from system clipboard',
        inputSchema: { type: 'object', properties: {} },
        run: function () { return __awaiter(_this, void 0, void 0, function () {
            var text;
            return __generator(this, function (_a) {
                text = electron_1.clipboard.readText();
                return [2 /*return*/, { content: text, length: text.length }];
            });
        }); }
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
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                electron_1.clipboard.writeText(input.content);
                return [2 /*return*/, { success: true, length: input.content.length }];
            });
        }); }
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
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        var _a, _b;
                        var cwd = input.cwd ? resolveSafePath(input.cwd) : process.cwd();
                        var isWindows = process.platform === 'win32';
                        var shell = isWindows ? 'cmd.exe' : '/bin/sh';
                        var shellArg = isWindows ? '/c' : '-c';
                        var proc = (0, child_process_1.spawn)(shell, [shellArg, input.command], {
                            cwd: cwd,
                            timeout: input.timeout || 30000,
                            env: process.env
                        });
                        var stdout = '';
                        var stderr = '';
                        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) { stdout += data.toString(); });
                        (_b = proc.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (data) { stderr += data.toString(); });
                        proc.on('close', function (code) {
                            resolve({ exitCode: code, stdout: stdout, stderr: stderr, command: input.command });
                        });
                        proc.on('error', function (err) {
                            resolve({ exitCode: -1, stdout: stdout, stderr: stderr, error: err.message, command: input.command });
                        });
                    })];
            });
        }); }
    });
    console.log('[registerBuiltinTools] Registered builtin tools');
    // System Info Tools
    tools.set('builtin.systemInfo', {
        name: 'builtin.systemInfo',
        description: 'Get system information (OS, CPU, memory, etc.)',
        inputSchema: { type: 'object', properties: {} },
        run: function () { return __awaiter(_this, void 0, void 0, function () {
            var os;
            return __generator(this, function (_a) {
                os = require('os');
                return [2 /*return*/, {
                        platform: os.platform(),
                        release: os.release(),
                        arch: os.arch(),
                        hostname: os.hostname(),
                        uptime: os.uptime(),
                        cpus: os.cpus().map(function (cpu) { return ({ model: cpu.model, speed: cpu.speed }); }),
                        totalMemory: os.totalmem(),
                        freeMemory: os.freemem(),
                        usedMemory: os.totalmem() - os.freemem(),
                        memoryUsagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(1),
                        homeDir: os.homedir(),
                        tempDir: os.tmpdir(),
                        userInfo: os.userInfo(),
                    }];
            });
        }); }
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
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        var _a;
                        var limit = input.limit || 20;
                        var isWindows = process.platform === 'win32';
                        var cmd = isWindows ? 'tasklist' : 'ps aux';
                        var proc = (0, child_process_1.spawn)(isWindows ? 'cmd.exe' : '/bin/sh', [isWindows ? '/c' : '-c', cmd], {
                            timeout: 10000
                        });
                        var output = '';
                        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) { output += data.toString(); });
                        proc.on('close', function () {
                            var lines = output.trim().split('\n');
                            resolve({
                                count: lines.length - 1,
                                processes: lines.slice(1, limit + 1),
                                raw: lines.slice(0, limit + 1).join('\n')
                            });
                        });
                        proc.on('error', function (err) {
                            resolve({ error: err.message });
                        });
                    })];
            });
        }); }
    });
    tools.set('builtin.diskSpace', {
        name: 'builtin.diskSpace',
        description: 'Check disk space usage',
        inputSchema: { type: 'object', properties: {} },
        run: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        var _a;
                        var isWindows = process.platform === 'win32';
                        var cmd = isWindows ? 'wmic logicaldisk get size,freespace,caption' : 'df -h';
                        var proc = (0, child_process_1.spawn)(isWindows ? 'cmd.exe' : '/bin/sh', [isWindows ? '/c' : '-c', cmd], {
                            timeout: 10000
                        });
                        var output = '';
                        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) { output += data.toString(); });
                        proc.on('close', function () {
                            resolve({ raw: output.trim() });
                        });
                        proc.on('error', function (err) {
                            resolve({ error: err.message });
                        });
                    })];
            });
        }); }
    });
    tools.set('builtin.networkInfo', {
        name: 'builtin.networkInfo',
        description: 'Get network interface information',
        inputSchema: { type: 'object', properties: {} },
        run: function () { return __awaiter(_this, void 0, void 0, function () {
            var os, interfaces, result, _i, _a, _b, name_1, addrs;
            return __generator(this, function (_c) {
                os = require('os');
                interfaces = os.networkInterfaces();
                result = {};
                for (_i = 0, _a = Object.entries(interfaces); _i < _a.length; _i++) {
                    _b = _a[_i], name_1 = _b[0], addrs = _b[1];
                    result[name_1] = addrs.map(function (addr) { return ({
                        address: addr.address,
                        family: addr.family,
                        internal: addr.internal,
                        mac: addr.mac,
                    }); });
                }
                return [2 /*return*/, result];
            });
        }); }
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
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var env, safeKeys, result;
            return __generator(this, function (_a) {
                env = process.env;
                safeKeys = Object.keys(env).filter(function (key) {
                    // Filter out sensitive-looking keys
                    var lower = key.toLowerCase();
                    if (lower.includes('key') || lower.includes('secret') || lower.includes('password') ||
                        lower.includes('token') || lower.includes('credential')) {
                        return false;
                    }
                    if (input.filter) {
                        return lower.includes(input.filter.toLowerCase());
                    }
                    return true;
                });
                result = {};
                safeKeys.forEach(function (key) {
                    result[key] = env[key] || '';
                });
                return [2 /*return*/, { count: safeKeys.length, variables: result }];
            });
        }); }
    });
    tools.set('builtin.installedApps', {
        name: 'builtin.installedApps',
        description: 'List installed applications (Windows only)',
        inputSchema: { type: 'object', properties: {} },
        run: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (process.platform !== 'win32') {
                    return [2 /*return*/, { error: 'This tool only works on Windows' }];
                }
                return [2 /*return*/, new Promise(function (resolve) {
                        var _a;
                        var cmd = 'wmic product get name,version';
                        var proc = (0, child_process_1.spawn)('cmd.exe', ['/c', cmd], { timeout: 30000 });
                        var output = '';
                        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) { output += data.toString(); });
                        proc.on('close', function () {
                            var lines = output.trim().split('\n').slice(1).filter(function (l) { return l.trim(); });
                            resolve({
                                count: lines.length,
                                apps: lines.slice(0, 50).map(function (l) { return l.trim(); })
                            });
                        });
                        proc.on('error', function (err) {
                            resolve({ error: err.message });
                        });
                    })];
            });
        }); }
    });
}
function resolveSafePath(inputPath) {
    // Allow absolute paths or resolve relative to user's home
    if (path_1.default.isAbsolute(inputPath)) {
        return inputPath;
    }
    var workingDir = store.get('workingDir') || electron_1.app.getPath('home');
    return path_1.default.resolve(workingDir, inputPath);
}
function isPathSafe(targetPath) {
    var safePaths = store.get('safePaths') || [];
    var workingDir = store.get('workingDir');
    // If no safe paths configured, allow workingDir and home
    if (safePaths.length === 0) {
        var allowedRoots = [workingDir, electron_1.app.getPath('home')].filter(Boolean);
        return allowedRoots.some(function (root) { return targetPath.startsWith(root); });
    }
    // Check if path is within any safe path
    var resolved = path_1.default.resolve(targetPath);
    return safePaths.some(function (safePath) {
        var resolvedSafe = path_1.default.resolve(safePath);
        return resolved.startsWith(resolvedSafe);
    });
}
function assertPathSafe(targetPath) {
    if (!isPathSafe(targetPath)) {
        throw new Error("Access denied: ".concat(targetPath, " is outside allowed directories"));
    }
}
function listDirRecursive(dirPath, recursive, depth, maxDepth) {
    if (depth > maxDepth)
        return [];
    try {
        var entries = fs_1.default.readdirSync(dirPath, { withFileTypes: true });
        return entries.map(function (entry) {
            var entryPath = path_1.default.join(dirPath, entry.name);
            var result = {
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
            };
            if (entry.isFile()) {
                result.size = fs_1.default.statSync(entryPath).size;
            }
            if (entry.isDirectory() && recursive && depth < maxDepth) {
                result.children = listDirRecursive(entryPath, recursive, depth + 1, maxDepth);
            }
            return result;
        });
    }
    catch (e) {
        return [{ error: e.message }];
    }
}
var MCPClient = /** @class */ (function () {
    function MCPClient(name, command, args) {
        if (args === void 0) { args = []; }
        this.name = name;
        this.command = command;
        this.args = args;
        this.process = null;
        this.messageId = 0;
        this.pendingRequests = new Map();
        this.buffer = '';
        this.tools = [];
        this.status = 'disconnected';
    }
    MCPClient.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var _a, _b;
                        _this.status = 'connecting';
                        try {
                            _this.process = (0, child_process_1.spawn)(_this.command, _this.args, {
                                stdio: ['pipe', 'pipe', 'pipe'],
                                env: __assign({}, process.env)
                            });
                            (_a = _this.process.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) {
                                _this.handleData(data.toString());
                            });
                            (_b = _this.process.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (data) {
                                console.error("[MCP ".concat(_this.name, "] stderr:"), data.toString());
                            });
                            _this.process.on('error', function (err) {
                                console.error("[MCP ".concat(_this.name, "] process error:"), err);
                                _this.status = 'error';
                                reject(err);
                            });
                            _this.process.on('close', function (code) {
                                console.log("[MCP ".concat(_this.name, "] process closed with code:"), code);
                                _this.status = 'disconnected';
                            });
                            // Initialize the connection
                            setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                                var e_1;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 3, , 4]);
                                            return [4 /*yield*/, this.initialize()];
                                        case 1:
                                            _a.sent();
                                            return [4 /*yield*/, this.loadTools()];
                                        case 2:
                                            _a.sent();
                                            this.status = 'connected';
                                            resolve();
                                            return [3 /*break*/, 4];
                                        case 3:
                                            e_1 = _a.sent();
                                            this.status = 'error';
                                            reject(e_1);
                                            return [3 /*break*/, 4];
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); }, 500);
                        }
                        catch (e) {
                            _this.status = 'error';
                            reject(e);
                        }
                    })];
            });
        });
    };
    MCPClient.prototype.handleData = function (data) {
        this.buffer += data;
        // Process complete JSON-RPC messages (newline-delimited)
        var lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            if (!line.trim())
                continue;
            try {
                var message = JSON.parse(line);
                if (message.id !== undefined && this.pendingRequests.has(message.id)) {
                    var _a = this.pendingRequests.get(message.id), resolve = _a.resolve, reject = _a.reject;
                    this.pendingRequests.delete(message.id);
                    if (message.error) {
                        reject(new Error(message.error.message || 'MCP error'));
                    }
                    else {
                        resolve(message.result);
                    }
                }
            }
            catch (e) {
                console.error("[MCP ".concat(this.name, "] Failed to parse message:"), line, e);
            }
        }
    };
    MCPClient.prototype.send = function (method, params) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var _a;
            if (!((_a = _this.process) === null || _a === void 0 ? void 0 : _a.stdin)) {
                reject(new Error('MCP process not connected'));
                return;
            }
            var id = ++_this.messageId;
            var message = {
                jsonrpc: '2.0',
                id: id,
                method: method,
                params: params
            };
            _this.pendingRequests.set(id, { resolve: resolve, reject: reject });
            _this.process.stdin.write(JSON.stringify(message) + '\n');
            // Timeout after 30 seconds
            setTimeout(function () {
                if (_this.pendingRequests.has(id)) {
                    _this.pendingRequests.delete(id);
                    reject(new Error('MCP request timeout'));
                }
            }, 30000);
        });
    };
    MCPClient.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send('initialize', {
                            protocolVersion: '2024-11-05',
                            capabilities: {},
                            clientInfo: {
                                name: 'Workbench',
                                version: '0.2.0'
                            }
                        })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.send('notifications/initialized')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MCPClient.prototype.loadTools = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send('tools/list')];
                    case 1:
                        result = _a.sent();
                        this.tools = result.tools || [];
                        console.log("[MCP ".concat(this.name, "] Loaded ").concat(this.tools.length, " tools"));
                        return [2 /*return*/];
                }
            });
        });
    };
    MCPClient.prototype.callTool = function (toolName, args) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send('tools/call', {
                            name: toolName,
                            arguments: args
                        })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    MCPClient.prototype.disconnect = function () {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.status = 'disconnected';
        this.tools = [];
    };
    return MCPClient;
}());
var mcpClients = new Map();
function loadMCPServers() {
    var _this = this;
    var serverConfigs = store.get('mcpServers') || [];
    console.log('[loadMCPServers] Loading MCP servers:', serverConfigs.length);
    serverConfigs.forEach(function (config) { return __awaiter(_this, void 0, void 0, function () {
        var client, e_2;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!config.name || !config.command)
                        return [2 /*return*/];
                    client = new MCPClient(config.name, config.command, config.args || []);
                    mcpClients.set(config.name, client);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.connect()];
                case 2:
                    _a.sent();
                    // Register MCP tools with mcp. prefix
                    client.tools.forEach(function (tool) {
                        var toolName = "mcp.".concat(config.name, ".").concat(tool.name);
                        tools.set(toolName, {
                            name: toolName,
                            description: tool.description,
                            inputSchema: tool.inputSchema,
                            mcpServer: config.name,
                            mcpToolName: tool.name,
                            run: function (input) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, client.callTool(tool.name, input)];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }
                        });
                    });
                    console.log("[MCP] Connected to ".concat(config.name, ", registered ").concat(client.tools.length, " tools"));
                    return [3 /*break*/, 4];
                case 3:
                    e_2 = _a.sent();
                    console.error("[MCP] Failed to connect to ".concat(config.name, ":"), e_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
}
// ============================================================================
// IPC HANDLERS
// ============================================================================
// Config
electron_1.ipcMain.handle('config:get', function () { return store.store; });
electron_1.ipcMain.handle('config:set', function (_e, partial) {
    store.set(partial);
    return store.store;
});
// Plugins
electron_1.ipcMain.handle('plugins:reload', function () {
    loadPlugins();
    return true;
});
electron_1.ipcMain.handle('plugins:save', function (_e, pluginName, code) { return __awaiter(void 0, void 0, void 0, function () {
    var pluginsDir, safeName, pluginPath, cleanCode, fenceMatch;
    return __generator(this, function (_a) {
        pluginsDir = store.get('pluginsDir') || path_1.default.join(__dirname, 'plugins');
        safeName = pluginName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
        if (!safeName)
            throw new Error('Invalid plugin name');
        pluginPath = path_1.default.join(pluginsDir, safeName);
        if (!fs_1.default.existsSync(pluginPath)) {
            fs_1.default.mkdirSync(pluginPath, { recursive: true });
        }
        cleanCode = code;
        fenceMatch = code.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/);
        if (fenceMatch) {
            cleanCode = fenceMatch[1].trim();
        }
        fs_1.default.writeFileSync(path_1.default.join(pluginPath, 'index.js'), cleanCode, 'utf-8');
        fs_1.default.writeFileSync(path_1.default.join(pluginPath, 'package.json'), '{\n  "type": "commonjs"\n}\n', 'utf-8');
        loadPlugins();
        return [2 /*return*/, { success: true, path: pluginPath, name: safeName }];
    });
}); });
// Delete a plugin
// Delete a plugin
electron_1.ipcMain.handle('plugins:delete', function (_e, pluginName) { return __awaiter(void 0, void 0, void 0, function () {
    var pluginsDir, safeName, pluginPath;
    return __generator(this, function (_a) {
        pluginsDir = store.get('pluginsDir') || path_1.default.join(__dirname, 'plugins');
        safeName = pluginName.replace(/[^a-zA-Z0-9_-]/g, '_');
        pluginPath = path_1.default.join(pluginsDir, safeName);
        if (!fs_1.default.existsSync(pluginPath)) {
            throw new Error("Plugin \"".concat(pluginName, "\" not found"));
        }
        // Only allow deleting custom plugins, not built-in ones
        fs_1.default.rmSync(pluginPath, { recursive: true, force: true });
        console.log('[plugins:delete] Deleted plugin:', safeName);
        loadPlugins();
        return [2 /*return*/, { success: true, name: safeName }];
    });
}); });
// Tools
electron_1.ipcMain.handle('tools:list', function () {
    return Array.from(tools.values()).map(function (t) { return ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        category: t.name.split('.')[0],
        _sourceFolder: t._sourceFolder
    }); });
});
electron_1.ipcMain.handle('tools:refresh', function () {
    console.log('[IPC] Refreshing tools...');
    loadPlugins();
    return Array.from(tools.values()).map(function (t) { return ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        category: t.name.split('.')[0],
        _sourceFolder: t._sourceFolder
    }); });
});
electron_1.ipcMain.handle('tools:run', function (_e, name, input) { return __awaiter(void 0, void 0, void 0, function () {
    var tool, rawOutput;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tool = tools.get(name);
                if (!tool)
                    throw new Error("Tool not found: ".concat(name));
                return [4 /*yield*/, tool.run(input)];
            case 1:
                rawOutput = _a.sent();
                return [2 /*return*/, normalizeToolOutput(rawOutput)];
        }
    });
}); });
var sessionCosts = { total: 0, requests: 0, byModel: {} };
// Cost calculation based on OpenRouter pricing
function calculateCost(model, promptTokens, completionTokens) {
    // Approximate pricing per 1M tokens (adjust based on actual OpenRouter pricing)
    var pricing = {
        'anthropic/claude-3.5-sonnet': { prompt: 3, completion: 15 },
        'anthropic/claude-3-haiku': { prompt: 0.25, completion: 1.25 },
        'openai/gpt-4o': { prompt: 2.5, completion: 10 },
        'openai/gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
        'default': { prompt: 1, completion: 2 }
    };
    var rates = pricing[model] || pricing['default'];
    return (promptTokens * rates.prompt / 1000000) + (completionTokens * rates.completion / 1000000);
}
electron_1.ipcMain.handle('costs:get', function () { return sessionCosts; });
electron_1.ipcMain.handle('costs:reset', function () {
    sessionCosts = { total: 0, requests: 0, byModel: {} };
    return sessionCosts;
});
// Task runner (non-streaming)
electron_1.ipcMain.handle('task:run', function (_e_1, taskType_1, prompt_1) {
    var args_1 = [];
    for (var _i = 3; _i < arguments.length; _i++) {
        args_1[_i - 3] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([_e_1, taskType_1, prompt_1], args_1, true), void 0, function (_e, taskType, prompt, includeTools) {
        var config, router, roleConfig, apiKey, apiEndpoint, messages, toolsList, systemPrompt, res, usage;
        var _a, _b, _c, _d;
        if (includeTools === void 0) { includeTools = false; }
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    config = store.store;
                    router = config.router || {};
                    roleConfig = router[taskType];
                    if (!(roleConfig === null || roleConfig === void 0 ? void 0 : roleConfig.model))
                        throw new Error("No model configured for task type: ".concat(taskType));
                    apiKey = config.openrouterApiKey;
                    if (!apiKey)
                        throw new Error('No API key configured');
                    apiEndpoint = config.apiEndpoint || 'https://openrouter.ai/api/v1';
                    messages = [];
                    // Add system prompt with tools if requested
                    if (includeTools) {
                        toolsList = Array.from(tools.values())
                            .filter(function (t) { return !t.name.startsWith('builtin.'); })
                            .map(function (t) { return "- ".concat(t.name, ": ").concat(t.description || 'No description'); })
                            .join('\n');
                        systemPrompt = "You are a helpful AI assistant with access to tools that can perform actions.\n\nAvailable tools:\n".concat(toolsList, "\n\nWhen a user asks you to create, build, or do something, you should USE THE APPROPRIATE TOOL instead of just providing instructions.\n\nFor example:\n- If asked to \"create an artifact to connect Google Calendar\", use the workbench.convertArtifact tool\n- If asked to \"build a tool for X\", use the workbench.convertArtifact tool\n- If asked to create/generate code or plugins, use the appropriate tool\n\nYour response should indicate which tool you would use and with what parameters. Format like:\nTOOL: tool.name\nINPUT: { \"param\": \"value\" }\n\nBe action-oriented. Do things, don't just explain how to do them.");
                        messages.push({ role: 'system', content: systemPrompt });
                    }
                    messages.push({ role: 'user', content: prompt });
                    return [4 /*yield*/, axios_1.default.post("".concat(apiEndpoint, "/chat/completions"), {
                            model: roleConfig.model,
                            messages: messages,
                        }, {
                            headers: {
                                'Authorization': "Bearer ".concat(apiKey),
                                'Content-Type': 'application/json',
                            },
                        })];
                case 1:
                    res = _f.sent();
                    usage = res.data.usage;
                    if (usage) {
                        sessionCosts.requests++;
                        // OpenRouter includes cost in generation response
                        if ((_a = res.data.usage) === null || _a === void 0 ? void 0 : _a.total_cost) {
                            sessionCosts.total += res.data.usage.total_cost;
                        }
                    }
                    return [2 /*return*/, {
                            content: ((_d = (_c = (_b = res.data.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || '',
                            usage: res.data.usage,
                            model: res.data.model,
                            sessionCosts: __assign({}, sessionCosts)
                        }];
            }
        });
    });
});
// List available models from OpenRouter
electron_1.ipcMain.handle('models:list', function () { return __awaiter(void 0, void 0, void 0, function () {
    var config, apiKey, res, models, e_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                config = store.store;
                apiKey = config.openrouterApiKey;
                if (!apiKey) {
                    throw new Error('No OpenRouter API key configured');
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, axios_1.default.get('https://openrouter.ai/api/v1/models', {
                        headers: {
                            'Authorization': "Bearer ".concat(apiKey),
                        },
                    })];
            case 2:
                res = _a.sent();
                models = res.data.data.map(function (m) {
                    var _a, _b, _c, _d;
                    return ({
                        id: m.id,
                        name: m.name,
                        description: m.description,
                        context_length: m.context_length,
                        pricing: {
                            prompt: ((_a = m.pricing) === null || _a === void 0 ? void 0 : _a.prompt) ? parseFloat(m.pricing.prompt) : 0,
                            completion: ((_b = m.pricing) === null || _b === void 0 ? void 0 : _b.completion) ? parseFloat(m.pricing.completion) : 0,
                        },
                        top_provider: m.top_provider,
                        per_million_prompt: ((_c = m.pricing) === null || _c === void 0 ? void 0 : _c.prompt) ? (parseFloat(m.pricing.prompt) * 1000000).toFixed(2) : '0',
                        per_million_completion: ((_d = m.pricing) === null || _d === void 0 ? void 0 : _d.completion) ? (parseFloat(m.pricing.completion) * 1000000).toFixed(2) : '0',
                    });
                });
                // Sort by prompt price
                models.sort(function (a, b) { return a.pricing.prompt - b.pricing.prompt; });
                return [2 /*return*/, models];
            case 3:
                e_3 = _a.sent();
                throw new Error("Failed to fetch models: ".concat(e_3.message));
            case 4: return [2 /*return*/];
        }
    });
}); });
// Template variable replacement
function processTemplateVariables(text) {
    var now = new Date();
    var user = require('os').userInfo().username;
    return text
        .replace(/\{\{today\}\}/g, now.toLocaleDateString())
        .replace(/\{\{time\}\}/g, now.toLocaleTimeString())
        .replace(/\{\{datetime\}\}/g, now.toLocaleString())
        .replace(/\{\{user\}\}/g, user)
        .replace(/\{\{clipboard\}\}/g, electron_1.clipboard.readText());
}
// Streaming task runner
electron_1.ipcMain.handle('task:runStream', function (_e, taskType, prompt, requestId) { return __awaiter(void 0, void 0, void 0, function () {
    var config, router, roleConfig, error, apiKey, error, apiEndpoint, processedPrompt, res, fullContent_1, promptTokens_1, completionTokens_1, e_4, errorDetails, errorMessage;
    var _a, _b, _c, _d, _f, _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                config = store.store;
                router = config.router || {};
                roleConfig = router[taskType];
                // Check if model is configured
                if (!(roleConfig === null || roleConfig === void 0 ? void 0 : roleConfig.model)) {
                    error = "No model configured for \"".concat(taskType, "\". Please configure a model in Settings tab.");
                    console.error('[task:runStream]', error);
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('stream:error', { requestId: requestId, error: error });
                    throw new Error(error);
                }
                apiKey = config.openrouterApiKey;
                if (!apiKey) {
                    error = 'No API key configured. Please add your API key in Settings tab.';
                    console.error('[task:runStream]', error);
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('stream:error', { requestId: requestId, error: error });
                    throw new Error(error);
                }
                apiEndpoint = config.apiEndpoint || 'https://openrouter.ai/api/v1';
                console.log("[task:runStream] Model: ".concat(roleConfig.model, ", TaskType: ").concat(taskType));
                processedPrompt = processTemplateVariables(prompt);
                _k.label = 1;
            case 1:
                _k.trys.push([1, 3, , 4]);
                return [4 /*yield*/, axios_1.default.post("".concat(apiEndpoint, "/chat/completions"), {
                        model: roleConfig.model,
                        messages: [
                            {
                                role: 'system',
                                content: "You are a helpful AI assistant integrated into Workbench - a desktop application with tools.\n\nCRITICAL: When users say \"build\", \"create a tool\", or \"make an artifact\", you should IMMEDIATELY generate the complete code for a Workbench plugin. Don't ask for confirmation or details - just build it based on their request.\n\nWorkbench Plugin Format:\n```javascript\nmodule.exports.register = (api) => {\n  api.registerTool({\n    name: 'category.toolName',\n    inputSchema: {\n      type: 'object',\n      properties: {\n        // input parameters\n      },\n      required: []\n    },\n    run: async (input) => {\n      // Tool logic here\n      // For API calls, return the data or result\n      return { result: 'data' };\n    }\n  });\n};\n```\n\nWhen user asks you to build something:\n1. Generate the COMPLETE plugin code immediately\n2. Explain what it does briefly\n3. Tell them to save it in the plugins folder\n\nExample:\nUser: \"Build a tool that tells me the temperature\"\nYou: \"Here's a weather temperature tool for Workbench:\n\n```javascript\nmodule.exports.register = (api) => {\n  api.registerTool({\n    name: 'weather.temperature',\n    inputSchema: {\n      type: 'object',\n      properties: {\n        city: { type: 'string', description: 'City name' }\n      },\n      required: ['city']\n    },\n    run: async (input) => {\n      // In production, you'd call a real weather API\n      return { \n        temperature: 72,\n        city: input.city,\n        message: `Temperature in ${input.city} is 72\u00B0F`\n      };\n    }\n  });\n};\n```\n\nThis tool fetches temperature data. Save this as `plugins/weather_temperature/index.js` and restart Workbench to use it.\"\n\nBE PROACTIVE. BUILD THE CODE IMMEDIATELY when asked."
                            },
                            { role: 'user', content: processedPrompt }
                        ],
                        stream: true
                    }, {
                        headers: {
                            'Authorization': "Bearer ".concat(apiKey),
                            'Content-Type': 'application/json',
                        },
                        responseType: 'stream'
                    })];
            case 2:
                res = _k.sent();
                fullContent_1 = '';
                promptTokens_1 = 0;
                completionTokens_1 = 0;
                res.data.on('data', function (chunk) {
                    var _a, _b, _c;
                    var lines = chunk.toString().split('\n').filter(function (line) { return line.trim().startsWith('data:'); });
                    for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
                        var line = lines_2[_i];
                        var data = line.replace('data:', '').trim();
                        if (data === '[DONE]') {
                            // Track costs
                            var cost = calculateCost(roleConfig.model, promptTokens_1, completionTokens_1);
                            sessionCosts.total += cost;
                            sessionCosts.requests += 1;
                            if (!sessionCosts.byModel[roleConfig.model]) {
                                sessionCosts.byModel[roleConfig.model] = { cost: 0, requests: 0, tokens: { prompt: 0, completion: 0 } };
                            }
                            sessionCosts.byModel[roleConfig.model].cost += cost;
                            sessionCosts.byModel[roleConfig.model].requests += 1;
                            sessionCosts.byModel[roleConfig.model].tokens.prompt += promptTokens_1;
                            sessionCosts.byModel[roleConfig.model].tokens.completion += completionTokens_1;
                            mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('stream:done', { requestId: requestId, content: fullContent_1, cost: cost, tokens: { prompt: promptTokens_1, completion: completionTokens_1 } });
                            return;
                        }
                        try {
                            var parsed = JSON.parse(data);
                            var delta = ((_c = (_b = (_a = parsed.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.delta) === null || _c === void 0 ? void 0 : _c.content) || '';
                            if (delta) {
                                fullContent_1 += delta;
                                mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('stream:chunk', { requestId: requestId, chunk: delta, content: fullContent_1 });
                            }
                            // Track usage if available
                            if (parsed.usage) {
                                promptTokens_1 = parsed.usage.prompt_tokens || 0;
                                completionTokens_1 = parsed.usage.completion_tokens || 0;
                            }
                        }
                        catch (e) {
                            // Skip malformed chunks
                        }
                    }
                });
                res.data.on('end', function () {
                    // Track costs even if no [DONE] received
                    if (promptTokens_1 > 0 || completionTokens_1 > 0) {
                        var cost = calculateCost(roleConfig.model, promptTokens_1, completionTokens_1);
                        sessionCosts.total += cost;
                        sessionCosts.requests += 1;
                        if (!sessionCosts.byModel[roleConfig.model]) {
                            sessionCosts.byModel[roleConfig.model] = { cost: 0, requests: 0, tokens: { prompt: 0, completion: 0 } };
                        }
                        sessionCosts.byModel[roleConfig.model].cost += cost;
                        sessionCosts.byModel[roleConfig.model].requests += 1;
                        sessionCosts.byModel[roleConfig.model].tokens.prompt += promptTokens_1;
                        sessionCosts.byModel[roleConfig.model].tokens.completion += completionTokens_1;
                    }
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('stream:done', { requestId: requestId, content: fullContent_1, cost: sessionCosts.total, tokens: { prompt: promptTokens_1, completion: completionTokens_1 } });
                });
                res.data.on('error', function (err) {
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('stream:error', { requestId: requestId, error: err.message });
                });
                return [2 /*return*/, { started: true, requestId: requestId }];
            case 3:
                e_4 = _k.sent();
                errorDetails = {
                    status: (_a = e_4.response) === null || _a === void 0 ? void 0 : _a.status,
                    statusText: (_b = e_4.response) === null || _b === void 0 ? void 0 : _b.statusText,
                    data: (_c = e_4.response) === null || _c === void 0 ? void 0 : _c.data,
                    message: e_4.message
                };
                console.error('[task:runStream] Full error:', JSON.stringify(errorDetails, null, 2));
                errorMessage = 'Request failed';
                if ((_g = (_f = (_d = e_4.response) === null || _d === void 0 ? void 0 : _d.data) === null || _f === void 0 ? void 0 : _f.error) === null || _g === void 0 ? void 0 : _g.message) {
                    errorMessage = e_4.response.data.error.message;
                }
                else if (((_h = e_4.response) === null || _h === void 0 ? void 0 : _h.status) === 404) {
                    errorMessage = "Model not found: ".concat(roleConfig.model, ". Please check the model ID in Settings.");
                }
                else if (((_j = e_4.response) === null || _j === void 0 ? void 0 : _j.status) === 400) {
                    errorMessage = "Bad request. The model \"".concat(roleConfig.model, "\" may not support this request format.");
                }
                mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('stream:error', { requestId: requestId, error: errorMessage });
                throw new Error(errorMessage);
            case 4: return [2 /*return*/];
        }
    });
}); });
// Tool chaining
electron_1.ipcMain.handle('chain:run', function (_e, steps) { return __awaiter(void 0, void 0, void 0, function () {
    var results, context, i, step, tool, resolvedInput, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                results = [];
                context = {};
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < steps.length)) return [3 /*break*/, 4];
                step = steps[i];
                tool = tools.get(step.tool);
                if (!tool)
                    throw new Error("Tool not found: ".concat(step.tool));
                resolvedInput = interpolateContext(step.input, context);
                console.log("[chain:run] Step ".concat(i + 1, ": ").concat(step.tool));
                return [4 /*yield*/, tool.run(resolvedInput)];
            case 2:
                result = _a.sent();
                results.push({ tool: step.tool, result: result });
                // Store result in context for next steps
                if (step.outputKey) {
                    context[step.outputKey] = result;
                }
                context["step".concat(i)] = result;
                context.lastResult = result;
                _a.label = 3;
            case 3:
                i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/, { results: results, context: context }];
        }
    });
}); });
function interpolateContext(input, context) {
    if (typeof input === 'string') {
        // Replace {{key}} or {{key.subkey}} patterns
        return input.replace(/\{\{([^}]+)\}\}/g, function (_, key) {
            var value = key.split('.').reduce(function (obj, k) { return obj === null || obj === void 0 ? void 0 : obj[k]; }, context);
            return value !== undefined ? (typeof value === 'string' ? value : JSON.stringify(value)) : "{{".concat(key, "}}");
        });
    }
    if (Array.isArray(input)) {
        return input.map(function (item) { return interpolateContext(item, context); });
    }
    if (typeof input === 'object' && input !== null) {
        var result = {};
        for (var _i = 0, _a = Object.entries(input); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            result[key] = interpolateContext(value, context);
        }
        return result;
    }
    return input;
}
// MCP Management
electron_1.ipcMain.handle('mcp:list', function () {
    return Array.from(mcpClients.entries()).map(function (_a) {
        var name = _a[0], client = _a[1];
        return ({
            name: name,
            status: client.status,
            toolCount: client.tools.length,
            tools: client.tools.map(function (t) { return t.name; })
        });
    });
});
electron_1.ipcMain.handle('mcp:add', function (_e, config) { return __awaiter(void 0, void 0, void 0, function () {
    var servers, client, e_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                servers = store.get('mcpServers') || [];
                servers.push(config);
                store.set('mcpServers', servers);
                client = new MCPClient(config.name, config.command, config.args || []);
                mcpClients.set(config.name, client);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, client.connect()];
            case 2:
                _a.sent();
                client.tools.forEach(function (tool) {
                    var toolName = "mcp.".concat(config.name, ".").concat(tool.name);
                    tools.set(toolName, {
                        name: toolName,
                        description: tool.description,
                        inputSchema: tool.inputSchema,
                        run: function (input) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, client.callTool(tool.name, input)];
                        }); }); }
                    });
                });
                return [2 /*return*/, { success: true, toolCount: client.tools.length }];
            case 3:
                e_5 = _a.sent();
                return [2 /*return*/, { success: false, error: e_5.message }];
            case 4: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('mcp:remove', function (_e, name) { return __awaiter(void 0, void 0, void 0, function () {
    var client, servers;
    return __generator(this, function (_a) {
        client = mcpClients.get(name);
        if (client) {
            client.disconnect();
            mcpClients.delete(name);
            // Remove MCP tools
            tools.forEach(function (_, toolName) {
                if (toolName.startsWith("mcp.".concat(name, "."))) {
                    tools.delete(toolName);
                }
            });
        }
        servers = (store.get('mcpServers') || []).filter(function (s) { return s.name !== name; });
        store.set('mcpServers', servers);
        return [2 /*return*/, { success: true }];
    });
}); });
electron_1.ipcMain.handle('mcp:reconnect', function (_e, name) { return __awaiter(void 0, void 0, void 0, function () {
    var client, e_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                client = mcpClients.get(name);
                if (!client)
                    throw new Error("MCP server not found: ".concat(name));
                client.disconnect();
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, client.connect()];
            case 2:
                _a.sent();
                client.tools.forEach(function (tool) {
                    var toolName = "mcp.".concat(name, ".").concat(tool.name);
                    tools.set(toolName, {
                        name: toolName,
                        description: tool.description,
                        inputSchema: tool.inputSchema,
                        run: function (input) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, client.callTool(tool.name, input)];
                        }); }); }
                    });
                });
                return [2 /*return*/, { success: true, toolCount: client.tools.length }];
            case 3:
                e_6 = _a.sent();
                return [2 /*return*/, { success: false, error: e_6.message }];
            case 4: return [2 /*return*/];
        }
    });
}); });
