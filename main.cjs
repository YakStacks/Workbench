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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
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
var util_1 = __importDefault(require("util"));
var fs_1 = __importDefault(require("fs"));
var net_1 = __importDefault(require("net"));
var child_process_1 = require("child_process");
var electron_store_1 = __importDefault(require("electron-store"));
var axios_1 = __importDefault(require("axios"));
var doctor_1 = require("./doctor.cjs");
var permissions_1 = require("./permissions.cjs");
var store = new electron_store_1.default();
var permissionManager = new permissions_1.PermissionManager(store);
var mainWindow = null;
var tray = null;
var plugins = [];
var tools = new Map();
// Add isQuitting flag to app
var isQuitting = false;
// Normalize tool output to standard format
function normalizeToolOutput(output) {
    // Already in correct format
    if (output && typeof output === "object" && "content" in output) {
        return output;
    }
    // Plain string
    if (typeof output === "string") {
        return { content: output };
    }
    // Error object
    if (output && output.error) {
        return {
            content: output.message || output.error,
            error: output.error,
            metadata: output,
        };
    }
    // Any other object - serialize it
    return {
        content: JSON.stringify(output, null, 2),
        metadata: output,
    };
}
var mcpServers = new Map();
function createWindow() {
    var iconPath;
    if (electron_1.app.isPackaged) {
        // For Windows, use .ico file
        iconPath = path_1.default.join(process.resourcesPath, "icon.ico");
    }
    else {
        iconPath = path_1.default.join(electron_1.app.getAppPath(), "icon.ico");
    }
    // Fallback if icon not found
    if (!fs_1.default.existsSync(iconPath)) {
        console.log("[createWindow] Icon not found at:", iconPath);
        iconPath = "";
    }
    mainWindow = new electron_1.BrowserWindow(__assign(__assign({ width: 1200, height: 800 }, (iconPath && { icon: iconPath })), { webPreferences: {
            preload: path_1.default.join(__dirname, "preload.cjs"),
            nodeIntegration: false,
            contextIsolation: true,
        } }));
    // Always load from dist folder - use `npm run dev` for hot reload
    mainWindow.loadFile(path_1.default.join(__dirname, "dist", "index.html"));
    // Minimize to tray instead of closing
    mainWindow.on("close", function (event) {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.hide();
        }
    });
}
function createTray() {
    var iconPath;
    if (electron_1.app.isPackaged) {
        // Use the same icon.ico that's embedded in the exe
        iconPath = path_1.default.join(process.resourcesPath, "icon.ico");
    }
    else {
        iconPath = path_1.default.join(electron_1.app.getAppPath(), "build", "icon.png");
    }
    console.log("[createTray] Looking for icon at:", iconPath);
    if (!fs_1.default.existsSync(iconPath)) {
        console.log("[createTray] Icon not found, skipping tray");
        return; // Don't create tray if icon missing
    }
    // Create native image from icon
    var icon = electron_1.nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
        console.log("[createTray] Icon is empty, skipping tray");
        return;
    }
    console.log("[createTray] Icon size:", icon.getSize());
    tray = new electron_1.Tray(icon.resize({ width: 16, height: 16 }));
    var contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: "Show Workbench",
            click: function () {
                mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.show();
                mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.focus();
            },
        },
        { type: "separator" },
        {
            label: "Quit",
            click: function () {
                isQuitting = true;
                electron_1.app.quit();
            },
        },
    ]);
    tray.setToolTip("Workbench");
    tray.setContextMenu(contextMenu);
    // Double-click to show window
    tray.on("double-click", function () {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.show();
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.focus();
    });
}
electron_1.app.whenReady().then(function () {
    createWindow();
    createTray();
    loadPlugins();
    registerBuiltinTools();
    loadMCPServers();
});
electron_1.app.on("window-all-closed", function () {
    // Cleanup MCP servers
    mcpServers.forEach(function (server) {
        if (server.process) {
            server.process.kill();
        }
    });
    if (process.platform !== "darwin")
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
        if (name.startsWith("builtin.") || name.startsWith("mcp.")) {
            builtinTools.set(name, tool);
        }
    });
    tools = builtinTools;
    var pluginsDir = store.get("pluginsDir") || path_1.default.join(__dirname, "plugins");
    console.log("[loadPlugins] Looking for plugins in:", pluginsDir);
    if (!pluginsDir ||
        typeof pluginsDir !== "string" ||
        !fs_1.default.existsSync(pluginsDir)) {
        console.log("[loadPlugins] Plugins directory not found");
        return;
    }
    var folders = fs_1.default
        .readdirSync(pluginsDir, { withFileTypes: true })
        .filter(function (dirent) { return dirent.isDirectory(); })
        .map(function (dirent) { return dirent.name; });
    console.log("[loadPlugins] Found folders:", folders);
    folders.forEach(function (folder) {
        var pluginPath = path_1.default.join(pluginsDir, folder, "index.js");
        if (fs_1.default.existsSync(pluginPath)) {
            try {
                // Clear require cache for hot reload
                delete require.cache[require.resolve(pluginPath)];
                var plugin = require(pluginPath);
                if (plugin && typeof plugin.register === "function") {
                    plugin.register({
                        registerTool: function (tool) {
                            // Store source folder for delete functionality
                            tool._sourceFolder = folder;
                            tool._sourcePath = pluginPath;
                            console.log("[loadPlugins] Registered tool:", tool.name, "from folder:", folder);
                            tools.set(tool.name, tool);
                            // Register permissions if declared
                            if (tool.permissions) {
                                permissionManager.registerToolPermissions(tool.name, tool.permissions);
                                console.log("[loadPlugins] Registered permissions for ".concat(tool.name));
                            }
                        },
                        getPluginsDir: function () { return pluginsDir; },
                        reloadPlugins: function () { return loadPlugins(); },
                    });
                }
            }
            catch (e) {
                console.error("[loadPlugins] Error loading plugin:", folder, e);
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
    tools.set("builtin.readFile", {
        name: "builtin.readFile",
        description: "Read contents of a file",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "File path to read" },
                encoding: {
                    type: "string",
                    description: "Encoding (default: utf-8)",
                    default: "utf-8",
                },
            },
            required: ["path"],
        },
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var safePath, content;
            return __generator(this, function (_a) {
                safePath = resolveSafePath(input.path);
                assertPathSafe(safePath);
                content = fs_1.default.readFileSync(safePath, {
                    encoding: (input.encoding || "utf-8"),
                });
                return [2 /*return*/, { content: content, path: safePath, size: content.length }];
            });
        }); },
    });
    permissionManager.registerToolPermissions("builtin.readFile", {
        filesystem: { actions: ["read"] },
    });
    tools.set("builtin.writeFile", {
        name: "builtin.writeFile",
        description: "Write contents to a file",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "File path to write" },
                content: { type: "string", description: "Content to write" },
                append: {
                    type: "boolean",
                    description: "Append instead of overwrite",
                    default: false,
                },
            },
            required: ["path", "content"],
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
                    fs_1.default.appendFileSync(safePath, input.content, "utf-8");
                }
                else {
                    fs_1.default.writeFileSync(safePath, input.content, "utf-8");
                }
                return [2 /*return*/, {
                        success: true,
                        path: safePath,
                        bytesWritten: input.content.length,
                    }];
            });
        }); },
    });
    permissionManager.registerToolPermissions("builtin.writeFile", {
        filesystem: { actions: ["write"] },
    });
    tools.set("builtin.listDir", {
        name: "builtin.listDir",
        description: "List contents of a directory",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Directory path" },
                recursive: {
                    type: "boolean",
                    description: "List recursively",
                    default: false,
                },
            },
            required: ["path"],
        },
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var safePath, entries;
            return __generator(this, function (_a) {
                safePath = resolveSafePath(input.path);
                assertPathSafe(safePath);
                entries = listDirRecursive(safePath, input.recursive || false, 0, 3);
                return [2 /*return*/, { path: safePath, entries: entries }];
            });
        }); },
    });
    permissionManager.registerToolPermissions("builtin.listDir", {
        filesystem: { actions: ["read"] },
    });
    tools.set("builtin.fileExists", {
        name: "builtin.fileExists",
        description: "Check if a file or directory exists",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to check" },
            },
            required: ["path"],
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
        }); },
    });
    // Clipboard Tools
    tools.set("builtin.clipboardRead", {
        name: "builtin.clipboardRead",
        description: "Read text from system clipboard",
        inputSchema: { type: "object", properties: {} },
        run: function () { return __awaiter(_this, void 0, void 0, function () {
            var text;
            return __generator(this, function (_a) {
                text = electron_1.clipboard.readText();
                return [2 /*return*/, { content: text, length: text.length }];
            });
        }); },
    });
    tools.set("builtin.clipboardWrite", {
        name: "builtin.clipboardWrite",
        description: "Write text to system clipboard",
        inputSchema: {
            type: "object",
            properties: {
                content: { type: "string", description: "Text to copy to clipboard" },
            },
            required: ["content"],
        },
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                electron_1.clipboard.writeText(input.content);
                return [2 /*return*/, { success: true, length: input.content.length }];
            });
        }); },
    });
    // Shell Execution Tool
    tools.set("builtin.shell", {
        name: "builtin.shell",
        description: "Execute a shell command",
        inputSchema: {
            type: "object",
            properties: {
                command: { type: "string", description: "Command to execute" },
                cwd: { type: "string", description: "Working directory" },
                timeout: {
                    type: "number",
                    description: "Timeout in ms (default: 30000)",
                    default: 30000,
                },
            },
            required: ["command"],
        },
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        var _a, _b;
                        var cwd = input.cwd ? resolveSafePath(input.cwd) : process.cwd();
                        var isWindows = process.platform === "win32";
                        var shell = isWindows ? "cmd.exe" : "/bin/sh";
                        var shellArg = isWindows ? "/c" : "-c";
                        var proc = (0, child_process_1.spawn)(shell, [shellArg, input.command], {
                            cwd: cwd,
                            timeout: input.timeout || 30000,
                            env: process.env,
                        });
                        var stdout = "";
                        var stderr = "";
                        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on("data", function (data) {
                            stdout += data.toString();
                        });
                        (_b = proc.stderr) === null || _b === void 0 ? void 0 : _b.on("data", function (data) {
                            stderr += data.toString();
                        });
                        proc.on("close", function (code) {
                            resolve({ exitCode: code, stdout: stdout, stderr: stderr, command: input.command });
                        });
                        proc.on("error", function (err) {
                            resolve({
                                exitCode: -1,
                                stdout: stdout,
                                stderr: stderr,
                                error: err.message,
                                command: input.command,
                            });
                        });
                    })];
            });
        }); },
    });
    permissionManager.registerToolPermissions("builtin.shell", {
        process: { actions: ["spawn"] },
    });
    console.log("[registerBuiltinTools] Registered builtin tools");
    // System Info Tools
    tools.set("builtin.systemInfo", {
        name: "builtin.systemInfo",
        description: "Get system information (OS, CPU, memory, etc.)",
        inputSchema: { type: "object", properties: {} },
        run: function () { return __awaiter(_this, void 0, void 0, function () {
            var os;
            return __generator(this, function (_a) {
                os = require("os");
                return [2 /*return*/, {
                        platform: os.platform(),
                        release: os.release(),
                        arch: os.arch(),
                        hostname: os.hostname(),
                        uptime: os.uptime(),
                        cpus: os
                            .cpus()
                            .map(function (cpu) { return ({ model: cpu.model, speed: cpu.speed }); }),
                        totalMemory: os.totalmem(),
                        freeMemory: os.freemem(),
                        usedMemory: os.totalmem() - os.freemem(),
                        memoryUsagePercent: (((os.totalmem() - os.freemem()) / os.totalmem()) *
                            100).toFixed(1),
                        homeDir: os.homedir(),
                        tempDir: os.tmpdir(),
                        userInfo: os.userInfo(),
                    }];
            });
        }); },
    });
    tools.set("builtin.processes", {
        name: "builtin.processes",
        description: "List running processes",
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "number",
                    description: "Max processes to return (default 20)",
                    default: 20,
                },
            },
        },
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        var _a;
                        var limit = input.limit || 20;
                        var isWindows = process.platform === "win32";
                        var cmd = isWindows ? "tasklist" : "ps aux";
                        var proc = (0, child_process_1.spawn)(isWindows ? "cmd.exe" : "/bin/sh", [isWindows ? "/c" : "-c", cmd], {
                            timeout: 10000,
                        });
                        var output = "";
                        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on("data", function (data) {
                            output += data.toString();
                        });
                        proc.on("close", function () {
                            var lines = output.trim().split("\n");
                            resolve({
                                count: lines.length - 1,
                                processes: lines.slice(1, limit + 1),
                                raw: lines.slice(0, limit + 1).join("\n"),
                            });
                        });
                        proc.on("error", function (err) {
                            resolve({ error: err.message });
                        });
                    })];
            });
        }); },
    });
    tools.set("builtin.diskSpace", {
        name: "builtin.diskSpace",
        description: "Check disk space usage",
        inputSchema: { type: "object", properties: {} },
        run: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        var _a;
                        var isWindows = process.platform === "win32";
                        var cmd = isWindows
                            ? "wmic logicaldisk get size,freespace,caption"
                            : "df -h";
                        var proc = (0, child_process_1.spawn)(isWindows ? "cmd.exe" : "/bin/sh", [isWindows ? "/c" : "-c", cmd], {
                            timeout: 10000,
                        });
                        var output = "";
                        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on("data", function (data) {
                            output += data.toString();
                        });
                        proc.on("close", function () {
                            resolve({ raw: output.trim() });
                        });
                        proc.on("error", function (err) {
                            resolve({ error: err.message });
                        });
                    })];
            });
        }); },
    });
    tools.set("builtin.networkInfo", {
        name: "builtin.networkInfo",
        description: "Get network interface information",
        inputSchema: { type: "object", properties: {} },
        run: function () { return __awaiter(_this, void 0, void 0, function () {
            var os, interfaces, result, _i, _a, _b, name_1, addrs;
            return __generator(this, function (_c) {
                os = require("os");
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
        }); },
    });
    tools.set("builtin.envVars", {
        name: "builtin.envVars",
        description: "List environment variables (filtered for safety)",
        inputSchema: {
            type: "object",
            properties: {
                filter: {
                    type: "string",
                    description: "Filter by variable name (case-insensitive)",
                },
            },
        },
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var env, safeKeys, result;
            return __generator(this, function (_a) {
                env = process.env;
                safeKeys = Object.keys(env).filter(function (key) {
                    // Filter out sensitive-looking keys
                    var lower = key.toLowerCase();
                    if (lower.includes("key") ||
                        lower.includes("secret") ||
                        lower.includes("password") ||
                        lower.includes("token") ||
                        lower.includes("credential")) {
                        return false;
                    }
                    if (input.filter) {
                        return lower.includes(input.filter.toLowerCase());
                    }
                    return true;
                });
                result = {};
                safeKeys.forEach(function (key) {
                    result[key] = env[key] || "";
                });
                return [2 /*return*/, { count: safeKeys.length, variables: result }];
            });
        }); },
    });
    tools.set("builtin.installedApps", {
        name: "builtin.installedApps",
        description: "List installed applications (Windows only)",
        inputSchema: { type: "object", properties: {} },
        run: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (process.platform !== "win32") {
                    return [2 /*return*/, { error: "This tool only works on Windows" }];
                }
                return [2 /*return*/, new Promise(function (resolve) {
                        var _a;
                        var cmd = "wmic product get name,version";
                        var proc = (0, child_process_1.spawn)("cmd.exe", ["/c", cmd], { timeout: 30000 });
                        var output = "";
                        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on("data", function (data) {
                            output += data.toString();
                        });
                        proc.on("close", function () {
                            var lines = output
                                .trim()
                                .split("\n")
                                .slice(1)
                                .filter(function (l) { return l.trim(); });
                            resolve({
                                count: lines.length,
                                apps: lines.slice(0, 50).map(function (l) { return l.trim(); }),
                            });
                        });
                        proc.on("error", function (err) {
                            resolve({ error: err.message });
                        });
                    })];
            });
        }); },
    });
}
function resolveSafePath(inputPath) {
    var normalized = inputPath.trim();
    // Allow absolute paths or resolve relative to user's home
    if (path_1.default.isAbsolute(normalized)) {
        return normalized;
    }
    var workingDir = store.get("workingDir") || electron_1.app.getPath("home");
    return path_1.default.resolve(workingDir, normalized);
}
function isPathSafe(targetPath) {
    var safePaths = store.get("safePaths") || [];
    var workingDir = store.get("workingDir");
    // If no safe paths configured, allow workingDir and home
    if (safePaths.length === 0) {
        var allowedRoots = [workingDir, electron_1.app.getPath("home"), process.cwd()].filter(Boolean);
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
                type: entry.isDirectory() ? "directory" : "file",
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
        this.buffer = "";
        this.tools = [];
        this.status = "disconnected";
    }
    MCPClient.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Wrap connection in timeout
                return [2 /*return*/, Promise.race([
                        this._doConnect(),
                        new Promise(function (_, reject) {
                            return setTimeout(function () { return reject(new Error("Connection timeout after 30 seconds")); }, 30000);
                        }),
                    ])];
            });
        });
    };
    MCPClient.prototype._doConnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        _this.status = "connecting";
                        try {
                            console.log("[MCP ".concat(_this.name, "] Spawning process: ").concat(_this.command, " ").concat(_this.args.join(" ")));
                            // Create environment for clean Node.js execution
                            var cleanEnv = __assign({}, process.env);
                            delete cleanEnv.NODE_CHANNEL_FD; // Remove Electron IPC channel
                            // Add ELECTRON_RUN_AS_NODE to make spawned process behave like plain Node
                            cleanEnv.ELECTRON_RUN_AS_NODE = "1";
                            // Ensure unbuffered stdio
                            cleanEnv.NODE_NO_READLINE = "1";
                            cleanEnv.PYTHONUNBUFFERED = "1";
                            // On Windows, use process.execPath (Electron as Node) or explicit node command
                            var isWindows = process.platform === "win32";
                            var command = _this.command;
                            var args = _this.args;
                            if (isWindows && _this.command === "npx") {
                                // Extract package name and resolve to actual JS entry point
                                var packageArg_1 = args.find(function (arg) {
                                    return arg.startsWith("@modelcontextprotocol/");
                                });
                                if (packageArg_1) {
                                    // Build the direct path to the server's dist/index.js
                                    var modulePath = path_1.default.join(__dirname, "node_modules", packageArg_1, "dist", "index.js");
                                    if (fs_1.default.existsSync(modulePath)) {
                                        // Use plain 'node' command from PATH, not Electron's process
                                        command = "node";
                                        args = [modulePath];
                                        console.log("[MCP ".concat(_this.name, "] Spawning system Node.js: node ").concat(modulePath));
                                    }
                                    else {
                                        // Fallback: try .bin wrapper
                                        var serverName = packageArg_1.replace("@modelcontextprotocol/", "mcp-");
                                        var binPath = path_1.default.join(__dirname, "node_modules", ".bin", "".concat(serverName, ".cmd"));
                                        if (fs_1.default.existsSync(binPath)) {
                                            command = binPath;
                                            args = args.filter(function (arg) { return arg !== "-y" && arg !== packageArg_1; });
                                            console.log("[MCP ".concat(_this.name, "] Using local .bin wrapper: ").concat(binPath));
                                        }
                                        else {
                                            // Last resort: npx.cmd
                                            command = "npx.cmd";
                                            console.log("[MCP ".concat(_this.name, "] Module not found, using npx.cmd"));
                                        }
                                    }
                                }
                                else {
                                    command = "npx.cmd";
                                }
                            }
                            _this.process = (0, child_process_1.spawn)(command, args, {
                                stdio: ["pipe", "pipe", "pipe"],
                                env: cleanEnv,
                                shell: false,
                                detached: false, // Keep process attached
                            });
                            // Prevent stdin from auto-closing
                            if (_this.process.stdin) {
                                _this.process.stdin.on("error", function (err) {
                                    console.error("[MCP ".concat(_this.name, "] stdin error:"), err);
                                });
                            }
                            // Set encoding and ensure stdout is readable
                            if (_this.process.stdout) {
                                _this.process.stdout.setEncoding("utf8");
                                _this.process.stdout.on("data", function (data) {
                                    console.log("[MCP ".concat(_this.name, "] \uD83D\uDCE5 STDOUT DATA RECEIVED (").concat(data.length, " chars):"), data.substring(0, 200));
                                    console.log("[MCP ".concat(_this.name, "] \uD83D\uDCE5 Hex dump:"), Buffer.from(data).toString("hex").substring(0, 200));
                                    _this.handleData(data.toString());
                                });
                                _this.process.stdout.on("readable", function () {
                                    console.log("[MCP ".concat(_this.name, "] stdout is readable"));
                                });
                                _this.process.stdout.on("end", function () {
                                    console.log("[MCP ".concat(_this.name, "] stdout ended"));
                                });
                            }
                            if (_this.process.stderr) {
                                _this.process.stderr.setEncoding("utf8");
                                _this.process.stderr.on("data", function (data) {
                                    console.error("[MCP ".concat(_this.name, "] stderr:"), data.toString());
                                });
                            }
                            _this.process.on("error", function (err) {
                                console.error("[MCP ".concat(_this.name, "] process error:"), err);
                                _this.status = "error";
                                reject(new Error("Failed to start MCP server: ".concat(err.message)));
                            });
                            _this.process.on("exit", function (code, signal) {
                                console.log("[MCP ".concat(_this.name, "] process exited with code: ").concat(code, ", signal: ").concat(signal));
                            });
                            _this.process.on("close", function (code, signal) {
                                console.log("[MCP ".concat(_this.name, "] process closed with code: ").concat(code, ", signal: ").concat(signal));
                                if (_this.status === "connecting") {
                                    reject(new Error("MCP server exited during connection (code ".concat(code, ", signal ").concat(signal, ")")));
                                }
                                _this.status = "disconnected";
                            });
                            // Initialize the connection
                            setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                                var e_1;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 3, , 4]);
                                            console.log("[MCP ".concat(this.name, "] Initializing..."));
                                            return [4 /*yield*/, this.initialize()];
                                        case 1:
                                            _a.sent();
                                            console.log("[MCP ".concat(this.name, "] Loading tools..."));
                                            return [4 /*yield*/, this.loadTools()];
                                        case 2:
                                            _a.sent();
                                            console.log("[MCP ".concat(this.name, "] Connected successfully with ").concat(this.tools.length, " tools"));
                                            this.status = "connected";
                                            resolve();
                                            return [3 /*break*/, 4];
                                        case 3:
                                            e_1 = _a.sent();
                                            console.error("[MCP ".concat(this.name, "] Initialization failed:"), e_1.message);
                                            this.status = "error";
                                            reject(new Error("Initialization failed: ".concat(e_1.message)));
                                            return [3 /*break*/, 4];
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); }, 500);
                        }
                        catch (e) {
                            _this.status = "error";
                            reject(new Error("Connection setup failed: ".concat(e.message)));
                        }
                    })];
            });
        });
    };
    MCPClient.prototype.handleData = function (data) {
        this.buffer += data;
        console.log("[MCP ".concat(this.name, "] Received data (").concat(data.length, " bytes):"), data.substring(0, 200));
        // Try to process messages - handle both Content-Length framing and line-delimited JSON
        while (true) {
            // First, try Content-Length framing
            var headerEndIndex = this.buffer.indexOf("\r\n\r\n");
            if (headerEndIndex !== -1) {
                var header = this.buffer.substring(0, headerEndIndex);
                var contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
                if (contentLengthMatch) {
                    var contentLength = parseInt(contentLengthMatch[1], 10);
                    var bodyStart = headerEndIndex + 4; // Skip \r\n\r\n
                    var bodyEnd = bodyStart + contentLength;
                    // Check if we have the full message body
                    if (this.buffer.length < bodyEnd) {
                        // Not enough data yet, wait for more
                        break;
                    }
                    // Extract and parse the message body
                    var body = this.buffer.substring(bodyStart, bodyEnd);
                    this.buffer = this.buffer.substring(bodyEnd);
                    try {
                        var message = JSON.parse(body);
                        this.handleMessage(message);
                    }
                    catch (e) {
                        console.error("[MCP ".concat(this.name, "] Failed to parse Content-Length message:"), body, e);
                    }
                    continue;
                }
            }
            // If no Content-Length framing, try line-delimited JSON
            var newlineIndex = this.buffer.indexOf("\n");
            if (newlineIndex !== -1) {
                var line = this.buffer.substring(0, newlineIndex).trim();
                this.buffer = this.buffer.substring(newlineIndex + 1);
                // Skip empty lines and non-JSON lines (like the "Secure MCP Filesystem Server" message)
                if (line && line.startsWith("{")) {
                    try {
                        var message = JSON.parse(line);
                        this.handleMessage(message);
                    }
                    catch (e) {
                        console.error("[MCP ".concat(this.name, "] Failed to parse line-delimited JSON:"), line, e);
                    }
                }
                continue;
            }
            // No complete message yet, wait for more data
            break;
        }
    };
    MCPClient.prototype.handleMessage = function (message) {
        console.log("[MCP ".concat(this.name, "] Received:"), message.id !== undefined
            ? "response #".concat(message.id)
            : message.method || "notification");
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
            var _a = this.pendingRequests.get(message.id), resolve = _a.resolve, reject = _a.reject;
            this.pendingRequests.delete(message.id);
            if (message.error) {
                reject(new Error(message.error.message || "MCP error"));
            }
            else {
                resolve(message.result);
            }
        }
    };
    MCPClient.prototype.send = function (method, params) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var _a;
            if (!((_a = _this.process) === null || _a === void 0 ? void 0 : _a.stdin)) {
                reject(new Error("MCP process not connected"));
                return;
            }
            var id = ++_this.messageId;
            var message = {
                jsonrpc: "2.0",
                id: id,
                method: method,
                params: params,
            };
            _this.pendingRequests.set(id, { resolve: resolve, reject: reject });
            // Use line-delimited JSON (NOT Content-Length framing)
            var body = JSON.stringify(message);
            var lineDelimitedMessage = body + "\n";
            // Debug logging
            console.log("[MCP ".concat(_this.name, "] Sending request:"), method);
            console.log("[MCP ".concat(_this.name, "] Message:"), lineDelimitedMessage.trim());
            console.log("[MCP ".concat(_this.name, "] stdin.writable:"), _this.process.stdin.writable);
            var written = _this.process.stdin.write(lineDelimitedMessage, "utf8", function (err) {
                if (err) {
                    console.error("[MCP ".concat(_this.name, "] Error writing to stdin:"), err);
                    reject(new Error("Failed to write to MCP server: ".concat(err.message)));
                }
                else {
                    console.log("[MCP ".concat(_this.name, "] \u2705 Write completed and flushed successfully"));
                }
            });
            console.log("[MCP ".concat(_this.name, "] write() returned:"), written);
            // Keep stdin open for bidirectional communication
            // Timeout after 30 seconds
            setTimeout(function () {
                if (_this.pendingRequests.has(id)) {
                    _this.pendingRequests.delete(id);
                    reject(new Error("MCP request timeout"));
                }
            }, 30000);
        });
    };
    // Send a notification (no id, no response expected)
    MCPClient.prototype.notify = function (method, params) {
        var _a;
        if (!((_a = this.process) === null || _a === void 0 ? void 0 : _a.stdin)) {
            console.error("[MCP ".concat(this.name, "] Cannot send notification: process not connected"));
            return;
        }
        var message = {
            jsonrpc: "2.0",
            method: method,
        };
        if (params !== undefined) {
            message.params = params;
        }
        // Use Content-Length framing for MCP protocol
        var body = JSON.stringify(message);
        var contentLength = Buffer.byteLength(body, "utf8");
        var framedMessage = "Content-Length: ".concat(contentLength, "\r\n\r\n").concat(body);
        console.log("[MCP ".concat(this.name, "] Sending notification:"), method, "(".concat(contentLength, " bytes)"));
        this.process.stdin.write(framedMessage);
    };
    MCPClient.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send("initialize", {
                            protocolVersion: "2024-11-05",
                            capabilities: {},
                            clientInfo: {
                                name: "Workbench",
                                version: "0.1.0",
                            },
                        })];
                    case 1:
                        _a.sent();
                        // notifications/initialized is a notification, not a request (no id, no response)
                        this.notify("notifications/initialized");
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
                    case 0: return [4 /*yield*/, this.send("tools/list")];
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
                    case 0: return [4 /*yield*/, this.send("tools/call", {
                            name: toolName,
                            arguments: args,
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
        this.status = "disconnected";
        this.tools = [];
    };
    return MCPClient;
}());
/**
 * MCP Proxy Client - connects to PipeWrench proxy via TCP
 * Same interface as MCPClient but uses TCP socket instead of stdio
 */
