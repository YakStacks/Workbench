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
var run_manager_1 = require("./run-manager.cjs");
var process_registry_1 = require("./process-registry.cjs");
var secrets_manager_1 = require("./secrets-manager.cjs");
var tool_manifest_1 = require("./tool-manifest.cjs");
var dry_run_1 = require("./dry-run.cjs");
var memory_manager_1 = require("./memory-manager.cjs");
var tool_dispatch_1 = require("./tool-dispatch.cjs");
var environment_detection_1 = require("./environment-detection.cjs");
var guardrails_1 = require("./guardrails.cjs");
var asset_manager_1 = require("./asset-manager.cjs");
var sessions_manager_1 = require("./sessions-manager.cjs");
var runner_1 = require("./src/core/runner");
var store = new electron_store_1.default();
var permissionManager = new permissions_1.PermissionManager(store);
var runManager = new run_manager_1.RunManager(store);
var processRegistry = new process_registry_1.ProcessRegistry();
var secretsManager = new secrets_manager_1.SecretsManager(store);
var manifestRegistry = new tool_manifest_1.ToolManifestRegistry();
var previewManager = new dry_run_1.PreviewManager();
var memoryManager = new memory_manager_1.MemoryManager(store);
var savedToolUsage = store.get("toolUsageData") || undefined;
var toolDispatcher = new tool_dispatch_1.ToolDispatcher(permissionManager, previewManager, undefined, savedToolUsage);
var environmentDetector = new environment_detection_1.EnvironmentDetector();
var schemaValidator = new guardrails_1.SchemaValidator();
var commandGuardrails = new guardrails_1.CommandGuardrails();
var loopDetector = new guardrails_1.LoopDetector();
var pathSandbox;
var assetManager;
var sessionsManager;
var mainWindow = null;
var tray = null;
var plugins = [];
var tools = new Map();
// Add isQuitting flag to app
var isQuitting = false;
var DEFAULT_FEATURE_FLAGS = {
    L_TOOL_HEALTH_SIGNALS: false,
    M_SMART_AUTO_DIAGNOSTICS: false,
    N_PERMISSION_PROFILES: false,
    N_RUN_TIMELINE: false,
    N_EXPORT_RUN_BUNDLE: false,
    V2_GUARDRAILS: true,
    V2_ASSET_SYSTEM: true,
    V2_AUTO_DOCTOR: true,
    V2_SESSION_LOGS: true,
    V3_SMART_DISPATCH: true,
    V3_DISAMBIGUATION: true,
    V3_CHAIN_PLANNING: true,
    V3_USAGE_TRACKING: true,
};
function getFeatureFlags() {
    var stored = store.get("featureFlags") || {};
    return __assign(__assign({}, DEFAULT_FEATURE_FLAGS), stored);
}
function isFeatureEnabled(flag) {
    return Boolean(getFeatureFlags()[flag]);
}
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
/**
 * V2: Resolve asset_id references in tool input to sandbox file paths.
 * Scans top-level input fields for values matching 'asset_XXX' pattern
 * and resolves them to safe sandbox paths. Also handles explicit
 * 'asset_id' field by adding a resolved '__asset_path' field.
 */