var MCPProxyClient = /** @class */ (function () {
    function MCPProxyClient(name, command, args, proxyPort, proxyHost) {
        if (args === void 0) { args = []; }
        if (proxyPort === void 0) { proxyPort = 9999; }
        if (proxyHost === void 0) { proxyHost = "127.0.0.1"; }
        this.name = name;
        this.command = command;
        this.args = args;
        this.socket = null;
        this.messageId = 0;
        this.pendingRequests = new Map();
        this.buffer = "";
        this.tools = [];
        this.status = "disconnected";
        this.proxyHost = proxyHost;
        this.proxyPort = proxyPort;
    }
    MCPProxyClient.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Promise.race([
                        this._doConnect(),
                        new Promise(function (_, reject) {
                            return setTimeout(function () { return reject(new Error("Proxy connection timeout after 30 seconds")); }, 30000);
                        }),
                    ])];
            });
        });
    };
    MCPProxyClient.prototype._doConnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        _this.status = "connecting";
                        console.log("[MCPProxy ".concat(_this.name, "] Connecting to proxy at ").concat(_this.proxyHost, ":").concat(_this.proxyPort));
                        _this.socket = new net_1.default.Socket();
                        _this.socket.on("connect", function () { return __awaiter(_this, void 0, void 0, function () {
                            var connectCmd, e_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        console.log("[MCPProxy ".concat(this.name, "] Connected to proxy"));
                                        connectCmd = JSON.stringify({
                                            type: "connect",
                                            command: this.command,
                                            args: this.args,
                                        }) + "\n";
                                        this.socket.write(connectCmd);
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 4, , 5]);
                                        return [4 /*yield*/, this.initialize()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, this.loadTools()];
                                    case 3:
                                        _a.sent();
                                        this.status = "connected";
                                        resolve();
                                        return [3 /*break*/, 5];
                                    case 4:
                                        e_2 = _a.sent();
                                        this.status = "error";
                                        reject(e_2);
                                        return [3 /*break*/, 5];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        }); });
                        _this.socket.on("data", function (data) {
                            _this.handleData(data.toString());
                        });
                        _this.socket.on("error", function (err) {
                            console.error("[MCPProxy ".concat(_this.name, "] Socket error:"), err.message);
                            _this.status = "error";
                            reject(err);
                        });
                        _this.socket.on("close", function () {
                            console.log("[MCPProxy ".concat(_this.name, "] Socket closed"));
                            _this.status = "disconnected";
                        });
                        _this.socket.connect(_this.proxyPort, _this.proxyHost);
                    })];
            });
        });
    };
    MCPProxyClient.prototype.handleData = function (data) {
        this.buffer += data;
        // Parse JSON lines from proxy
        var lines = this.buffer.split("\n");
        this.buffer = lines.pop() || "";
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            if (!line.trim())
                continue;
            try {
                var msg = JSON.parse(line);
                // Handle proxy wrapper messages
                if (msg.type === "message" && msg.payload) {
                    this.handleMCPMessage(msg.payload);
                }
                else if (msg.type === "error") {
                    console.error("[MCPProxy ".concat(this.name, "] Proxy error:"), msg.message);
                }
                else if (msg.type === "connected") {
                    console.log("[MCPProxy ".concat(this.name, "] Server spawned by proxy"));
                }
                else if (msg.jsonrpc === "2.0") {
                    // Direct MCP message (some proxies may send unwrapped)
                    this.handleMCPMessage(msg);
                }
            }
            catch (e) {
                // May be partial JSON, will be handled next chunk
            }
        }
    };
    MCPProxyClient.prototype.handleMCPMessage = function (message) {
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
            var pending = this.pendingRequests.get(message.id);
            this.pendingRequests.delete(message.id);
            if (message.error) {
                pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
            }
            else {
                pending.resolve(message.result);
            }
        }
    };
    MCPProxyClient.prototype.send = function (method, params) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!_this.socket) {
                return reject(new Error("Not connected to proxy"));
            }
            var id = ++_this.messageId;
            _this.pendingRequests.set(id, { resolve: resolve, reject: reject });
            var mcpMessage = {
                jsonrpc: "2.0",
                id: id,
                method: method,
                params: params,
            };
            // Wrap in proxy message format
            var proxyMessage = JSON.stringify({
                type: "message",
                payload: mcpMessage,
            }) + "\n";
            _this.socket.write(proxyMessage);
            setTimeout(function () {
                if (_this.pendingRequests.has(id)) {
                    _this.pendingRequests.delete(id);
                    reject(new Error("MCP request timeout"));
                }
            }, 30000);
        });
    };
    MCPProxyClient.prototype.notify = function (method, params) {
        if (!this.socket) {
            console.error("[MCPProxy ".concat(this.name, "] Cannot send notification: not connected"));
            return;
        }
        var notification = {
            jsonrpc: "2.0",
            method: method,
            params: params,
        };
        var proxyMessage = JSON.stringify({
            type: "message",
            payload: notification,
        }) + "\n";
        this.socket.write(proxyMessage);
    };
    MCPProxyClient.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send("initialize", {
                            protocolVersion: "2024-11-05",
                            capabilities: {},
                            clientInfo: {
                                name: "Workbench",
                                version: "0.1.0",
                            },
                        })];
                    case 1:
                        _a.sent();
                        this.notify("notifications/initialized");
                        return [2 /*return*/];
                }
            });
        });
    };
    MCPProxyClient.prototype.loadTools = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send("tools/list")];
                    case 1:
                        result = _a.sent();
                        this.tools = result.tools || [];
                        console.log("[MCPProxy ".concat(this.name, "] Loaded ").concat(this.tools.length, " tools via proxy"));
                        return [2 /*return*/];
                }
            });
        });
    };
    MCPProxyClient.prototype.callTool = function (toolName, args) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.send("tools/call", {
                            name: toolName,
                            arguments: args,
                        })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    MCPProxyClient.prototype.disconnect = function () {
        if (this.socket) {
            // Send disconnect to proxy
            try {
                this.socket.write(JSON.stringify({ type: "disconnect" }) + "\n");
            }
            catch (e) { }
            this.socket.destroy();
            this.socket = null;
        }
        this.status = "disconnected";
        this.tools = [];
    };
    return MCPProxyClient;
}());
var mcpClients = new Map();
function loadMCPServers() {
    var _this = this;
    var serverConfigs = store.get("mcpServers") || [];
    console.log("[loadMCPServers] Loading MCP servers:", serverConfigs.length);
    serverConfigs.forEach(function (config) { return __awaiter(_this, void 0, void 0, function () {
        var client, e_3;
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
                            }); },
                        });
                    });
                    console.log("[MCP] Connected to ".concat(config.name, ", registered ").concat(client.tools.length, " tools"));
                    return [3 /*break*/, 4];
                case 3:
                    e_3 = _a.sent();
                    console.error("[MCP] Failed to connect to ".concat(config.name, ":"), e_3);
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
electron_1.ipcMain.handle("config:get", function () { return store.store; });
electron_1.ipcMain.handle("config:set", function (_e, partial) {
    store.set(partial);
    return store.store;
});
// Plugins
electron_1.ipcMain.handle("plugins:reload", function () {
    loadPlugins();
    return true;
});
electron_1.ipcMain.handle("plugins:save", function (_e, pluginName, code) { return __awaiter(void 0, void 0, void 0, function () {
    var pluginsDir, safeName, pluginPath, stat, cleanCode, fenceMatch;
    return __generator(this, function (_a) {
        try {
            pluginsDir = store.get("pluginsDir") || path_1.default.join(__dirname, "plugins");
            console.log("[plugins:save] Request to save \"".concat(pluginName, "\" to \"").concat(pluginsDir, "\""));
            if (fs_1.default.existsSync(pluginsDir) && fs_1.default.statSync(pluginsDir).isFile()) {
                throw new Error("Plugins directory configuration is invalid (is a file): ".concat(pluginsDir));
            }
            safeName = pluginName
                .replace(/[^a-zA-Z0-9_-]/g, "_")
                .replace(/^_+|_+$/g, "");
            if (!safeName)
                throw new Error("Invalid plugin name");
            pluginPath = path_1.default.join(pluginsDir, safeName);
            // Check if path exists as a file and remove it
            if (fs_1.default.existsSync(pluginPath)) {
                stat = fs_1.default.statSync(pluginPath);
                if (stat.isFile()) {
                    fs_1.default.unlinkSync(pluginPath);
                }
            }
            // Create directory if it doesn't exist
            if (!fs_1.default.existsSync(pluginPath)) {
                fs_1.default.mkdirSync(pluginPath, { recursive: true });
            }
            cleanCode = code;
            fenceMatch = code.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/);
            if (fenceMatch) {
                cleanCode = fenceMatch[1].trim();
            }
            fs_1.default.writeFileSync(path_1.default.join(pluginPath, "index.js"), cleanCode, "utf-8");
            fs_1.default.writeFileSync(path_1.default.join(pluginPath, "package.json"), '{\n  "type": "commonjs"\n}\n', "utf-8");
            loadPlugins();
            return [2 /*return*/, { success: true, path: pluginPath, name: safeName }];
        }
        catch (e) {
            console.error("[plugins:save] Failed for \"".concat(pluginName, "\":"), e);
            throw e;
        }
        return [2 /*return*/];
    });
}); });
// Delete a plugin
// Delete a plugin
electron_1.ipcMain.handle("plugins:delete", function (_e, pluginName) { return __awaiter(void 0, void 0, void 0, function () {
    var pluginsDir, safeName, pluginPath;
    return __generator(this, function (_a) {
        pluginsDir = store.get("pluginsDir") || path_1.default.join(__dirname, "plugins");
        safeName = pluginName.replace(/[^a-zA-Z0-9_-]/g, "_");
        pluginPath = path_1.default.join(pluginsDir, safeName);
        if (!fs_1.default.existsSync(pluginPath)) {
            throw new Error("Plugin \"".concat(pluginName, "\" not found"));
        }
        // Only allow deleting custom plugins, not built-in ones
        fs_1.default.rmSync(pluginPath, { recursive: true, force: true });
        console.log("[plugins:delete] Deleted plugin:", safeName);
        loadPlugins();
        return [2 /*return*/, { success: true, name: safeName }];
    });
}); });
// Tools
electron_1.ipcMain.handle("tools:list", function () {
    return Array.from(tools.values()).map(function (t) { return ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        category: t.name.split(".")[0],
        _sourceFolder: t._sourceFolder,
        _sourcePath: t._sourcePath,
    }); });
});
electron_1.ipcMain.handle("tools:refresh", function () {
    console.log("[IPC] Refreshing tools...");
    loadPlugins();
    return Array.from(tools.values()).map(function (t) { return ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        category: t.name.split(".")[0],
        _sourceFolder: t._sourceFolder,
        _sourcePath: t._sourcePath,
    }); });
});
electron_1.ipcMain.handle("tools:run", function (_e, name, input) { return __awaiter(void 0, void 0, void 0, function () {
    var tool, permissions, categories, _i, categories_1, cat, actions, _a, actions_1, action, check, TOOL_TIMEOUT, MAX_OUTPUT_SIZE, timeoutPromise, rawOutput, normalized, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                tool = tools.get(name);
                if (!tool)
                    throw new Error("Tool not found: ".concat(name));
                permissions = permissionManager.getToolPermissions(name);
                if (permissions) {
                    categories = ['filesystem', 'network', 'process'];
                    for (_i = 0, categories_1 = categories; _i < categories_1.length; _i++) {
                        cat = categories_1[_i];
                        if (permissions[cat]) {
                            actions = permissions[cat].actions;
                            for (_a = 0, actions_1 = actions; _a < actions_1.length; _a++) {
                                action = actions_1[_a];
                                check = permissionManager.checkPermission(name, cat, action);
                                if (!check.allowed) {
                                    if (check.needsPrompt) {
                                        // Special error that frontend can parse to show prompt
                                        throw new Error("PERMISSION_REQUIRED:".concat(name));
                                    }
                                    throw new Error("Permission denied for ".concat(cat, ":").concat(action));
                                }
                            }
                        }
                    }
                }
                TOOL_TIMEOUT = 30000;
                MAX_OUTPUT_SIZE = 500000;
                timeoutPromise = new Promise(function (_, reject) {
                    setTimeout(function () { return reject(new Error("Tool execution timeout (30s limit)")); }, TOOL_TIMEOUT);
                });
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, Promise.race([tool.run(input), timeoutPromise])];
            case 2:
                rawOutput = _b.sent();
                normalized = normalizeToolOutput(rawOutput);
                // Safety: Truncate large outputs
                if (typeof normalized.content === "string" &&
                    normalized.content.length > MAX_OUTPUT_SIZE) {
                    normalized.content =
                        normalized.content.substring(0, MAX_OUTPUT_SIZE) +
                            "\n\n[Output truncated - exceeded ".concat(MAX_OUTPUT_SIZE, " character limit]");
                    normalized.metadata = __assign(__assign({}, normalized.metadata), { truncated: true, originalSize: normalized.content.length });
                }
                return [2 /*return*/, normalized];
            case 3:
                error_1 = _b.sent();
                // Friendly error handling
                return [2 /*return*/, normalizeToolOutput({
                        content: error_1.message.includes("timeout")
                            ? "Tool execution timed out. Please try again or simplify your request."
                            : "Tool error: ".concat(error_1.message),
                        error: error_1.message,
                        metadata: {
                            tool: name,
                            input: input,
                            timestamp: new Date().toISOString(),
                        },
                    })];
            case 4: return [2 /*return*/];
        }
    });
}); });
var sessionCosts = { total: 0, requests: 0, byModel: {} };
// Cost calculation based on OpenRouter pricing
function calculateCost(model, promptTokens, completionTokens) {
    // Approximate pricing per 1M tokens (adjust based on actual OpenRouter pricing)
    var pricing = {
        "anthropic/claude-3.5-sonnet": { prompt: 3, completion: 15 },
        "anthropic/claude-3-haiku": { prompt: 0.25, completion: 1.25 },
        "openai/gpt-4o": { prompt: 2.5, completion: 10 },
        "openai/gpt-4o-mini": { prompt: 0.15, completion: 0.6 },
        default: { prompt: 1, completion: 2 },
    };
    var rates = pricing[model] || pricing["default"];
    return ((promptTokens * rates.prompt) / 1000000 +
        (completionTokens * rates.completion) / 1000000);
}
electron_1.ipcMain.handle("costs:get", function () { return sessionCosts; });
electron_1.ipcMain.handle("costs:reset", function () {
    sessionCosts = { total: 0, requests: 0, byModel: {} };
    return sessionCosts;
});
// Task runner (non-streaming)
electron_1.ipcMain.handle("task:run", function (_e_1, taskType_1, prompt_1) {
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
                        throw new Error("No API key configured");
                    apiEndpoint = config.apiEndpoint || "https://openrouter.ai/api/v1";
                    messages = [];
                    // Add system prompt with tools if requested
                    if (includeTools) {
                        toolsList = Array.from(tools.values())
                            .filter(function (t) { return !t.name.startsWith("builtin."); })
                            .map(function (t) { return "- ".concat(t.name, ": ").concat(t.description || "No description"); })
                            .join("\n");
                        systemPrompt = "You are a helpful AI assistant with access to tools that can perform actions.\n\nAvailable tools:\n".concat(toolsList, "\n\nWhen a user asks you to create, build, or do something, you should USE THE APPROPRIATE TOOL instead of just providing instructions.\n\nFor example:\n- If asked to \"create an artifact to connect Google Calendar\", use the workbench.convertArtifact tool\n- If asked to \"build a tool for X\", use the workbench.convertArtifact tool\n- If asked to create/generate code or plugins, use the appropriate tool\n\nYour response should indicate which tool you would use and with what parameters. Format like:\nTOOL: tool.name\nINPUT: { \"param\": \"value\" }\n\nBe action-oriented. Do things, don't just explain how to do them.");
                        messages.push({ role: "system", content: systemPrompt });
                    }
                    messages.push({ role: "user", content: prompt });
                    return [4 /*yield*/, axios_1.default.post("".concat(apiEndpoint, "/chat/completions"), {
                            model: roleConfig.model,
                            messages: messages,
                        }, {
                            headers: {
                                Authorization: "Bearer ".concat(apiKey),
                                "Content-Type": "application/json",
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
                            content: ((_d = (_c = (_b = res.data.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || "",
                            usage: res.data.usage,
                            model: res.data.model,
                            sessionCosts: __assign({}, sessionCosts),
                        }];
            }
        });
    });
});
// List available models from OpenRouter
electron_1.ipcMain.handle("models:list", function () { return __awaiter(void 0, void 0, void 0, function () {
    var config, apiKey, res, models, e_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                config = store.store;
                apiKey = config.openrouterApiKey;
                if (!apiKey) {
                    throw new Error("No OpenRouter API key configured");
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, axios_1.default.get("https://openrouter.ai/api/v1/models", {
                        headers: {
                            Authorization: "Bearer ".concat(apiKey),
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
                            completion: ((_b = m.pricing) === null || _b === void 0 ? void 0 : _b.completion)
                                ? parseFloat(m.pricing.completion)
                                : 0,
                        },
                        top_provider: m.top_provider,
                        per_million_prompt: ((_c = m.pricing) === null || _c === void 0 ? void 0 : _c.prompt)
                            ? (parseFloat(m.pricing.prompt) * 1000000).toFixed(2)
                            : "0",
                        per_million_completion: ((_d = m.pricing) === null || _d === void 0 ? void 0 : _d.completion)
                            ? (parseFloat(m.pricing.completion) * 1000000).toFixed(2)
                            : "0",
                    });
                });
                // Sort by prompt price
                models.sort(function (a, b) { return a.pricing.prompt - b.pricing.prompt; });
                return [2 /*return*/, models];
            case 3:
                e_4 = _a.sent();
                throw new Error("Failed to fetch models: ".concat(e_4.message));
            case 4: return [2 /*return*/];
        }
    });
}); });
// Template variable replacement
function processTemplateVariables(text) {
    var now = new Date();
    var user = require("os").userInfo().username;
    return text
        .replace(/\{\{today\}\}/g, now.toLocaleDateString())
        .replace(/\{\{time\}\}/g, now.toLocaleTimeString())
        .replace(/\{\{datetime\}\}/g, now.toLocaleString())
        .replace(/\{\{user\}\}/g, user)
        .replace(/\{\{clipboard\}\}/g, electron_1.clipboard.readText());
}
// Streaming task runner
electron_1.ipcMain.handle("task:runStream", function (_e, taskType, prompt, requestId) { return __awaiter(void 0, void 0, void 0, function () {
    var config, router, roleConfig, error, apiKey, error, apiEndpoint, processedPrompt, res, fullContent_1, promptTokens_1, completionTokens_1, e_5, errorData, chunks, _a, errorData_1, errorData_1_1, chunk, e_6_1, rawParams, streamErr_1, errorDetails, errorMessage, detailedMsg;
    var _b, e_6, _c, _d;
    var _f, _g, _h, _j, _k, _l, _m;
    return __generator(this, function (_o) {
        switch (_o.label) {
            case 0:
                config = store.store;
                router = config.router || {};
                roleConfig = router[taskType];
                // Check if model is configured
                if (!(roleConfig === null || roleConfig === void 0 ? void 0 : roleConfig.model)) {
                    error = "No model configured for \"".concat(taskType, "\". Please configure a model in Settings tab.");
                    console.error("[task:runStream]", error);
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send("stream:error", { requestId: requestId, error: error });
                    throw new Error(error);
                }
                apiKey = config.openrouterApiKey;
                if (!apiKey) {
                    error = "No API key configured. Please add your API key in Settings tab.";
                    console.error("[task:runStream]", error);
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send("stream:error", { requestId: requestId, error: error });
                    throw new Error(error);
                }
                apiEndpoint = config.apiEndpoint || "https://openrouter.ai/api/v1";
                console.log("[task:runStream] Model: ".concat(roleConfig.model, ", TaskType: ").concat(taskType));
                processedPrompt = processTemplateVariables(prompt);
                _o.label = 1;
            case 1:
                _o.trys.push([1, 3, , 19]);
                return [4 /*yield*/, axios_1.default.post("".concat(apiEndpoint, "/chat/completions"), {
                        model: roleConfig.model,
                        messages: [
                            {
                                role: "system",
                                content: "You are a helpful AI assistant integrated into Workbench - a desktop application with tools.\n\nCRITICAL: When users say \"build\", \"create a tool\", or \"make an artifact\", you should IMMEDIATELY generate the complete code for a Workbench plugin. Don't ask for confirmation or details - just build it based on their request.\n\nWorkbench Plugin Format:\n```javascript\nmodule.exports.register = (api) => {\n  api.registerTool({\n    name: 'category.toolName',\n    inputSchema: {\n      type: 'object',\n      properties: {\n        // input parameters\n      },\n      required: []\n    },\n    run: async (input) => {\n      // Tool logic here\n      // For API calls, return the data or result\n      return { result: 'data' };\n    }\n  });\n};\n```\n\nWhen user asks you to build something:\n1. Generate the COMPLETE plugin code immediately\n2. Explain what it does briefly\n3. Tell them to save it in the plugins folder\n\nExample:\nUser: \"Build a tool that tells me the temperature\"\nYou: \"Here's a weather temperature tool for Workbench:\n\n```javascript\nmodule.exports.register = (api) => {\n  api.registerTool({\n    name: 'weather.temperature',\n    inputSchema: {\n      type: 'object',\n      properties: {\n        city: { type: 'string', description: 'City name' }\n      },\n      required: ['city']\n    },\n    run: async (input) => {\n      // In production, you'd call a real weather API\n      return { \n        temperature: 72,\n        city: input.city,\n        message: `Temperature in ${input.city} is 72\u00B0F`\n      };\n    }\n  });\n};\n```\n\nThis tool fetches temperature data. Save this as `plugins/weather_temperature/index.js` and restart Workbench to use it.\"\n\nBE PROACTIVE. BUILD THE CODE IMMEDIATELY when asked.",
                            },
                            { role: "user", content: processedPrompt },
                        ],
                        stream: true,
                    }, {
                        headers: {
                            Authorization: "Bearer ".concat(apiKey),
                            "Content-Type": "application/json",
                        },
                        responseType: "stream",
                    })];
            case 2:
                res = _o.sent();
                fullContent_1 = "";
                promptTokens_1 = 0;
                completionTokens_1 = 0;
                res.data.on("data", function (chunk) {
                    var _a, _b, _c;
                    var lines = chunk
                        .toString()
                        .split("\n")
                        .filter(function (line) { return line.trim().startsWith("data:"); });
                    for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
                        var line = lines_2[_i];
                        var data = line.replace("data:", "").trim();
                        if (data === "[DONE]") {
                            // Track costs
                            var cost = calculateCost(roleConfig.model, promptTokens_1, completionTokens_1);
                            sessionCosts.total += cost;
                            sessionCosts.requests += 1;
                            if (!sessionCosts.byModel[roleConfig.model]) {
                                sessionCosts.byModel[roleConfig.model] = {
                                    cost: 0,
                                    requests: 0,
                                    tokens: { prompt: 0, completion: 0 },
                                };
                            }
                            sessionCosts.byModel[roleConfig.model].cost += cost;
                            sessionCosts.byModel[roleConfig.model].requests += 1;
                            sessionCosts.byModel[roleConfig.model].tokens.prompt +=
                                promptTokens_1;
                            sessionCosts.byModel[roleConfig.model].tokens.completion +=
                                completionTokens_1;
                            mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send("stream:done", {
                                requestId: requestId,
                                content: fullContent_1,
                                cost: cost,
                                tokens: { prompt: promptTokens_1, completion: completionTokens_1 },
                            });
                            return;
                        }
                        try {
                            var parsed = JSON.parse(data);
                            var delta = ((_c = (_b = (_a = parsed.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.delta) === null || _c === void 0 ? void 0 : _c.content) || "";
                            if (delta) {
                                fullContent_1 += delta;
                                mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send("stream:chunk", {
                                    requestId: requestId,
                                    chunk: delta,
                                    content: fullContent_1,
                                });
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
                res.data.on("end", function () {
                    // Track costs even if no [DONE] received
                    if (promptTokens_1 > 0 || completionTokens_1 > 0) {
                        var cost = calculateCost(roleConfig.model, promptTokens_1, completionTokens_1);
                        sessionCosts.total += cost;
                        sessionCosts.requests += 1;
                        if (!sessionCosts.byModel[roleConfig.model]) {
                            sessionCosts.byModel[roleConfig.model] = {
                                cost: 0,
                                requests: 0,
                                tokens: { prompt: 0, completion: 0 },
                            };
                        }
                        sessionCosts.byModel[roleConfig.model].cost += cost;
                        sessionCosts.byModel[roleConfig.model].requests += 1;
                        sessionCosts.byModel[roleConfig.model].tokens.prompt += promptTokens_1;
                        sessionCosts.byModel[roleConfig.model].tokens.completion +=
                            completionTokens_1;
                    }
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send("stream:done", {
                        requestId: requestId,
                        content: fullContent_1,
                        cost: sessionCosts.total,
                        tokens: { prompt: promptTokens_1, completion: completionTokens_1 },
                    });
                });
                res.data.on("error", function (err) {
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send("stream:error", {
                        requestId: requestId,
                        error: err.message,
                    });
                });
                return [2 /*return*/, { started: true, requestId: requestId }];
            case 3:
                e_5 = _o.sent();
                errorData = (_f = e_5.response) === null || _f === void 0 ? void 0 : _f.data;
                if (!(errorData && typeof errorData.pipe === 'function')) return [3 /*break*/, 18];
                _o.label = 4;
            case 4:
                _o.trys.push([4, 17, , 18]);
                chunks = [];
                _o.label = 5;
            case 5:
                _o.trys.push([5, 10, 11, 16]);
                _a = true, errorData_1 = __asyncValues(errorData);
                _o.label = 6;
            case 6: return [4 /*yield*/, errorData_1.next()];
            case 7:
                if (!(errorData_1_1 = _o.sent(), _b = errorData_1_1.done, !_b)) return [3 /*break*/, 9];
                _d = errorData_1_1.value;
                _a = false;
                chunk = _d;
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                _o.label = 8;
            case 8:
                _a = true;
                return [3 /*break*/, 6];
            case 9: return [3 /*break*/, 16];
            case 10:
                e_6_1 = _o.sent();
                e_6 = { error: e_6_1 };
                return [3 /*break*/, 16];
            case 11:
                _o.trys.push([11, , 14, 15]);
                if (!(!_a && !_b && (_c = errorData_1.return))) return [3 /*break*/, 13];
                return [4 /*yield*/, _c.call(errorData_1)];
            case 12:
                _o.sent();
                _o.label = 13;
            case 13: return [3 /*break*/, 15];
            case 14:
                if (e_6) throw e_6.error;
                return [7 /*endfinally*/];
            case 15: return [7 /*endfinally*/];
            case 16:
                rawParams = Buffer.concat(chunks).toString('utf8');
                try {
                    errorData = JSON.parse(rawParams);
                }
                catch (_p) {
                    errorData = rawParams;
                }
                return [3 /*break*/, 18];
            case 17:
                streamErr_1 = _o.sent();
                errorData = '[Stream Read Failed]';
                return [3 /*break*/, 18];
            case 18:
                errorDetails = {
                    status: (_g = e_5.response) === null || _g === void 0 ? void 0 : _g.status,
                    statusText: (_h = e_5.response) === null || _h === void 0 ? void 0 : _h.statusText,
                    data: errorData,
                    message: e_5.message,
                };
                console.error("[task:runStream] Full error:", util_1.default.inspect(errorDetails, { depth: null, colors: false }));
                errorMessage = "Request failed";
                detailedMsg = "";
                if (typeof errorData === 'object' && ((_j = errorData === null || errorData === void 0 ? void 0 : errorData.error) === null || _j === void 0 ? void 0 : _j.message)) {
                    detailedMsg = errorData.error.message;
                }
                else if (typeof errorData === 'string') {
                    detailedMsg = errorData;
                }
                else if (errorData) {
                    try {
                        detailedMsg = JSON.stringify(errorData);
                    }
                    catch (_q) { }
                }
                errorMessage = "[".concat(((_k = e_5.response) === null || _k === void 0 ? void 0 : _k.status) || 'Unknown', "] ").concat(detailedMsg || e_5.message || 'Request failed');
                // Fallbacks for specific status codes if no message found
                if (!detailedMsg) {
                    if (((_l = e_5.response) === null || _l === void 0 ? void 0 : _l.status) === 404) {
                        errorMessage = "[404] Model not found: ".concat(roleConfig.model, ".");
                    }
                    else if (((_m = e_5.response) === null || _m === void 0 ? void 0 : _m.status) === 400) {
                        errorMessage = "[400] Bad request to model \"".concat(roleConfig.model, "\".");
                    }
                }
                mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send("stream:error", {
                    requestId: requestId,
                    error: errorMessage,
                });
                throw new Error(errorMessage);
            case 19: return [2 /*return*/];
        }
    });
}); });
// Tool chaining
electron_1.ipcMain.handle("chain:run", function (_e, steps) { return __awaiter(void 0, void 0, void 0, function () {
    var results, context, executionLog, i, step, tool, errorMsg, resolvedInput, result, normalized, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                results = [];
                context = {};
                executionLog = [];
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < steps.length)) return [3 /*break*/, 6];
                step = steps[i];
                tool = tools.get(step.tool);
                if (!tool) {
                    errorMsg = "Tool not found: ".concat(step.tool);
                    executionLog.push({
                        step: i + 1,
                        tool: step.tool,
                        status: "failed",
                        error: errorMsg,
                    });
                    return [2 /*return*/, {
                            success: false,
                            failedAt: i + 1,
                            error: errorMsg,
                            results: results,
                            context: context,
                            executionLog: executionLog,
                        }];
                }
                _a.label = 2;
            case 2:
                _a.trys.push([2, 4, , 5]);
                resolvedInput = interpolateContext(step.input, context);
                console.log("[chain:run] Step ".concat(i + 1, ": ").concat(step.tool));
                return [4 /*yield*/, tool.run(resolvedInput)];
            case 3:
                result = _a.sent();
                normalized = normalizeToolOutput(result);
                // Check if tool returned an error
                if (normalized.error) {
                    executionLog.push({
                        step: i + 1,
                        tool: step.tool,
                        status: "failed",
                        error: normalized.error,
                        output: normalized,
                    });
                    return [2 /*return*/, {
                            success: false,
                            failedAt: i + 1,
                            error: "Tool \"".concat(step.tool, "\" failed: ").concat(normalized.error),
                            results: results,
                            context: context,
                            executionLog: executionLog,
                        }];
                }
                results.push({ tool: step.tool, result: normalized });
                executionLog.push({
                    step: i + 1,
                    tool: step.tool,
                    status: "success",
                    output: normalized,
                });
                // Store result in context for next steps
                if (step.outputKey) {
                    context[step.outputKey] = normalized;
                }
                context["step".concat(i)] = normalized;
                context.lastResult = normalized;
                return [3 /*break*/, 5];
            case 4:
                error_2 = _a.sent();
                executionLog.push({
                    step: i + 1,
                    tool: step.tool,
                    status: "failed",
                    error: error_2.message,
                });
                return [2 /*return*/, {
                        success: false,
                        failedAt: i + 1,
                        error: "Step ".concat(i + 1, " (").concat(step.tool, ") threw exception: ").concat(error_2.message),
                        results: results,
                        context: context,
                        executionLog: executionLog,
                    }];
            case 5:
                i++;
                return [3 /*break*/, 1];
            case 6: return [2 /*return*/, {
                    success: true,
                    results: results,
                    context: context,
                    executionLog: executionLog,
                }];
        }
    });
}); });
function interpolateContext(input, context) {
    if (typeof input === "string") {
        // Replace {{key}} or {{key.subkey}} patterns
        return input.replace(/\{\{([^}]+)\}\}/g, function (_, key) {
            var value = key
                .split(".")
                .reduce(function (obj, k) { return obj === null || obj === void 0 ? void 0 : obj[k]; }, context);
            return value !== undefined
                ? typeof value === "string"
                    ? value
                    : JSON.stringify(value)
                : "{{".concat(key, "}}");
        });
    }
    if (Array.isArray(input)) {
        return input.map(function (item) { return interpolateContext(item, context); });
    }
    if (typeof input === "object" && input !== null) {
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
electron_1.ipcMain.handle("mcp:list", function () {
    return Array.from(mcpClients.entries()).map(function (_a) {
        var name = _a[0], client = _a[1];
        return ({
            name: name,
            status: client.status,
            toolCount: client.tools.length,
            tools: client.tools.map(function (t) { return t.name; }),
        });
    });
});
electron_1.ipcMain.handle("mcp:add", function (_e, config) { return __awaiter(void 0, void 0, void 0, function () {
    var servers, transport, proxyPort, client, e_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("[mcp:add] Adding server:", config);
                servers = store.get("mcpServers") || [];
                servers.push(config);
                store.set("mcpServers", servers);
                transport = config.transport || "stdio";
                proxyPort = store.get("pipewrenchPort", 9999);
                if (transport === "pipewrench") {
                    console.log("[mcp:add] Using PipeWrench proxy on port ".concat(proxyPort));
                    client = new MCPProxyClient(config.name, config.command, config.args || [], proxyPort);
                }
                else {
                    client = new MCPClient(config.name, config.command, config.args || []);
                }
                mcpClients.set(config.name, client);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                console.log("[mcp:add] Connecting to server...");
                return [4 /*yield*/, client.connect()];
            case 2:
                _a.sent();
                console.log("[mcp:add] Connected! Tools:", client.tools.length);
                client.tools.forEach(function (tool) {
                    var toolName = "mcp.".concat(config.name, ".").concat(tool.name);
                    tools.set(toolName, {
                        name: toolName,
                        description: tool.description,
                        inputSchema: tool.inputSchema,
                        run: function (input) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, client.callTool(tool.name, input)];
                        }); }); },
                    });
                });
                return [2 /*return*/, { success: true, toolCount: client.tools.length, transport: transport }];
            case 3:
                e_7 = _a.sent();
                console.error("[mcp:add] Connection failed:", e_7.message);
                client.disconnect(); // Clean up failed connection
                mcpClients.delete(config.name); // Remove from map
                return [2 /*return*/, { success: false, error: e_7.message || "Connection failed" }];
            case 4: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle("mcp:remove", function (_e, name) { return __awaiter(void 0, void 0, void 0, function () {
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
        servers = (store.get("mcpServers") || []).filter(function (s) { return s.name !== name; });
        store.set("mcpServers", servers);
        return [2 /*return*/, { success: true }];
    });
}); });
electron_1.ipcMain.handle("mcp:reconnect", function (_e, name) { return __awaiter(void 0, void 0, void 0, function () {
    var client, e_8;
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
                        }); }); },
                    });
                });
                return [2 /*return*/, { success: true, toolCount: client.tools.length }];
            case 3:
                e_8 = _a.sent();
                return [2 /*return*/, { success: false, error: e_8.message }];
            case 4: return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// DOCTOR ENGINE - System Diagnostics
// ============================================================================
// Doctor engine instance
var doctorEngine = null;
var lastDoctorReport = null;
function getDoctorEngine() {
    if (!doctorEngine) {
        var configDir = electron_1.app.getPath("userData");
        var version = electron_1.app.getVersion();
        doctorEngine = new doctor_1.DoctorEngine(configDir, version);
    }
    return doctorEngine;
}
// Run all diagnostics
electron_1.ipcMain.handle("doctor:run", function () { return __awaiter(void 0, void 0, void 0, function () {
    var engine;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("[doctor:run] Running diagnostics...");
                engine = getDoctorEngine();
                return [4 /*yield*/, engine.runAll()];
            case 1:
                lastDoctorReport = _a.sent();
                console.log("[doctor:run] Complete:", lastDoctorReport.summary);
                return [2 /*return*/, lastDoctorReport];
        }
    });
}); });
// Get last report
electron_1.ipcMain.handle("doctor:getLastReport", function () {
    return lastDoctorReport;
});
// Get report as text (sanitized)
electron_1.ipcMain.handle("doctor:getReportText", function (_e, sanitize) {
    if (sanitize === void 0) { sanitize = true; }
    if (!lastDoctorReport)
        return null;
    var engine = getDoctorEngine();
    return engine.formatReportText(lastDoctorReport, sanitize);
});
// Export report to file
electron_1.ipcMain.handle("doctor:export", function (_e_1) {
    var args_1 = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args_1[_i - 1] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([_e_1], args_1, true), void 0, function (_e, sanitize) {
        var _a, filePath, canceled, engine, content, report;
        if (sanitize === void 0) { sanitize = true; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!lastDoctorReport) {
                        throw new Error("No diagnostic report available. Run diagnostics first.");
                    }
                    return [4 /*yield*/, electron_1.dialog.showSaveDialog(mainWindow, {
                            title: "Export Doctor Report",
                            defaultPath: "workbench-doctor-".concat(new Date().toISOString().split("T")[0], ".txt"),
                            filters: [
                                { name: "Text Files", extensions: ["txt"] },
                                { name: "JSON Files", extensions: ["json"] },
                            ],
                        })];
                case 1:
                    _a = _b.sent(), filePath = _a.filePath, canceled = _a.canceled;
                    if (canceled || !filePath) {
                        return [2 /*return*/, { success: false, canceled: true }];
                    }
                    engine = getDoctorEngine();
                    if (filePath.endsWith(".json")) {
                        report = sanitize ? engine.sanitizeReport(lastDoctorReport) : lastDoctorReport;
                        content = JSON.stringify(report, null, 2);
                    }
                    else {
                        content = engine.formatReportText(lastDoctorReport, sanitize);
                    }
                    fs_1.default.writeFileSync(filePath, content, "utf-8");
                    return [2 /*return*/, { success: true, filePath: filePath }];
            }
        });
    });
});
// ============================================================================
// PERMISSION SYSTEM IPC HANDLERS
// ============================================================================
// Register tool permissions when loading plugins
electron_1.ipcMain.handle("permissions:register", function (_e, toolName, permissions) {
    permissionManager.registerToolPermissions(toolName, permissions);
    return { success: true };
});
// Check if tool has permission for an action
electron_1.ipcMain.handle("permissions:check", function (_e, toolName, category, action) {
    return permissionManager.checkPermission(toolName, category, action);
});
// Get tool's declared permissions
electron_1.ipcMain.handle("permissions:getToolPermissions", function (_e, toolName) {
    var permissions = permissionManager.getToolPermissions(toolName);
    if (!permissions)
        return null;
    return {
        permissions: permissions,
        formatted: permissionManager.formatPermissionsForDisplay(permissions),
        isDestructive: permissionManager.isDestructive(toolName),
    };
});
// Grant permission (one-time or permanent)
electron_1.ipcMain.handle("permissions:grant", function (_e, toolName, category, permanent) {
    permissionManager.grantPermission(toolName, category, permanent);
    return { success: true };
});
// Deny permission
electron_1.ipcMain.handle("permissions:deny", function (_e, toolName, category, permanent) {
    permissionManager.denyPermission(toolName, category, permanent);
    return { success: true };
});
// Get tool's current policy
electron_1.ipcMain.handle("permissions:getPolicy", function (_e, toolName) {
    return permissionManager.getToolPolicy(toolName);
});
// Reset tool policy
electron_1.ipcMain.handle("permissions:resetPolicy", function (_e, toolName) {
    permissionManager.resetToolPolicy(toolName);
    return { success: true };
});
// Reset all policies
electron_1.ipcMain.handle("permissions:resetAll", function () {
    permissionManager.resetAllPolicies();
    return { success: true };
});
// ============================================================================
// CHAT HISTORY PERSISTENCE
// ============================================================================
// Save chat history
electron_1.ipcMain.handle("chat:save", function (_e, history) {
    try {
        store.set('chatHistory', history);
        return { success: true };
    }
    catch (error) {
        console.error('[chat:save] Error:', error);
        return { success: false, error: error.message };
    }
});
// Load chat history
electron_1.ipcMain.handle("chat:load", function () {
    try {
        var history_1 = store.get('chatHistory', []);
        return { success: true, history: history_1 };
    }
    catch (error) {
        console.error('[chat:load] Error:', error);
        return { success: false, error: error.message, history: [] };
    }
});
// Clear chat history
electron_1.ipcMain.handle("chat:clear", function () {
    try {
        store.delete('chatHistory');
        return { success: true };
    }
    catch (error) {
        console.error('[chat:clear] Error:', error);
        return { success: false, error: error.message };
    }
});