function resolveAssetReferences(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !assetManager) {
        return input;
    }
    var resolved = __assign({}, input);
    var ASSET_ID_PATTERN = /^asset_\d+_[a-z0-9]+$/;
    // If there's an explicit asset_id field, resolve it to __asset_path
    if (resolved.asset_id && typeof resolved.asset_id === 'string') {
        var safePath = assetManager.resolvePath(resolved.asset_id);
        if (safePath) {
            resolved.__asset_path = safePath;
            // Also get metadata for tools that need MIME info
            var meta = assetManager.get(resolved.asset_id);
            if (meta) {
                resolved.__asset_metadata = meta;
            }
        }
    }
    // Scan path-like fields and resolve asset_id values
    var pathFields = ['path', 'filePath', 'file_path', 'file', 'source', 'input_file'];
    for (var _i = 0, pathFields_1 = pathFields; _i < pathFields_1.length; _i++) {
        var field = pathFields_1[_i];
        if (resolved[field] && typeof resolved[field] === 'string' && ASSET_ID_PATTERN.test(resolved[field])) {
            var safePath = assetManager.resolvePath(resolved[field]);
            if (safePath) {
                resolved["__original_".concat(field)] = resolved[field]; // Keep original for logging
                resolved[field] = safePath; // Replace with safe path
            }
        }
    }
    return resolved;
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
    // Set window for RunManager
    runManager.setWindow(mainWindow);
    // Load content based on environment
    if (!electron_1.app.isPackaged) {
        // Development mode - connect to Vite dev server
        mainWindow.loadURL("http://localhost:5173");
        // Open DevTools in development
        mainWindow.webContents.openDevTools();
    }
    else {
        // Production mode - load from built files
        mainWindow.loadFile(path_1.default.join(__dirname, "dist", "index.html"));
    }
    // Show the window after it's ready
    mainWindow.once('ready-to-show', function () {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.show();
    });
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
    // Initialize path sandbox and asset manager
    var workspaceRoot = store.get('workingDir') || electron_1.app.getPath('home');
    var safePaths = store.get('safePaths') || [];
    pathSandbox = new guardrails_1.PathSandbox(workspaceRoot, safePaths);
    var assetSandboxDir = path_1.default.join(electron_1.app.getPath('userData'), 'assets');
    assetManager = new asset_manager_1.AssetManager(store, assetSandboxDir);
    sessionsManager = new sessions_manager_1.SessionsManager(store);
    // Load persisted doctor report history
    var savedDoctorHistory = store.get('doctorReportHistory');
    if (savedDoctorHistory && Array.isArray(savedDoctorHistory)) {
        getDoctorEngine().loadHistory(savedDoctorHistory);
    }
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
// Cleanup processes before quit
electron_1.app.on('before-quit', function (event) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!!isQuitting) return [3 /*break*/, 2];
                console.log('[app] Starting cleanup before quit...');
                event.preventDefault();
                isQuitting = true;
                // Kill all child processes
                return [4 /*yield*/, processRegistry.gracefulShutdown(5000)];
            case 1:
                // Kill all child processes
                _a.sent();
                // Disconnect MCP clients
                mcpClients.forEach(function (client) {
                    try {
                        client.disconnect();
                    }
                    catch (error) {
                        console.error('[app] Error disconnecting MCP client:', error);
                    }
                });
                console.log('[app] Cleanup complete, quitting...');
                electron_1.app.quit();
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); });
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
                            // Ensure every tool has explicit permission metadata
                            permissionManager.registerToolPermissions(tool.name, tool.permissions || {});
                        },
                        getPluginsDir: function () { return pluginsDir; },
                        reloadPlugins: function () { return loadPlugins(); },
                    });
                }
            }
            catch (e) {
                var errMsg = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
                console.error("[loadPlugins] Error loading plugin: ".concat(folder, " - ").concat(errMsg));
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
        description: "Read contents of a file. Accepts a file path or an asset_id from uploaded files.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "File path to read" },
                asset_id: { type: "string", description: "Asset ID of an uploaded file (alternative to path)" },
                encoding: {
                    type: "string",
                    description: "Encoding (default: utf-8)",
                    default: "utf-8",
                },
            },
        },
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var safePath, resolved, content;
            return __generator(this, function (_a) {
                // Priority: asset_id → __asset_path (resolved by middleware) → raw path
                if (input.asset_id && assetManager) {
                    resolved = assetManager.resolvePath(input.asset_id);
                    if (!resolved)
                        throw new Error("Asset not found: ".concat(input.asset_id));
                    safePath = resolved;
                }
                else if (input.__asset_path) {
                    safePath = input.__asset_path;
                }
                else if (input.path) {
                    safePath = resolveSafePath(input.path);
                    assertPathSafe(safePath);
                }
                else {
                    throw new Error("Either path or asset_id is required");
                }
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
                        var runId = input.__runId;
                        var proc = (0, child_process_1.spawn)(shell, [shellArg, input.command], {
                            cwd: cwd,
                            timeout: input.timeout || 30000,
                            env: process.env,
                        });
                        processRegistry.register(proc, {
                            runId: runId,
                            toolName: "builtin.shell",
                            command: input.command,
                            type: "tool",
                        });
                        if (runId && proc.pid) {
                            runManager.setProcessId(runId, proc.pid);
                        }
                        var stdout = "";
                        var stderr = "";
                        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on("data", function (data) {
                            stdout += data.toString();
                            if (proc.pid)
                                processRegistry.recordActivity(proc.pid);
                        });
                        (_b = proc.stderr) === null || _b === void 0 ? void 0 : _b.on("data", function (data) {
                            stderr += data.toString();
                            if (proc.pid)
                                processRegistry.recordActivity(proc.pid);
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
                        processRegistry.register(proc, {
                            runId: input.__runId,
                            toolName: "builtin.processes",
                            command: cmd,
                            type: "tool",
                        });
                        if (input.__runId && proc.pid) {
                            runManager.setProcessId(input.__runId, proc.pid);
                        }
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
        run: function () {
            var args_1 = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args_1[_i] = arguments[_i];
            }
            return __awaiter(_this, __spreadArray([], args_1, true), void 0, function (input) {
                if (input === void 0) { input = {}; }
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
                            processRegistry.register(proc, {
                                runId: input.__runId,
                                toolName: "builtin.diskSpace",
                                command: cmd,
                                type: "tool",
                            });
                            if (input.__runId && proc.pid) {
                                runManager.setProcessId(input.__runId, proc.pid);
                            }
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
            });
        },
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
        run: function () {
            var args_1 = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args_1[_i] = arguments[_i];
            }
            return __awaiter(_this, __spreadArray([], args_1, true), void 0, function (input) {
                if (input === void 0) { input = {}; }
                return __generator(this, function (_a) {
                    if (process.platform !== "win32") {
                        return [2 /*return*/, { error: "This tool only works on Windows" }];
                    }
                    return [2 /*return*/, new Promise(function (resolve) {
                            var _a;
                            var cmd = "wmic product get name,version";
                            var proc = (0, child_process_1.spawn)("cmd.exe", ["/c", cmd], { timeout: 30000 });
                            processRegistry.register(proc, {
                                runId: input.__runId,
                                toolName: "builtin.installedApps",
                                command: cmd,
                                type: "tool",
                            });
                            if (input.__runId && proc.pid) {
                                runManager.setProcessId(input.__runId, proc.pid);
                            }
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
            });
        },
    });
    // ──────────────────────────────────────────────────────────────
    // V2: Asset-aware tools
    // ──────────────────────────────────────────────────────────────
    tools.set("builtin.readAsset", {
        name: "builtin.readAsset",
        description: "Read an uploaded asset by its asset_id. Returns text content for text-based files, or base64 for binary files.",
        inputSchema: {
            type: "object",
            properties: {
                asset_id: {
                    type: "string",
                    description: "The asset_id of the uploaded file",
                },
            },
            required: ["asset_id"],
        },
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var meta, filePath, isText, content, buffer;
            return __generator(this, function (_a) {
                if (!assetManager)
                    throw new Error("Asset manager not initialized");
                meta = assetManager.get(input.asset_id);
                if (!meta) {
                    return [2 /*return*/, { content: "Asset not found: ".concat(input.asset_id), error: "Asset not found" }];
                }
                filePath = assetManager.resolvePath(input.asset_id);
                if (!filePath || !fs_1.default.existsSync(filePath)) {
                    return [2 /*return*/, { content: "Asset file missing from sandbox", error: "File missing" }];
                }
                isText = meta.mime_type.startsWith("text/") ||
                    ["application/json", "application/xml", "image/svg+xml"].includes(meta.mime_type);
                if (isText) {
                    content = fs_1.default.readFileSync(filePath, "utf-8");
                    return [2 /*return*/, {
                            content: content,
                            metadata: {
                                asset_id: meta.asset_id,
                                filename: meta.filename,
                                mime_type: meta.mime_type,
                                size: meta.size,
                                encoding: "utf-8",
                            },
                        }];
                }
                buffer = fs_1.default.readFileSync(filePath);
                return [2 /*return*/, {
                        content: "[Binary file: ".concat(meta.filename, " (").concat(meta.mime_type, ", ").concat(meta.size, " bytes)]"),
                        metadata: {
                            asset_id: meta.asset_id,
                            filename: meta.filename,
                            mime_type: meta.mime_type,
                            size: meta.size,
                            encoding: "base64",
                            base64: buffer.toString("base64"),
                        },
                    }];
            });
        }); },
    });
    permissionManager.registerToolPermissions("builtin.readAsset", {
        filesystem: { actions: ["read"] },
    });
    tools.set("builtin.extractPdf", {
        name: "builtin.extractPdf",
        description: "Extract text content from a PDF file. Accepts asset_id or file path.",
        inputSchema: {
            type: "object",
            properties: {
                asset_id: {
                    type: "string",
                    description: "The asset_id of an uploaded PDF",
                },
                path: {
                    type: "string",
                    description: "File path to a PDF (asset_id preferred)",
                },
            },
        },
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var pdfPath, sourceLabel, pdfParse, buffer, data, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pdfPath = null;
                        sourceLabel = "";
                        // Priority: asset_id → __asset_path (from resolution) → raw path
                        if (input.asset_id && assetManager) {
                            pdfPath = assetManager.resolvePath(input.asset_id);
                            sourceLabel = "asset:".concat(input.asset_id);
                        }
                        else if (input.__asset_path) {
                            pdfPath = input.__asset_path;
                            sourceLabel = "asset-resolved";
                        }
                        else if (input.path) {
                            pdfPath = resolveSafePath(input.path);
                            assertPathSafe(pdfPath);
                            sourceLabel = "file:".concat(input.path);
                        }
                        if (!pdfPath) {
                            return [2 /*return*/, { content: "No PDF source provided. Supply asset_id or path.", error: "Missing input" }];
                        }
                        if (!fs_1.default.existsSync(pdfPath)) {
                            return [2 /*return*/, { content: "PDF file not found: ".concat(sourceLabel), error: "File not found" }];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        pdfParse = require("pdf-parse");
                        buffer = fs_1.default.readFileSync(pdfPath);
                        return [4 /*yield*/, pdfParse(buffer)];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, {
                                content: data.text || "[No text content extracted]",
                                metadata: {
                                    source: sourceLabel,
                                    pages: data.numpages,
                                    info: data.info,
                                    textLength: (data.text || "").length,
                                },
                            }];
                    case 3:
                        e_1 = _a.sent();
                        return [2 /*return*/, {
                                content: "Failed to extract PDF text: ".concat(e_1.message),
                                error: e_1.message,
                                metadata: { source: sourceLabel },
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        }); },
    });
    permissionManager.registerToolPermissions("builtin.extractPdf", {
        filesystem: { actions: ["read"] },
    });
    tools.set("builtin.analyzeAsset", {
        name: "builtin.analyzeAsset",
        description: "Analyze an uploaded asset: extract text from PDFs, parse CSVs, read text files. Returns structured content ready for LLM processing.",
        inputSchema: {
            type: "object",
            properties: {
                asset_id: {
                    type: "string",
                    description: "The asset_id of the uploaded file",
                },
                question: {
                    type: "string",
                    description: "Optional question about the asset content",
                },
            },
            required: ["asset_id"],
        },
        run: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var meta, filePath, extractedText, analysisType, pdfParse, buffer, data, e_2, raw, lines, headers, rows, i, content;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!assetManager)
                            throw new Error("Asset manager not initialized");
                        meta = assetManager.get(input.asset_id);
                        if (!meta) {
                            return [2 /*return*/, { content: "Asset not found: ".concat(input.asset_id), error: "Asset not found" }];
                        }
                        filePath = assetManager.resolvePath(input.asset_id);
                        if (!filePath || !fs_1.default.existsSync(filePath)) {
                            return [2 /*return*/, { content: "Asset file missing from sandbox", error: "File missing" }];
                        }
                        extractedText = "";
                        analysisType = "";
                        if (!(meta.mime_type === "application/pdf")) return [3 /*break*/, 5];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        pdfParse = require("pdf-parse");
                        buffer = fs_1.default.readFileSync(filePath);
                        return [4 /*yield*/, pdfParse(buffer)];
                    case 2:
                        data = _a.sent();
                        extractedText = data.text || "[No text content]";
                        analysisType = "pdf";
                        return [3 /*break*/, 4];
                    case 3:
                        e_2 = _a.sent();
                        return [2 /*return*/, { content: "PDF extraction failed: ".concat(e_2.message), error: e_2.message }];
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        if (meta.mime_type === "text/csv") {
                            raw = fs_1.default.readFileSync(filePath, "utf-8");
                            lines = raw.split("\n").filter(function (l) { return l.trim(); });
                            headers = lines[0] ? lines[0].split(",").map(function (h) { return h.trim(); }) : [];
                            rows = lines.slice(1).map(function (line) { return line.split(",").map(function (c) { return c.trim(); }); });
                            extractedText = "CSV Data:\nHeaders: ".concat(headers.join(", "), "\nRows: ").concat(rows.length, "\n\nSample (first 20 rows):\n");
                            for (i = 0; i < Math.min(20, rows.length); i++) {
                                extractedText += rows[i].join(", ") + "\n";
                            }
                            analysisType = "csv";
                        }
                        else if (meta.mime_type.startsWith("text/") || ["application/json", "application/xml"].includes(meta.mime_type)) {
                            // Text files
                            extractedText = fs_1.default.readFileSync(filePath, "utf-8");
                            analysisType = "text";
                        }
                        else if (meta.mime_type.startsWith("image/")) {
                            extractedText = "[Image file: ".concat(meta.filename, " (").concat(meta.mime_type, ", ").concat(meta.size, " bytes). Image content analysis requires a vision model.]");
                            analysisType = "image";
                        }
                        else {
                            extractedText = "[Binary file: ".concat(meta.filename, " (").concat(meta.mime_type, ", ").concat(meta.size, " bytes). Cannot extract text from this file type.]");
                            analysisType = "binary";
                        }
                        _a.label = 6;
                    case 6:
                        content = "File: ".concat(meta.filename, " (").concat(meta.mime_type, ")\n\n").concat(extractedText);
                        if (input.question) {
                            content = "File: ".concat(meta.filename, " (").concat(meta.mime_type, ")\n\nContent:\n").concat(extractedText, "\n\nQuestion: ").concat(input.question);
                        }
                        return [2 /*return*/, {
                                content: content,
                                metadata: {
                                    asset_id: meta.asset_id,
                                    filename: meta.filename,
                                    mime_type: meta.mime_type,
                                    size: meta.size,
                                    analysisType: analysisType,
                                    textLength: extractedText.length,
                                    suggestedRole: input.question ? "writer_cheap" : undefined,
                                },
                            }];
                }
            });
        }); },
    });
    permissionManager.registerToolPermissions("builtin.analyzeAsset", {
        filesystem: { actions: ["read"] },
    });
    // Ensure builtin tools always have declared permission metadata.
    tools.forEach(function (_tool, toolName) {
        if (toolName.startsWith("builtin.") &&
            !permissionManager.getToolPermissions(toolName)) {
            permissionManager.registerToolPermissions(toolName, {});
        }
    });
}
function resolveSafePath(inputPath) {
    var normalized = inputPath.trim();
    // Allow absolute paths or resolve relative to user's home
    if (path_1.default.isAbsolute(normalized)) {
        return path_1.default.resolve(normalized);
    }
    var workingDir = store.get("workingDir") || electron_1.app.getPath("home");
    return path_1.default.resolve(workingDir, normalized);
}
function normalizePathForComparison(inputPath) {
    var resolved = path_1.default.resolve(inputPath);
    var normalized = path_1.default.normalize(resolved);
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
function isPathWithinRoot(targetPath, rootPath) {
    var target = normalizePathForComparison(targetPath);
    var root = normalizePathForComparison(rootPath);
    if (target === root)
        return true;
    var rootWithSep = root.endsWith(path_1.default.sep) ? root : "".concat(root).concat(path_1.default.sep);
    return target.startsWith(rootWithSep);
}
function isPathSafe(targetPath) {
    var safePaths = store.get("safePaths") || [];
    var workingDir = store.get("workingDir");
    var resolvedTarget = path_1.default.resolve(targetPath);
    // If no safe paths configured, allow workingDir and home
    if (safePaths.length === 0) {
        var allowedRoots = [workingDir, electron_1.app.getPath("home"), process.cwd()].filter(Boolean);
        return allowedRoots.some(function (root) { return isPathWithinRoot(resolvedTarget, root); });
    }
    // Check if path is within any safe path
    return safePaths.some(function (safePath) {
        return isPathWithinRoot(resolvedTarget, safePath);
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
                        var _a;
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
                            if ((_a = _this.process) === null || _a === void 0 ? void 0 : _a.pid) {
                                processRegistry.register(_this.process, {
                                    toolName: _this.name,
                                    command: "".concat(command, " ").concat(args.join(" ")).trim(),
                                    type: "mcp",
                                });
                            }
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
                                var e_3;
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
                                            e_3 = _a.sent();
                                            console.error("[MCP ".concat(this.name, "] Initialization failed:"), e_3.message);
                                            this.status = "error";
                                            reject(new Error("Initialization failed: ".concat(e_3.message)));
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
                            var connectCmd, e_4;
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
                                        e_4 = _a.sent();
                                        this.status = "error";
                                        reject(e_4);
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
function createMCPClient(config) {
    var transport = config.transport || "stdio";
    var proxyPort = store.get("pipewrenchPort", 9999);
    if (transport === "pipewrench") {
        return new MCPProxyClient(config.name, config.command, config.args || [], proxyPort);
    }
    return new MCPClient(config.name, config.command, config.args || []);
}
function registerMCPTools(client, serverName) {
    var _this = this;
    client.tools.forEach(function (tool) {
        var toolName = "mcp.".concat(serverName, ".").concat(tool.name);
        tools.set(toolName, {
            name: toolName,
            description: tool.description,
            inputSchema: tool.inputSchema,
            mcpServer: serverName,
            mcpToolName: tool.name,
            run: function (input) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, client.callTool(tool.name, input)];
            }); }); },
        });
        // MCP tools are external; we still register explicit metadata.
        permissionManager.registerToolPermissions(toolName, {});
    });
}
function loadMCPServers() {
    var _this = this;
    var serverConfigs = store.get("mcpServers") || [];
    console.log("[loadMCPServers] Loading MCP servers:", serverConfigs.length);
    serverConfigs.forEach(function (config) { return __awaiter(_this, void 0, void 0, function () {
        var client, e_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!config.name || !config.command)
                        return [2 /*return*/];
                    client = createMCPClient(config);
                    mcpClients.set(config.name, client);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.connect()];
                case 2:
                    _a.sent();
                    // Register MCP tools with mcp. prefix
                    registerMCPTools(client, config.name);
                    console.log("[MCP] Connected to ".concat(config.name, ", registered ").concat(client.tools.length, " tools"));
                    return [3 /*break*/, 4];
                case 3:
                    e_5 = _a.sent();
                    console.error("[MCP] Failed to connect to ".concat(config.name, ":"), e_5);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
}
function getPermissionProfileDecision(toolName, action) {
    var _a;
    var profiles = store.get("permissionProfiles") ||
        {};
    var exact = profiles[toolName];
    var wildcard = profiles["*"];
    return (_a = exact === null || exact === void 0 ? void 0 : exact[action]) !== null && _a !== void 0 ? _a : wildcard === null || wildcard === void 0 ? void 0 : wildcard[action];
}
function enforceToolPermissions(toolName) {
    var permissions = permissionManager.getToolPermissions(toolName);
    // Tools must declare metadata explicitly.
    if (!permissions) {
        throw new Error("Permission metadata missing for tool: ".concat(toolName));
    }
    var categories = ["filesystem", "network", "process"];
    for (var _i = 0, categories_1 = categories; _i < categories_1.length; _i++) {
        var category = categories_1[_i];
        var categoryPerms = permissions[category];
        if (!categoryPerms)
            continue;
        for (var _a = 0, _b = categoryPerms.actions; _a < _b.length; _a++) {
            var action = _b[_a];
            if (isFeatureEnabled("N_PERMISSION_PROFILES")) {
                var profileDecision = getPermissionProfileDecision(toolName, action);
                if (profileDecision === "allow") {
                    continue;
                }
                if (profileDecision === "deny") {
                    throw new Error("Permission denied by profile for ".concat(category, ":").concat(action));
                }
                if (profileDecision === "ask") {
                    throw new Error("PERMISSION_REQUIRED:".concat(toolName));
                }
            }
            var check = permissionManager.checkPermission(toolName, category, action);
            if (!check.allowed) {
                if (check.needsPrompt) {
                    throw new Error("PERMISSION_REQUIRED:".concat(toolName));
                }
                throw new Error("Permission denied for ".concat(category, ":").concat(action));
            }
        }
    }
}
var pendingSafeFixPreviews = new Map();
var TOOL_TIMEOUT_HINTS = [
    {
        pattern: /^builtin\.shell$/,
        hints: [
            "Reduce command output volume.",
            "Increase tool timeout in tool input if safe.",
            "Run command in a narrower working directory.",
        ],
    },
    {
        pattern: /^mcp\./,
        hints: [
            "Check MCP server status in Settings.",
            "If using PipeWrench transport, verify proxy health and port.",
            "Reconnect the MCP server and retry.",
        ],
    },
    {
        pattern: /^builtin\.(processes|diskSpace|installedApps)$/,
        hints: [
            "Retry when system load is lower.",
            "Limit scope/size of requested data.",
        ],
    },
];
function getKnownIssuesForTool(toolName) {
    var fromConfig = (store.get("toolKnownIssues") || {})[toolName] ||
        [];
    var manifest = manifestRegistry.get(toolName);
    var fromManifest = Array.isArray(manifest === null || manifest === void 0 ? void 0 : manifest.knownIssues)
        ? manifest.knownIssues
        : [];
    return Array.from(new Set(__spreadArray(__spreadArray([], fromManifest, true), fromConfig, true).map(function (s) { return (typeof s === "string" ? s.trim() : ""); })
        .filter(Boolean)));
}
function getTimeoutHintsForTool(toolName) {
    var match = TOOL_TIMEOUT_HINTS.find(function (m) { return m.pattern.test(toolName); });
    if (match)
        return match.hints;
    return [
        "Try a smaller input payload.",
        "Verify local system resources and retry.",
    ];
}
function toHealthStatus(raw) {
    if (raw === "connected")
        return "pass";
    if (raw === "error")
        return "fail";
    return "warn";
}
function getMCPHealthStatusForTool(toolName) {
    if (!toolName.startsWith("mcp."))
        return undefined;
    var parts = toolName.split(".");
    if (parts.length < 3)
        return undefined;
    var serverName = parts[1];
    var client = mcpClients.get(serverName);
    var rawStatus = (client === null || client === void 0 ? void 0 : client.status) ||
        "disconnected";
    var serverConfig = (store.get("mcpServers") || []).find(function (s) { return s.name === serverName; }) ||
        {};
    var transport = serverConfig.transport || "stdio";
    return {
        transport: transport,
        rawStatus: rawStatus,
        status: toHealthStatus(rawStatus),
        detail: transport === "pipewrench"
            ? "PipeWrench transport is ".concat(rawStatus)
            : "MCP transport is ".concat(rawStatus),
    };
}
function computeToolHealthSignals(toolName) {
    var runs = runManager.getAllRuns().filter(function (r) { return r.toolName === toolName; });
    var terminal = runs.filter(function (r) {
        return ["completed", "failed", "timed-out", "killed"].includes(r.state);
    });
    var completed = terminal.filter(function (r) { return r.state === "completed"; }).length;
    var failed = terminal.filter(function (r) { return r.state === "failed"; }).length;
    var timedOut = terminal.filter(function (r) { return r.state === "timed-out"; }).length;
    var killed = terminal.filter(function (r) { return r.state === "killed"; }).length;
    var timeoutRate = terminal.length > 0 ? timedOut / terminal.length : 0;
    var frequentTimeout = timedOut >= 2 && terminal.length >= 3 && timeoutRate >= 0.3;
    return {
        enabled: true,
        toolName: toolName,
        totalRuns: terminal.length,
        completed: completed,
        failed: failed,
        timedOut: timedOut,
        killed: killed,
        timeoutRate: timeoutRate,
        frequentTimeout: frequentTimeout,
        timeoutHints: frequentTimeout ? getTimeoutHintsForTool(toolName) : [],
        knownIssues: getKnownIssuesForTool(toolName),
        mcpStatus: getMCPHealthStatusForTool(toolName),
    };
}
function buildDiagnosticSuggestions(toolName, errorText) {
    var text = "".concat(toolName, " ").concat(errorText).toLowerCase();
    var suggestions = [];
    var pushSuggestion = function (suggestion) {
        if (!suggestions.some(function (s) { return s.classifier === suggestion.classifier; })) {
            suggestions.push(suggestion);
        }
    };
    if (/(command not found|is not recognized|enoent|path|cannot find)/i.test(text)) {
        pushSuggestion({
            classifier: "PATH",
            doctorSections: ["PATH Sanity", "Process Spawn Test"],
            explanation: "The failure pattern looks like a PATH or binary resolution issue.",
            suggestions: [
                "Run Doctor and review PATH Sanity.",
                "Verify required commands are installed and available to GUI apps.",
            ],
            safeFixes: [],
        });
    }
    if (/(permission denied|eacces|eperm|access denied)/i.test(text)) {
        pushSuggestion({
            classifier: "permissions",
            doctorSections: ["Config Directory Permissions"],
            explanation: "The failure pattern indicates a permissions/access problem.",
            suggestions: [
                "Review safe paths and tool permissions.",
                "Try running with narrower file targets.",
            ],
            safeFixes: [
                {
                    fixId: "fix:add-working-dir-to-safe-paths",
                    title: "Add working directory to safe paths",
                    description: "Limited config-only change; no files are modified.",
                },
            ],
        });
    }
    if (/(defender|antivirus|av|blocked by security|quarantine)/i.test(text)) {
        pushSuggestion({
            classifier: "AV",
            doctorSections: ["Antivirus/Defender", "Process Spawn Test"],
            explanation: "The failure may be caused by antivirus/endpoint security interference.",
            suggestions: [
                "Run Doctor and review Antivirus/Defender section.",
                "Consider adding Workbench folder exclusions if policy allows.",
            ],
            safeFixes: [],
        });
    }
    if (/(timeout|timed out|etimedout|econnreset|econnrefused|enotfound|network)/i.test(text)) {
        var toolHints = getTimeoutHintsForTool(toolName);
        pushSuggestion({
            classifier: "network_timeout",
            doctorSections: ["Localhost Network", "Proxy/Firewall"],
            explanation: "The failure pattern suggests a network or timeout issue.",
            suggestions: __spreadArray(__spreadArray([], toolHints, true), [
                "Check proxy/firewall settings and local network diagnostics.",
            ], false),
            safeFixes: [],
        });
    }
    if (/(no model configured|api key|invalid|bad request|misconfig|configuration|missing)/i.test(text)) {
        pushSuggestion({
            classifier: "invalid_config",
            doctorSections: ["PATH Sanity", "Proxy/Firewall"],
            explanation: "The failure pattern suggests an invalid or incomplete configuration.",
            suggestions: [
                "Review Settings values for model/api endpoint/api key.",
                "Re-run Doctor after configuration updates.",
            ],
            safeFixes: [
                {
                    fixId: "fix:set-default-api-endpoint",
                    title: "Set default API endpoint",
                    description: "Sets `apiEndpoint` to `https://openrouter.ai/api/v1` only if needed.",
                },
            ],
        });
    }
    return suggestions;
}
function createSafeFixPreview(fixId) {
    var cfg = store.store;
    if (fixId === "fix:set-default-api-endpoint") {
        var before = cfg.apiEndpoint || "";
        var after = "https://openrouter.ai/api/v1";
        if (before === after)
            return null;
        return {
            fixId: fixId,
            title: "Set default API endpoint",
            description: "Config-only update. Reversible by restoring previous value.",
            changes: [{ key: "apiEndpoint", before: before, after: after }],
        };
    }
    if (fixId === "fix:add-working-dir-to-safe-paths") {
        var workingDir = cfg.workingDir || electron_1.app.getPath("home");
        var before = Array.isArray(cfg.safePaths) ? cfg.safePaths : [];
        if (!workingDir || before.includes(workingDir))
            return null;
        var after = __spreadArray(__spreadArray([], before, true), [workingDir], false);
        return {
            fixId: fixId,
            title: "Add working directory to safe paths",
            description: "Config-only update. Reversible by removing the added path.",
            changes: [{ key: "safePaths", before: before, after: after }],
        };
    }
    return null;
}
function applySafeFix(fixId, changes) {
    try {
        if (fixId === "fix:set-default-api-endpoint") {
            var change = changes.find(function (c) { return c.key === "apiEndpoint"; });
            if (!change)
                return { success: false, error: "Preview mismatch for apiEndpoint" };
            store.set("apiEndpoint", change.after);
            return { success: true };
        }
        if (fixId === "fix:add-working-dir-to-safe-paths") {
            var change = changes.find(function (c) { return c.key === "safePaths"; });
            if (!change || !Array.isArray(change.after)) {
                return { success: false, error: "Preview mismatch for safePaths" };
            }
            store.set("safePaths", change.after);
            return { success: true };
        }
        return { success: false, error: "Unknown fix ID" };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
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
// Tool Health Signals (L) - optional, local-only
electron_1.ipcMain.handle("toolHealth:get", function (_e, toolName) {
    if (!isFeatureEnabled("L_TOOL_HEALTH_SIGNALS")) {
        return { enabled: false, toolName: toolName };
    }
    return computeToolHealthSignals(toolName);
});
electron_1.ipcMain.handle("toolHealth:addKnownIssue", function (_e, toolName, note) {
    if (!isFeatureEnabled("L_TOOL_HEALTH_SIGNALS")) {
        return { success: false, error: "Feature disabled" };
    }
    var trimmed = (note || "").trim();
    if (!trimmed) {
        return { success: false, error: "Note cannot be empty" };
    }
    var allIssues = store.get("toolKnownIssues") || {};
    var current = Array.isArray(allIssues[toolName]) ? allIssues[toolName] : [];
    allIssues[toolName] = Array.from(new Set(__spreadArray(__spreadArray([], current, true), [trimmed], false)));
    store.set("toolKnownIssues", allIssues);
    return { success: true, issues: allIssues[toolName] };
});
electron_1.ipcMain.handle("toolHealth:removeKnownIssue", function (_e, toolName, index) {
    if (!isFeatureEnabled("L_TOOL_HEALTH_SIGNALS")) {
        return { success: false, error: "Feature disabled" };
    }
    var allIssues = store.get("toolKnownIssues") || {};
    var current = Array.isArray(allIssues[toolName]) ? allIssues[toolName] : [];
    if (index < 0 || index >= current.length) {
        return { success: false, error: "Issue index out of range" };
    }
    current.splice(index, 1);
    allIssues[toolName] = current;
    store.set("toolKnownIssues", allIssues);
    return { success: true, issues: current };
});
electron_1.ipcMain.handle("tools:run", function (_e, name, input) { return __awaiter(void 0, void 0, void 0, function () {
    var tool, toolSpec, selectedRunner, validation, actionType, cmdCheck, filePath, pathCheck, riskLevel, runId, message, runInput, DEFAULT_TOOL_TIMEOUT, manifest, TOOL_TIMEOUT, MAX_OUTPUT_SIZE, timeoutPromise, rawOutput, normalized, snippet, error_1, doctorEngine_1, triggerEvent;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tool = tools.get(name);
                if (!tool)
                    throw new Error("Tool not found: ".concat(name));
                toolSpec = {
                    name: tool.name,
                    input: input
                };
                selectedRunner = runner_1.runnerRegistry.findRunner(toolSpec);
                if (!selectedRunner) {
                    console.error("[tools:run] No runner available for tool: ".concat(name));
                    throw new Error("No runner available for tool: ".concat(name));
                }
                // ASSERTION: Phase 1 - must be ShellRunner
                if (selectedRunner.name !== 'shell') {
                    console.error("[tools:run] PHASE 1 VIOLATION: Non-shell runner selected: ".concat(selectedRunner.name));
                }
                console.log("[tools:run] Tool \"".concat(name, "\" \u2192 Runner \"").concat(selectedRunner.name, "\""));
                // V2: Schema validation before execution
                if (tool.inputSchema) {
                    validation = schemaValidator.validateToolInput(input || {}, tool.inputSchema);
                    if (!validation.valid) {
                        throw new Error("Schema validation failed: ".concat(validation.errors.join('; ')));
                    }
                }
                actionType = commandGuardrails.classifyAction(name, input);
                if (actionType === 'terminal_command') {
                    cmdCheck = commandGuardrails.checkCommand((input === null || input === void 0 ? void 0 : input.command) || '', (input === null || input === void 0 ? void 0 : input.args) || []);
                    if (!cmdCheck.allowed) {
                        throw new Error("Blocked by guardrails: ".concat(cmdCheck.reason));
                    }
                }
                // V2: Path sandbox validation for file operations
                if ((actionType === 'file_write' || actionType === 'file_delete') && pathSandbox) {
                    filePath = (input === null || input === void 0 ? void 0 : input.path) || (input === null || input === void 0 ? void 0 : input.filePath) || '';
                    if (filePath) {
                        pathCheck = pathSandbox.isPathAllowed(filePath);
                        if (!pathCheck.allowed) {
                            throw new Error("Path blocked by sandbox: ".concat(pathCheck.reason));
                        }
                    }
                }
                // V2: Loop detection
                if (loopDetector.isInLoop(name, JSON.stringify(input || {}).substring(0, 200))) {
                    throw new Error(loopDetector.getLoopSuggestion(name));
                }
                // Concurrency cap check
                if (!processRegistry.canSpawn()) {
                    throw new Error("Concurrency limit reached (".concat(processRegistry.getCount(), " processes running). Wait for existing tools to finish or kill some first."));
                }
                riskLevel = commandGuardrails.assessRisk(name, actionType, input);
                runId = runManager.createRun(name, input, 'user');
                try {
                    enforceToolPermissions(name);
                }
                catch (permissionError) {
                    message = (permissionError === null || permissionError === void 0 ? void 0 : permissionError.message) || "Permission denied";
                    runManager.failRun(runId, message.startsWith("PERMISSION_REQUIRED:")
                        ? "Permission required"
                        : message);
                    throw permissionError;
                }
                // Start the run
                runManager.startRun(runId);
                runManager.setApprovalInfo(runId, riskLevel, 'user');
                runInput = name.startsWith("builtin.")
                    ? input && typeof input === "object" && !Array.isArray(input)
                        ? __assign(__assign({}, input), { __runId: runId }) : { __runId: runId }
                    : input;
                // V2: Asset resolution - resolve asset_id references to sandbox paths
                runInput = resolveAssetReferences(runInput);
                DEFAULT_TOOL_TIMEOUT = 30000;
                manifest = manifestRegistry.get(name);
                TOOL_TIMEOUT = ((manifest === null || manifest === void 0 ? void 0 : manifest.timeoutMs) && manifest.timeoutMs > 0)
                    ? manifest.timeoutMs
                    : DEFAULT_TOOL_TIMEOUT;
                MAX_OUTPUT_SIZE = 500000;
                timeoutPromise = new Promise(function (_, reject) {
                    setTimeout(function () { return reject(new Error("Tool execution timeout (".concat(Math.round(TOOL_TIMEOUT / 1000), "s limit)"))); }, TOOL_TIMEOUT);
                });
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, Promise.race([tool.run(runInput), timeoutPromise])];
            case 2:
                rawOutput = _a.sent();
                normalized = normalizeToolOutput(rawOutput);
                // Safety: Truncate large outputs
                if (typeof normalized.content === "string" &&
                    normalized.content.length > MAX_OUTPUT_SIZE) {
                    normalized.content =
                        normalized.content.substring(0, MAX_OUTPUT_SIZE) +
                            "\n\n[Output truncated - exceeded ".concat(MAX_OUTPUT_SIZE, " character limit]");
                    normalized.metadata = __assign(__assign({}, normalized.metadata), { truncated: true, originalSize: normalized.content.length });
                }
                snippet = typeof normalized.content === 'string'
                    ? normalized.content.slice(0, 200)
                    : JSON.stringify(normalized.content).slice(0, 200);
                runManager.completeRun(runId, normalized, snippet);
                // V3: Record successful tool usage for adaptive scoring
                if (isFeatureEnabled("V3_USAGE_TRACKING")) {
                    toolDispatcher.recordToolUsage(name, JSON.stringify(input).slice(0, 200), true);
                    store.set("toolUsageData", toolDispatcher.getUsageData());
                }
                return [2 /*return*/, normalized];
            case 3:
                error_1 = _a.sent();
                // Mark run as failed or timed out
                if (error_1.message.includes("timeout")) {
                    runManager.timeoutRun(runId);
                }
                else {
                    runManager.failRun(runId, error_1.message);
                }
                // V3: Record failed tool usage
                if (isFeatureEnabled("V3_USAGE_TRACKING")) {
                    toolDispatcher.recordToolUsage(name, JSON.stringify(input).slice(0, 200), false);
                    store.set("toolUsageData", toolDispatcher.getUsageData());
                }
                // V2: Record failure for loop detection
                loopDetector.recordFailure(name, error_1.message);
                doctorEngine_1 = getDoctorEngine();
                triggerEvent = doctorEngine_1.shouldAutoTrigger(error_1.message);
                if (triggerEvent) {
                    // Fire-and-forget, non-blocking
                    doctorEngine_1.autoTrigger(triggerEvent, "".concat(name, ": ").concat(error_1.message)).then(function (result) {
                        if (result.triggered && result.report && mainWindow) {
                            mainWindow.webContents.send('doctor:autoReport', result.report);
                            // Persist report history
                            store.set('doctorReportHistory', doctorEngine_1.getReportHistory());
                        }
                    }).catch(function () { });
                }
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
                            riskLevel: riskLevel,
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
        // Free models (OpenRouter free tier)
        "google/gemini-flash-1.5": { prompt: 0, completion: 0 },
        "google/gemini-pro-1.5": { prompt: 0, completion: 0 },
        "meta-llama/llama-3.2-3b-instruct:free": { prompt: 0, completion: 0 },
        "meta-llama/llama-3.1-8b-instruct:free": { prompt: 0, completion: 0 },
        "meta-llama/llama-3-8b-instruct:free": { prompt: 0, completion: 0 },
        "phi-3-mini-128k-instruct:free": { prompt: 0, completion: 0 },
        "qwen/qwen-2-7b-instruct:free": { prompt: 0, completion: 0 },
        "mistralai/mistral-7b-instruct:free": { prompt: 0, completion: 0 },
        default: { prompt: 1, completion: 2 },
    };
    // Check if model ID contains ":free" suffix (OpenRouter convention for free models)
    var isFreeModel = model.includes(":free");
    var rates = isFreeModel
        ? { prompt: 0, completion: 0 }
        : (pricing[model] || pricing["default"]);
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
    var config, apiKey, res, models, e_6;
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
                e_6 = _a.sent();
                throw new Error("Failed to fetch models: ".concat(e_6.message));
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
// Filter out model thinking/reasoning blocks
function filterThinkingBlocks(text) {
    // Remove various thinking block patterns
    var filtered = text;
    // Remove <thinking>...</thinking> blocks (Claude-style)
    filtered = filtered.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    // Remove <reasoning>...</reasoning> blocks
    filtered = filtered.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    // Remove <analysis>...</analysis> blocks
    filtered = filtered.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');
    // Remove <internal_thoughts>...</internal_thoughts> blocks
    filtered = filtered.replace(/<internal_thoughts>[\s\S]*?<\/internal_thoughts>/gi, '');
    // Clean up any remaining multiple newlines
    filtered = filtered.replace(/\n{3,}/g, '\n\n').trim();
    return filtered;
}
// Streaming task runner
electron_1.ipcMain.handle("task:runStream", function (_e, taskType, prompt, requestId) { return __awaiter(void 0, void 0, void 0, function () {
    var config, router, roleConfig, error, apiKey, error, apiEndpoint, processedPrompt, res, fullContent_1, promptTokens_1, completionTokens_1, requestCost_1, costTracked_1, doneSent_1, trackCostOnce_1, emitDoneOnce_1, e_7, errorData, chunks, _a, errorData_1, errorData_1_1, chunk, e_8_1, rawParams, streamErr_1, errorDetails, errorMessage, detailedMsg;
    var _b, e_8, _c, _d;
    var _f, _g, _h, _j, _k, _l, _m, _o, _p;
    return __generator(this, function (_q) {
        switch (_q.label) {
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
                _q.label = 1;
            case 1:
                _q.trys.push([1, 3, , 19]);
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
                res = _q.sent();
                fullContent_1 = "";
                promptTokens_1 = 0;
                completionTokens_1 = 0;
                requestCost_1 = 0;
                costTracked_1 = false;
                doneSent_1 = false;
                trackCostOnce_1 = function () {
                    if (costTracked_1)
                        return;
                    requestCost_1 = calculateCost(roleConfig.model, promptTokens_1, completionTokens_1);
                    sessionCosts.total += requestCost_1;
                    sessionCosts.requests += 1;
                    if (!sessionCosts.byModel[roleConfig.model]) {
                        sessionCosts.byModel[roleConfig.model] = {
                            cost: 0,
                            requests: 0,
                            tokens: { prompt: 0, completion: 0 },
                        };
                    }
                    sessionCosts.byModel[roleConfig.model].cost += requestCost_1;
                    sessionCosts.byModel[roleConfig.model].requests += 1;
                    sessionCosts.byModel[roleConfig.model].tokens.prompt += promptTokens_1;
                    sessionCosts.byModel[roleConfig.model].tokens.completion +=
                        completionTokens_1;
                    costTracked_1 = true;
                };
                emitDoneOnce_1 = function () {
                    if (doneSent_1)
                        return;
                    doneSent_1 = true;
                    // Filter out thinking blocks before sending final content
                    var filteredContent = filterThinkingBlocks(fullContent_1);
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send("stream:done", {
                        requestId: requestId,
                        content: filteredContent,
                        cost: requestCost_1,
                        tokens: { prompt: promptTokens_1, completion: completionTokens_1 },
                    });
                };
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
                            trackCostOnce_1();
                            emitDoneOnce_1();
                            return;
                        }
                        try {
                            var parsed = JSON.parse(data);
                            // Some models send reasoning/thinking in separate fields - ignore those
                            // Only use the actual content field, not reasoning_content or thinking
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
                    trackCostOnce_1();
                    emitDoneOnce_1();
                });
                res.data.on("error", function (err) {
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send("stream:error", {
                        requestId: requestId,
                        error: err.message,
                    });
                });
                return [2 /*return*/, { started: true, requestId: requestId }];
            case 3:
                e_7 = _q.sent();
                errorData = (_f = e_7.response) === null || _f === void 0 ? void 0 : _f.data;
                if (!(errorData && typeof errorData.pipe === 'function')) return [3 /*break*/, 18];
                _q.label = 4;
            case 4:
                _q.trys.push([4, 17, , 18]);
                chunks = [];
                _q.label = 5;
            case 5:
                _q.trys.push([5, 10, 11, 16]);
                _a = true, errorData_1 = __asyncValues(errorData);
                _q.label = 6;
            case 6: return [4 /*yield*/, errorData_1.next()];
            case 7:
                if (!(errorData_1_1 = _q.sent(), _b = errorData_1_1.done, !_b)) return [3 /*break*/, 9];
                _d = errorData_1_1.value;
                _a = false;
                chunk = _d;
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                _q.label = 8;
            case 8:
                _a = true;
                return [3 /*break*/, 6];
            case 9: return [3 /*break*/, 16];
            case 10:
                e_8_1 = _q.sent();
                e_8 = { error: e_8_1 };
                return [3 /*break*/, 16];
            case 11:
                _q.trys.push([11, , 14, 15]);
                if (!(!_a && !_b && (_c = errorData_1.return))) return [3 /*break*/, 13];
                return [4 /*yield*/, _c.call(errorData_1)];
            case 12:
                _q.sent();
                _q.label = 13;
            case 13: return [3 /*break*/, 15];
            case 14:
                if (e_8) throw e_8.error;
                return [7 /*endfinally*/];
            case 15: return [7 /*endfinally*/];
            case 16:
                rawParams = Buffer.concat(chunks).toString('utf8');
                try {
                    errorData = JSON.parse(rawParams);
                }
                catch (_r) {
                    errorData = rawParams;
                }
                return [3 /*break*/, 18];
            case 17:
                streamErr_1 = _q.sent();
                errorData = '[Stream Read Failed]';
                return [3 /*break*/, 18];
            case 18:
                errorDetails = {
                    status: (_g = e_7.response) === null || _g === void 0 ? void 0 : _g.status,
                    statusText: (_h = e_7.response) === null || _h === void 0 ? void 0 : _h.statusText,
                    data: errorData,
                    message: e_7.message,
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
                    catch (_s) { }
                }
                errorMessage = "[".concat(((_k = e_7.response) === null || _k === void 0 ? void 0 : _k.status) || 'Unknown', "] ").concat(detailedMsg || e_7.message || 'Request failed');
                // Fallbacks for specific status codes if no message found
                if (!detailedMsg) {
                    if (((_l = e_7.response) === null || _l === void 0 ? void 0 : _l.status) === 429) {
                        errorMessage = "[429] Rate limit exceeded for model \"".concat(roleConfig.model, "\". Free tier models have limited requests. Try again in a moment or use a different model.");
                    }
                    else if (((_m = e_7.response) === null || _m === void 0 ? void 0 : _m.status) === 404) {
                        errorMessage = "[404] Model not found: ".concat(roleConfig.model, ".");
                    }
                    else if (((_o = e_7.response) === null || _o === void 0 ? void 0 : _o.status) === 400) {
                        errorMessage = "[400] Bad request to model \"".concat(roleConfig.model, "\".");
                    }
                }
                else if (((_p = e_7.response) === null || _p === void 0 ? void 0 : _p.status) === 429 && !detailedMsg.toLowerCase().includes('rate limit')) {
                    // Enhance 429 message even if we got some detail
                    errorMessage = "[429] Rate limit exceeded. ".concat(detailedMsg, ". Try again in a moment or use a different model.");
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
                enforceToolPermissions(step.tool);
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
    var servers, transport, client, e_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("[mcp:add] Adding server:", config);
                servers = store.get("mcpServers") || [];
                servers.push(config);
                store.set("mcpServers", servers);
                transport = config.transport || "stdio";
                client = createMCPClient(config);
                mcpClients.set(config.name, client);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                console.log("[mcp:add] Connecting to server...");
                return [4 /*yield*/, client.connect()];
            case 2:
                _a.sent();
                console.log("[mcp:add] Connected! Tools:", client.tools.length);
                registerMCPTools(client, config.name);
                return [2 /*return*/, { success: true, toolCount: client.tools.length, transport: transport }];
            case 3:
                e_9 = _a.sent();
                console.error("[mcp:add] Connection failed:", e_9.message);
                client.disconnect(); // Clean up failed connection
                mcpClients.delete(config.name); // Remove from map
                return [2 /*return*/, { success: false, error: e_9.message || "Connection failed" }];
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
    var client, e_10;
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
                registerMCPTools(client, name);
                return [2 /*return*/, { success: true, toolCount: client.tools.length }];
            case 3:
                e_10 = _a.sent();
                return [2 /*return*/, { success: false, error: e_10.message }];
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
// Auto-Diagnostics - basic suggestions always enabled (V2.0 Trust Core).
// Safe-fix preview flow is gated behind M_SMART_AUTO_DIAGNOSTICS.
electron_1.ipcMain.handle("doctor:suggestFailure", function (_e, toolName, errorText) {
    var suggestions = buildDiagnosticSuggestions(toolName || "", errorText || "");
    var smartEnabled = isFeatureEnabled("M_SMART_AUTO_DIAGNOSTICS");
    // Strip safeFixes when M flag is off so safe-fix UI stays hidden
    var cleaned = smartEnabled
        ? suggestions
        : suggestions.map(function (s) { return (__assign(__assign({}, s), { safeFixes: [] })); });
    return {
        enabled: true,
        suggestions: cleaned,
    };
});
electron_1.ipcMain.handle("safeFix:preview", function (_e, fixId) {
    if (!isFeatureEnabled("M_SMART_AUTO_DIAGNOSTICS")) {
        return { success: false, error: "Feature disabled" };
    }
    var preview = createSafeFixPreview(fixId);
    if (!preview) {
        return { success: false, error: "No applicable safe fix changes found" };
    }
    var token = "safe_fix_".concat(Date.now(), "_").concat(Math.random().toString(36).slice(2, 9));
    pendingSafeFixPreviews.set(token, {
        fixId: fixId,
        createdAt: Date.now(),
        changes: preview.changes,
    });
    return { success: true, token: token, preview: preview };
});
electron_1.ipcMain.handle("safeFix:apply", function (_e, token) {
    if (!isFeatureEnabled("M_SMART_AUTO_DIAGNOSTICS")) {
        return { success: false, error: "Feature disabled" };
    }
    var pending = pendingSafeFixPreviews.get(token);
    if (!pending) {
        return { success: false, error: "Preview token missing or expired" };
    }
    pendingSafeFixPreviews.delete(token);
    return applySafeFix(pending.fixId, pending.changes);
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
// SESSION MANAGEMENT
// ============================================================================
// Get all sessions metadata
electron_1.ipcMain.handle("sessions:getAll", function () {
    try {
        var sessions = sessionsManager.getAllSessionMetadata();
        return { success: true, sessions: sessions };
    }
    catch (error) {
        console.error('[sessions:getAll] Error:', error);
        return { success: false, error: error.message, sessions: [] };
    }
});
// Get current session
electron_1.ipcMain.handle("sessions:getCurrent", function () {
    try {
        var session = sessionsManager.getCurrentSession();
        return { success: true, session: session };
    }
    catch (error) {
        console.error('[sessions:getCurrent] Error:', error);
        return { success: false, error: error.message };
    }
});
// Get session by ID
electron_1.ipcMain.handle("sessions:getById", function (_e, sessionId) {
    try {
        var session = sessionsManager.getSession(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }
        return { success: true, session: session };
    }
    catch (error) {
        console.error('[sessions:getById] Error:', error);
        return { success: false, error: error.message };
    }
});
// Create new session
electron_1.ipcMain.handle("sessions:create", function (_e, name) {
    try {
        var session = sessionsManager.createSession(name);
        return { success: true, session: session };
    }
    catch (error) {
        console.error('[sessions:create] Error:', error);
        return { success: false, error: error.message };
    }
});
// Switch to session
electron_1.ipcMain.handle("sessions:switch", function (_e, sessionId) {
    try {
        var success = sessionsManager.setCurrentSession(sessionId);
        if (!success) {
            return { success: false, error: 'Session not found' };
        }
        var session = sessionsManager.getSession(sessionId);
        return { success: true, session: session };
    }
    catch (error) {
        console.error('[sessions:switch] Error:', error);
        return { success: false, error: error.message };
    }
});
// Rename session
electron_1.ipcMain.handle("sessions:rename", function (_e, sessionId, newName) {
    try {
        var success = sessionsManager.renameSession(sessionId, newName);
        return { success: success };
    }
    catch (error) {
        console.error('[sessions:rename] Error:', error);
        return { success: false, error: error.message };
    }
});
// Delete session
electron_1.ipcMain.handle("sessions:delete", function (_e, sessionId) {
    try {
        var success = sessionsManager.deleteSession(sessionId);
        return { success: success };
    }
    catch (error) {
        console.error('[sessions:delete] Error:', error);
        return { success: false, error: error.message };
    }
});
// Update session chat history
electron_1.ipcMain.handle("sessions:updateHistory", function (_e, sessionId, history) {
    try {
        var success = sessionsManager.updateChatHistory(sessionId, history);
        return { success: success };
    }
    catch (error) {
        console.error('[sessions:updateHistory] Error:', error);
        return { success: false, error: error.message };
    }
});
// Update session mode
electron_1.ipcMain.handle("sessions:updateMode", function (_e, sessionId, mode) {
    try {
        var success = sessionsManager.updateMode(sessionId, mode);
        return { success: success };
    }
    catch (error) {
        console.error('[sessions:updateMode] Error:', error);
        return { success: false, error: error.message };
    }
});
// Update session model
electron_1.ipcMain.handle("sessions:updateModel", function (_e, sessionId, model) {
    try {
        var success = sessionsManager.updateModel(sessionId, model);
        return { success: success };
    }
    catch (error) {
        console.error('[sessions:updateModel] Error:', error);
        return { success: false, error: error.message };
    }
});
// Update session provider
electron_1.ipcMain.handle("sessions:updateProvider", function (_e, sessionId, provider) {
    try {
        var success = sessionsManager.updateProvider(sessionId, provider);
        return { success: success };
    }
    catch (error) {
        console.error('[sessions:updateProvider] Error:', error);
        return { success: false, error: error.message };
    }
});
// ============================================================================
// CHAT HISTORY PERSISTENCE (Legacy - kept for backward compat)
// ============================================================================
// Save chat history
electron_1.ipcMain.handle("chat:save", function (_e, history) {
    try {
        // Save to current session
        var sessionId = sessionsManager.getCurrentSessionId();
        if (sessionId) {
            sessionsManager.updateChatHistory(sessionId, history);
        }
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
        // Load from current session
        var session = sessionsManager.getCurrentSession();
        return { success: true, history: session.chatHistory };
    }
    catch (error) {
        console.error('[chat:load] Error:', error);
        return { success: false, error: error.message, history: [] };
    }
});
// Clear chat history
electron_1.ipcMain.handle("chat:clear", function () {
    try {
        // Clear current session history
        var sessionId = sessionsManager.getCurrentSessionId();
        if (sessionId) {
            sessionsManager.updateChatHistory(sessionId, []);
        }
        return { success: true };
    }
    catch (error) {
        console.error('[chat:clear] Error:', error);
        return { success: false, error: error.message };
    }
});
// ============================================================================
// RUN MANAGER - EXECUTION TRACKING
// ============================================================================
// Get active runs
electron_1.ipcMain.handle("runs:getActive", function () {
    return runManager.getActiveRuns();
});
// Get run history
electron_1.ipcMain.handle("runs:getHistory", function (_e, limit) {
    return runManager.getHistory(limit);
});
// Get all runs
electron_1.ipcMain.handle("runs:getAll", function () {
    return runManager.getAllRuns();
});
// Get specific run
electron_1.ipcMain.handle("runs:get", function (_e, runId) {
    return runManager.getRun(runId);
});
// Get run statistics
electron_1.ipcMain.handle("runs:getStats", function () {
    return runManager.getStats();
});
// Kill a run (graceful: SIGTERM then SIGKILL after 3s)
electron_1.ipcMain.handle("runs:kill", function (_e, runId) { return __awaiter(void 0, void 0, void 0, function () {
    var run, killed;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                run = runManager.getRun(runId);
                if (!run)
                    return [2 /*return*/, { success: false, error: 'Run not found' }];
                return [4 /*yield*/, processRegistry.gracefulKillRun(runId, 3000)];
            case 1:
                killed = _a.sent();
                console.log("[runs:kill] Killed ".concat(killed, " processes for run ").concat(runId));
                runManager.killRun(runId);
                return [2 /*return*/, { success: true, processesKilled: killed }];
        }
    });
}); });
// Clear run history
electron_1.ipcMain.handle("runs:clearHistory", function () {
    runManager.clearHistory();
    return { success: true };
});
// Clear all runs
electron_1.ipcMain.handle("runs:clearAll", function () {
    runManager.clearAll();
    return { success: true };
});
// Get interrupted runs (for crash recovery)
electron_1.ipcMain.handle("runs:getInterrupted", function () {
    return runManager.getInterruptedRuns();
});
// Export run bundle (N) - optional, read-only support artifact for issue filing
electron_1.ipcMain.handle("runs:exportBundle", function (_e, runId) { return __awaiter(void 0, void 0, void 0, function () {
    var allRuns, selectedRuns, bundle, _a, filePath, canceled;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!isFeatureEnabled("N_EXPORT_RUN_BUNDLE")) {
                    return [2 /*return*/, { success: false, error: "Feature disabled" }];
                }
                allRuns = runManager.getAllRuns();
                selectedRuns = runId && runId.trim()
                    ? allRuns.filter(function (r) { return r.runId === runId; })
                    : runManager.getHistory(200);
                bundle = {
                    exportedAt: new Date().toISOString(),
                    appVersion: electron_1.app.getVersion(),
                    platform: process.platform,
                    runId: runId || null,
                    runCount: selectedRuns.length,
                    stats: runManager.getStats(),
                    runs: selectedRuns,
                    doctorReport: lastDoctorReport
                        ? getDoctorEngine().sanitizeReport(lastDoctorReport)
                        : null,
                };
                return [4 /*yield*/, electron_1.dialog.showSaveDialog(mainWindow, {
                        title: "Export Run Bundle",
                        defaultPath: "workbench-run-bundle-".concat(new Date().toISOString().split("T")[0], ".json"),
                        filters: [{ name: "JSON Files", extensions: ["json"] }],
                    })];
            case 1:
                _a = _b.sent(), filePath = _a.filePath, canceled = _a.canceled;
                if (canceled || !filePath) {
                    return [2 /*return*/, { success: false, canceled: true }];
                }
                fs_1.default.writeFileSync(filePath, JSON.stringify(bundle, null, 2), "utf-8");
                return [2 /*return*/, { success: true, filePath: filePath, runCount: selectedRuns.length }];
        }
    });
}); });
// ============================================================================
// V2: DOCTOR REPORT HISTORY IPC
// ============================================================================
electron_1.ipcMain.handle("doctor:getHistory", function () {
    var engine = getDoctorEngine();
    return engine.getReportHistory();
});
// ============================================================================
// V2: GUARDRAILS IPC
// ============================================================================
electron_1.ipcMain.handle("guardrails:validateSchema", function (_e, input, schema) {
    return schemaValidator.validateToolInput(input, schema);
});
electron_1.ipcMain.handle("guardrails:checkCommand", function (_e, command, args) {
    return commandGuardrails.checkCommand(command, args);
});
electron_1.ipcMain.handle("guardrails:checkPath", function (_e, filePath) {
    if (!pathSandbox)
        return { allowed: true, riskLevel: 'low' };
    return pathSandbox.isPathAllowed(filePath);
});
electron_1.ipcMain.handle("guardrails:assessRisk", function (_e, toolName, input) {
    var actionType = commandGuardrails.classifyAction(toolName, input);
    return {
        actionType: actionType,
        riskLevel: commandGuardrails.assessRisk(toolName, actionType, input),
        proposal: commandGuardrails.createProposal(toolName, actionType, input),
    };
});
// ============================================================================
// V2: ASSET MANAGER IPC HANDLERS
// ============================================================================
electron_1.ipcMain.handle("assets:ingest", function (_e, sourcePath) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!assetManager)
                    throw new Error("Asset manager not initialized");
                return [4 /*yield*/, assetManager.ingest(sourcePath)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); });
electron_1.ipcMain.handle("assets:ingestBuffer", function (_e, bufferData, filename) { return __awaiter(void 0, void 0, void 0, function () {
    var buffer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!assetManager)
                    throw new Error("Asset manager not initialized");
                buffer = Buffer.from(bufferData);
                return [4 /*yield*/, assetManager.ingestBuffer(buffer, filename)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); });
electron_1.ipcMain.handle("assets:list", function () {
    if (!assetManager)
        return { assets: [], total: 0 };
    return assetManager.list();
});
electron_1.ipcMain.handle("assets:get", function (_e, assetId) {
    if (!assetManager)
        return null;
    return assetManager.get(assetId);
});
electron_1.ipcMain.handle("assets:open", function (_e, assetId) {
    if (!assetManager)
        return null;
    var result = assetManager.open(assetId);
    if (!result)
        return null;
    // Return metadata + base64 content for renderer
    return {
        metadata: result.metadata,
        content: result.content.toString('base64'),
        contentType: result.metadata.mime_type,
    };
});
electron_1.ipcMain.handle("assets:delete", function (_e, assetId) {
    if (!assetManager)
        return false;
    return assetManager.delete(assetId);
});
electron_1.ipcMain.handle("assets:export", function (_e, assetId) { return __awaiter(void 0, void 0, void 0, function () {
    var meta, _a, filePath, canceled, success;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!assetManager)
                    throw new Error("Asset manager not initialized");
                meta = assetManager.get(assetId);
                if (!meta)
                    throw new Error("Asset not found");
                return [4 /*yield*/, electron_1.dialog.showSaveDialog(mainWindow, {
                        title: "Export Asset",
                        defaultPath: meta.filename,
                    })];
            case 1:
                _a = _b.sent(), filePath = _a.filePath, canceled = _a.canceled;
                if (canceled || !filePath) {
                    return [2 /*return*/, { success: false, canceled: true }];
                }
                success = assetManager.export(assetId, filePath);
                return [2 /*return*/, { success: success, filePath: filePath }];
        }
    });
}); });
electron_1.ipcMain.handle("assets:resolvePath", function (_e, assetId) {
    if (!assetManager)
        return null;
    return assetManager.resolvePath(assetId);
});
electron_1.ipcMain.handle("assets:upload", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, filePaths, canceled, results, _i, filePaths_1, fp, meta, e_11;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!assetManager)
                    throw new Error("Asset manager not initialized");
                return [4 /*yield*/, electron_1.dialog.showOpenDialog(mainWindow, {
                        title: "Upload Asset",
                        properties: ['openFile', 'multiSelections'],
                        filters: [
                            { name: 'Supported Files', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'txt', 'csv', 'json', 'xml', 'html', 'md', 'yaml', 'yml', 'log', 'wav', 'mp3'] },
                            { name: 'All Files', extensions: ['*'] },
                        ],
                    })];
            case 1:
                _a = _b.sent(), filePaths = _a.filePaths, canceled = _a.canceled;
                if (canceled || !filePaths || filePaths.length === 0) {
                    return [2 /*return*/, { success: false, canceled: true, assets: [] }];
                }
                results = [];
                _i = 0, filePaths_1 = filePaths;
                _b.label = 2;
            case 2:
                if (!(_i < filePaths_1.length)) return [3 /*break*/, 7];
                fp = filePaths_1[_i];
                _b.label = 3;
            case 3:
                _b.trys.push([3, 5, , 6]);
                return [4 /*yield*/, assetManager.ingest(fp)];
            case 4:
                meta = _b.sent();
                results.push({ success: true, metadata: meta });
                return [3 /*break*/, 6];
            case 5:
                e_11 = _b.sent();
                results.push({ success: false, filename: path_1.default.basename(fp), error: e_11.message });
                return [3 /*break*/, 6];
            case 6:
                _i++;
                return [3 /*break*/, 2];
            case 7: return [2 /*return*/, { success: true, assets: results }];
        }
    });
}); });
// ============================================================================
// V2: SESSION LOG PERSISTENCE IPC
// ============================================================================
electron_1.ipcMain.handle("logs:getSessionLog", function () {
    return {
        runs: runManager.getAllRuns(),
        doctorReports: getDoctorEngine().getReportHistory(),
        sessionId: (assetManager === null || assetManager === void 0 ? void 0 : assetManager.getSessionId()) || 'unknown',
        timestamp: new Date().toISOString(),
    };
});
electron_1.ipcMain.handle("logs:exportSessionLog", function () { return __awaiter(void 0, void 0, void 0, function () {
    var log, _a, filePath, canceled;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                log = {
                    runs: runManager.getAllRuns(),
                    doctorReports: getDoctorEngine().getReportHistory(),
                    sessionId: (assetManager === null || assetManager === void 0 ? void 0 : assetManager.getSessionId()) || 'unknown',
                    exportedAt: new Date().toISOString(),
                    platform: "".concat(process.platform, " ").concat(process.arch),
                    version: electron_1.app.getVersion(),
                };
                return [4 /*yield*/, electron_1.dialog.showSaveDialog(mainWindow, {
                        title: "Export Session Log",
                        defaultPath: "workbench-session-".concat(new Date().toISOString().split("T")[0], ".json"),
                        filters: [{ name: "JSON Files", extensions: ["json"] }],
                    })];
            case 1:
                _a = _b.sent(), filePath = _a.filePath, canceled = _a.canceled;
                if (canceled || !filePath)
                    return [2 /*return*/, { success: false, canceled: true }];
                fs_1.default.writeFileSync(filePath, JSON.stringify(log, null, 2), "utf-8");
                return [2 /*return*/, { success: true, filePath: filePath }];
        }
    });
}); });
// ============================================================================
// SECRETS MANAGER IPC HANDLERS
// ============================================================================
// Check if secure storage is available
electron_1.ipcMain.handle("secrets:isAvailable", function () {
    return {
        available: secretsManager.isSecureStorageAvailable(),
        backend: secretsManager.getStorageBackend(),
    };
});
// Store a new secret
electron_1.ipcMain.handle("secrets:store", function (_e, name, value, type, tags) { return __awaiter(void 0, void 0, void 0, function () {
    var handle, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, secretsManager.storeSecret(name, value, type, tags)];
            case 1:
                handle = _a.sent();
                return [2 /*return*/, { success: true, handle: handle }];
            case 2:
                error_3 = _a.sent();
                return [2 /*return*/, { success: false, error: error_3.message }];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Get secret value (requires explicit user action)
electron_1.ipcMain.handle("secrets:get", function (_e, secretId) { return __awaiter(void 0, void 0, void 0, function () {
    var secret, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, secretsManager.getSecret(secretId)];
            case 1:
                secret = _a.sent();
                return [2 /*return*/, { success: true, secret: secret }];
            case 2:
                error_4 = _a.sent();
                return [2 /*return*/, { success: false, error: error_4.message }];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Delete secret
electron_1.ipcMain.handle("secrets:delete", function (_e, secretId) { return __awaiter(void 0, void 0, void 0, function () {
    var success;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, secretsManager.deleteSecret(secretId)];
            case 1:
                success = _a.sent();
                return [2 /*return*/, { success: success }];
        }
    });
}); });
// List all secrets (metadata only)
electron_1.ipcMain.handle("secrets:list", function () {
    return secretsManager.listSecrets();
});
// Update secret metadata
electron_1.ipcMain.handle("secrets:updateMetadata", function (_e, secretId, updates) {
    var success = secretsManager.updateSecretMetadata(secretId, updates);
    return { success: success };
});
// Find secrets by tool
electron_1.ipcMain.handle("secrets:findByTool", function (_e, toolName) {
    return secretsManager.findSecretsByTool(toolName);
});
// Redact secrets from text/object
electron_1.ipcMain.handle("secrets:redact", function (_e, data) {
    if (typeof data === 'string') {
        return secretsManager.redactSecrets(data);
    }
    else {
        return secretsManager.redactSecretsFromObject(data);
    }
});
// ============================================================================
// TOOL MANIFEST IPC HANDLERS
// ============================================================================
// Register tool manifest
electron_1.ipcMain.handle("manifest:register", function (_e, manifest) {
    return manifestRegistry.register(manifest);
});
// Get tool manifest
electron_1.ipcMain.handle("manifest:get", function (_e, toolName) {
    return manifestRegistry.get(toolName);
});
// List all manifests
electron_1.ipcMain.handle("manifest:list", function () {
    return manifestRegistry.list();
});
// Check tool compatibility
electron_1.ipcMain.handle("manifest:checkCompatibility", function (_e, toolName) {
    return manifestRegistry.checkCompatibility(toolName);
});
// Get tool info for display
electron_1.ipcMain.handle("manifest:getToolInfo", function (_e, toolName) {
    return manifestRegistry.getToolInfo(toolName);
});
// Find tools by tag
electron_1.ipcMain.handle("manifest:findByTag", function (_e, tag) {
    return manifestRegistry.findByTag(tag);
});
// Find tools by stability
electron_1.ipcMain.handle("manifest:findByStability", function (_e, stability) {
    return manifestRegistry.findByStability(stability);
});
// ============================================================================
// PREVIEW / DRY-RUN IPC HANDLERS
// ============================================================================
// Get preview history
electron_1.ipcMain.handle("preview:getHistory", function (_e, limit) {
    return previewManager.getHistory(limit);
});
// Approve preview
electron_1.ipcMain.handle("preview:approve", function (_e, index) {
    return previewManager.approvePreview(index);
});
// Get specific preview
electron_1.ipcMain.handle("preview:get", function (_e, index) {
    return previewManager.getPreview(index);
});
// Format preview for display
electron_1.ipcMain.handle("preview:format", function (_e, preview) {
    return previewManager.formatPreview(preview);
});
// Clear preview history
electron_1.ipcMain.handle("preview:clear", function () {
    previewManager.clearHistory();
    return { success: true };
});
// ============================================================================
// USER MEMORY IPC HANDLERS
// ============================================================================
// Remember something
electron_1.ipcMain.handle("memory:remember", function (_e, category, key, value, options) {
    var memory = memoryManager.remember(category, key, value, options);
    return { success: true, memory: memory };
});
// Recall something
electron_1.ipcMain.handle("memory:recall", function (_e, category, key) {
    var memory = memoryManager.recall(category, key);
    return memory;
});
// Forget something
electron_1.ipcMain.handle("memory:forget", function (_e, memoryId) {
    var success = memoryManager.forget(memoryId);
    return { success: success };
});
// Forget all
electron_1.ipcMain.handle("memory:forgetAll", function () {
    memoryManager.forgetAll();
    return { success: true };
});
// Update memory
electron_1.ipcMain.handle("memory:update", function (_e, memoryId, updates) {
    var success = memoryManager.update(memoryId, updates);
    return { success: success };
});
// List all memories
electron_1.ipcMain.handle("memory:listAll", function () {
    return memoryManager.listAll();
});
// List by category
electron_1.ipcMain.handle("memory:listByCategory", function (_e, category) {
    return memoryManager.listByCategory(category);
});
// Search memories
electron_1.ipcMain.handle("memory:search", function (_e, query) {
    return memoryManager.search(query);
});
// Get most used
electron_1.ipcMain.handle("memory:getMostUsed", function (_e, limit) {
    return memoryManager.getMostUsed(limit);
});
// Get recently used
electron_1.ipcMain.handle("memory:getRecentlyUsed", function (_e, limit) {
    return memoryManager.getRecentlyUsed(limit);
});
// Get statistics
electron_1.ipcMain.handle("memory:getStats", function () {
    return memoryManager.getStats();
});
// Enable/disable memory system
electron_1.ipcMain.handle("memory:setEnabled", function (_e, enabled) {
    memoryManager.setEnabled(enabled);
    return { success: true };
});
// Check if enabled
electron_1.ipcMain.handle("memory:isEnabled", function () {
    return memoryManager.isEnabled();
});
// Convenience: Remember preference
electron_1.ipcMain.handle("memory:rememberPreference", function (_e, key, value) {
    var memory = memoryManager.rememberPreference(key, value);
    return { success: true, memory: memory };
});
// Convenience: Recall preference
electron_1.ipcMain.handle("memory:recallPreference", function (_e, key) {
    return memoryManager.recallPreference(key);
});
// ============================================================================
// TOOL DISPATCH IPC HANDLERS
// ============================================================================
// Create dispatch plan from natural language
electron_1.ipcMain.handle("dispatch:createPlan", function (_e, query, context) { return __awaiter(void 0, void 0, void 0, function () {
    var availableManifests, plan;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                availableManifests = manifestRegistry.list();
                return [4 /*yield*/, toolDispatcher.createDispatchPlan(query, availableManifests, context)];
            case 1:
                plan = _a.sent();
                return [2 /*return*/, plan];
        }
    });
}); });
// Suggest relevant tools
electron_1.ipcMain.handle("dispatch:suggest", function (_e, context, limit) {
    var availableManifests = manifestRegistry.list();
    return toolDispatcher.suggestTools(context, availableManifests, limit);
});
// Format dispatch plan for confirmation
electron_1.ipcMain.handle("dispatch:formatPlan", function (_e, plan) {
    return toolDispatcher.formatPlanForConfirmation(plan);
});
// ============================================================================
// V3 TOOL SELECTION INTELLIGENCE IPC HANDLERS
// ============================================================================
// V3: Rank all tools by relevance to a query
electron_1.ipcMain.handle("dispatch:rankTools", function (_e, query) {
    var availableManifests = manifestRegistry.list();
    return toolDispatcher.rankTools(query, availableManifests);
});
// V3: Record tool usage for adaptive scoring
electron_1.ipcMain.handle("dispatch:recordUsage", function (_e, toolName, query, success) {
    if (!isFeatureEnabled("V3_USAGE_TRACKING"))
        return;
    toolDispatcher.recordToolUsage(toolName, query, success);
    // Persist usage data
    store.set("toolUsageData", toolDispatcher.getUsageData());
});
// V3: Get tool usage data
electron_1.ipcMain.handle("dispatch:getUsageData", function () {
    return toolDispatcher.getUsageData();
});
// V3: Disambiguate between tool candidates
electron_1.ipcMain.handle("dispatch:disambiguate", function (_e, query) {
    if (!isFeatureEnabled("V3_DISAMBIGUATION"))
        return null;
    var availableManifests = manifestRegistry.list();
    var candidates = toolDispatcher.rankTools(query, availableManifests).slice(0, 5);
    return toolDispatcher.disambiguate(query, candidates);
});
// V3: Resolve disambiguation by user choice
electron_1.ipcMain.handle("dispatch:resolveDisambiguation", function (_e, disambiguation, selectedIndex) {
    return toolDispatcher.resolveDisambiguation(disambiguation, selectedIndex);
});
// V3: Build a simple rule-based chain plan
electron_1.ipcMain.handle("dispatch:buildChain", function (_e, query) {
    if (!isFeatureEnabled("V3_CHAIN_PLANNING"))
        return null;
    return toolDispatcher.buildSimpleChain(query, tools);
});
// V3: Parse chain plan from LLM response
electron_1.ipcMain.handle("dispatch:parseChain", function (_e, llmResponse) {
    if (!isFeatureEnabled("V3_CHAIN_PLANNING"))
        return null;
    return toolDispatcher.parseChainPlan(llmResponse, tools);
});
// V3: Validate a chain plan
electron_1.ipcMain.handle("dispatch:validateChain", function (_e, plan) {
    return toolDispatcher.validateChain(plan, tools);
});
// V3: Format chain plan for display
electron_1.ipcMain.handle("dispatch:formatChain", function (_e, plan) {
    return toolDispatcher.formatChainPlan(plan);
});
// V3: Get/update dispatch config
electron_1.ipcMain.handle("dispatch:getConfig", function () {
    return toolDispatcher.getConfig();
});
electron_1.ipcMain.handle("dispatch:updateConfig", function (_e, updates) {
    toolDispatcher.updateConfig(updates);
    return toolDispatcher.getConfig();
});
// ============================================================================
// ENVIRONMENT DETECTION IPC HANDLERS
// ============================================================================
// Get environment info
electron_1.ipcMain.handle("environment:getInfo", function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, environmentDetector.getEnvironmentInfo()];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); });
// Format environment info
electron_1.ipcMain.handle("environment:format", function (_e, info) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, environmentDetector.formatEnvironmentInfo(info)];
    });
}); });
// Get unsupported message
electron_1.ipcMain.handle("environment:getUnsupportedMessage", function (_e, info) {
    return environmentDetector.getUnsupportedMessage(info);
});
// Get lockdown warning
electron_1.ipcMain.handle("environment:getLockdownWarning", function (_e, info) {
    return environmentDetector.getLockdownWarning(info);
});
// Check environment on startup
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var envInfo;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, environmentDetector.getEnvironmentInfo()];
            case 1:
                envInfo = _a.sent();
                console.log('[Environment] Platform:', envInfo.platform, 'Arch:', envInfo.arch);
                console.log('[Environment] Supported:', envInfo.supported);
                if (envInfo.risks.length > 0) {
                    console.log('[Environment] Risks detected:');
                    envInfo.risks.forEach(function (risk) {
                        console.log("  [".concat(risk.level.toUpperCase(), "] ").concat(risk.category, ": ").concat(risk.message));
                    });
                }
                if (!envInfo.supported) {
                    console.warn('[Environment] Running on unsupported platform!');
                }
                return [2 /*return*/];
        }
    });
}); })();
// Clear interrupted runs
electron_1.ipcMain.handle("runs:clearInterrupted", function () {
    runManager.clearInterruptedRuns();
    return { success: true };
});
// Check if there are interrupted runs
electron_1.ipcMain.handle("runs:hasInterrupted", function () {
    return runManager.hasInterruptedRuns();
});
