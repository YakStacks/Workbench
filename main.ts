// Electron main process - Enhanced with streaming, file system, clipboard, tool chaining, MCP
import {
  app,
  BrowserWindow,
  ipcMain,
  clipboard,
  Tray,
  Menu,
  nativeImage,
  dialog,
} from "electron";
import path from "path";
import util from "util";
import fs from "fs";
import net from "net";
import { spawn, ChildProcess } from "child_process";
import Store from "electron-store";
import axios from "axios";
import { DoctorEngine, DoctorReport } from "./doctor";
import { PermissionManager, ToolPermissions, PermissionCategory, PermissionAction } from "./permissions";
import { RunManager } from "./run-manager";
import { ProcessRegistry } from "./process-registry";
import { SecretsManager } from "./secrets-manager";
import { ToolManifestRegistry, ToolManifest } from "./tool-manifest";
import { PreviewManager, PreviewBuilder } from "./dry-run";
import { MemoryManager } from "./memory-manager";
import { ToolDispatcher } from "./tool-dispatch";
import { EnvironmentDetector } from "./environment-detection";

const store = new Store();
const permissionManager = new PermissionManager(store);
const runManager = new RunManager(store);
const processRegistry = new ProcessRegistry();
const secretsManager = new SecretsManager(store);
const manifestRegistry = new ToolManifestRegistry();
const previewManager = new PreviewManager();
const memoryManager = new MemoryManager(store);
const toolDispatcher = new ToolDispatcher(permissionManager, previewManager);
const environmentDetector = new EnvironmentDetector();
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let plugins: any[] = [];
let tools: Map<string, any> = new Map();

// Add isQuitting flag to app
let isQuitting = false;

type FeatureFlagKey =
  | "L_TOOL_HEALTH_SIGNALS"
  | "M_SMART_AUTO_DIAGNOSTICS"
  | "N_PERMISSION_PROFILES"
  | "N_RUN_TIMELINE"
  | "N_EXPORT_RUN_BUNDLE";

type FeatureFlags = Record<FeatureFlagKey, boolean>;

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  L_TOOL_HEALTH_SIGNALS: false,
  M_SMART_AUTO_DIAGNOSTICS: false,
  N_PERMISSION_PROFILES: false,
  N_RUN_TIMELINE: false,
  N_EXPORT_RUN_BUNDLE: false,
};

function getFeatureFlags(): FeatureFlags {
  const stored = (store.get("featureFlags") as Partial<FeatureFlags>) || {};
  return { ...DEFAULT_FEATURE_FLAGS, ...stored };
}

function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return Boolean(getFeatureFlags()[flag]);
}

// Standard tool response format
interface ToolResponse {
  content: string | Array<{ type: string; text: string }>;
  metadata?: Record<string, any>;
  error?: string;
}

// Normalize tool output to standard format
function normalizeToolOutput(output: any): ToolResponse {
  // Already in correct format
  if (output && typeof output === "object" && "content" in output) {
    return output as ToolResponse;
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

// MCP Server connections
interface MCPServer {
  name: string;
  command: string;
  args: string[];
  process?: ChildProcess;
  tools: any[];
  status: "disconnected" | "connecting" | "connected" | "error";
}
let mcpServers: Map<string, MCPServer> = new Map();

function createWindow() {
  let iconPath: string;
  if (app.isPackaged) {
    // For Windows, use .ico file
    iconPath = path.join(process.resourcesPath, "icon.ico");
  } else {
    iconPath = path.join(app.getAppPath(), "icon.ico");
  }

  // Fallback if icon not found
  if (!fs.existsSync(iconPath)) {
    console.log("[createWindow] Icon not found at:", iconPath);
    iconPath = "";
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    ...(iconPath && { icon: iconPath }),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  
  // Set window for RunManager
  runManager.setWindow(mainWindow);
  // Always load from dist folder - use `npm run dev` for hot reload
  mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));

  // Minimize to tray instead of closing
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  let iconPath: string;
  if (app.isPackaged) {
    // Use the same icon.ico that's embedded in the exe
    iconPath = path.join(process.resourcesPath, "icon.ico");
  } else {
    iconPath = path.join(app.getAppPath(), "build", "icon.png");
  }

  console.log("[createTray] Looking for icon at:", iconPath);

  if (!fs.existsSync(iconPath)) {
    console.log("[createTray] Icon not found, skipping tray");
    return; // Don't create tray if icon missing
  }

  // Create native image from icon
  const icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) {
    console.log("[createTray] Icon is empty, skipping tray");
    return;
  }

  console.log("[createTray] Icon size:", icon.getSize());
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Workbench",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Workbench");
  tray.setContextMenu(contextMenu);

  // Double-click to show window
  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  loadPlugins();
  registerBuiltinTools();
  loadMCPServers();
});

app.on("window-all-closed", () => {
  // Cleanup MCP servers
  mcpServers.forEach((server) => {
    if (server.process) {
      server.process.kill();
    }
  });
  if (process.platform !== "darwin") app.quit();
});

// Cleanup processes before quit
app.on('before-quit', async (event) => {
  if (!isQuitting) {
    console.log('[app] Starting cleanup before quit...');
    event.preventDefault();
    isQuitting = true;
    
    // Kill all child processes
    await processRegistry.gracefulShutdown(5000);
    
    // Disconnect MCP clients
    mcpClients.forEach(client => {
      try {
        client.disconnect();
      } catch (error) {
        console.error('[app] Error disconnecting MCP client:', error);
      }
    });
    
    console.log('[app] Cleanup complete, quitting...');
    app.quit();
  }
});

// ============================================================================
// PLUGIN SYSTEM
// ============================================================================

function loadPlugins() {
  plugins = [];
  // Keep builtin tools, clear plugin tools
  const builtinTools = new Map<string, any>();
  tools.forEach((tool, name) => {
    if (name.startsWith("builtin.") || name.startsWith("mcp.")) {
      builtinTools.set(name, tool);
    }
  });
  tools = builtinTools;

  const pluginsDir =
    (store.get("pluginsDir") as string) || path.join(__dirname, "plugins");
  console.log("[loadPlugins] Looking for plugins in:", pluginsDir);
  if (
    !pluginsDir ||
    typeof pluginsDir !== "string" ||
    !fs.existsSync(pluginsDir)
  ) {
    console.log("[loadPlugins] Plugins directory not found");
    return;
  }
  const folders = fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  console.log("[loadPlugins] Found folders:", folders);
  folders.forEach((folder) => {
    const pluginPath = path.join(pluginsDir, folder, "index.js");
    if (fs.existsSync(pluginPath)) {
      try {
        // Clear require cache for hot reload
        delete require.cache[require.resolve(pluginPath)];
        const plugin = require(pluginPath);
        if (plugin && typeof plugin.register === "function") {
          plugin.register({
            registerTool: (tool: any) => {
              // Store source folder for delete functionality
              tool._sourceFolder = folder;
              tool._sourcePath = pluginPath;
              console.log(
                "[loadPlugins] Registered tool:",
                tool.name,
                "from folder:",
                folder,
              );
              tools.set(tool.name, tool);

              // Ensure every tool has explicit permission metadata
              permissionManager.registerToolPermissions(
                tool.name,
                tool.permissions || {},
              );
            },
            getPluginsDir: () => pluginsDir,
            reloadPlugins: () => loadPlugins(),
          });
        }
      } catch (e) {
        console.error("[loadPlugins] Error loading plugin:", folder, e);
      }
    }
  });
}

// ============================================================================
// BUILTIN TOOLS - File System, Clipboard, Shell
// ============================================================================

function registerBuiltinTools() {
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
    run: async (input: { path: string; encoding?: string }) => {
      const safePath = resolveSafePath(input.path);
      assertPathSafe(safePath);
      const content = fs.readFileSync(safePath, {
        encoding: (input.encoding || "utf-8") as BufferEncoding,
      });
    return { content, path: safePath, size: content.length };
    },
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
    run: async (input: { path: string; content: string; append?: boolean }) => {
      const safePath = resolveSafePath(input.path);
      assertPathSafe(safePath);
      const dir = path.dirname(safePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (input.append) {
        fs.appendFileSync(safePath, input.content, "utf-8");
      } else {
        fs.writeFileSync(safePath, input.content, "utf-8");
      }
      return {
        success: true,
        path: safePath,
        bytesWritten: input.content.length,
      };
    },
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
    run: async (input: { path: string; recursive?: boolean }) => {
      const safePath = resolveSafePath(input.path);
      assertPathSafe(safePath);
      const entries = listDirRecursive(
        safePath,
        input.recursive || false,
        0,
        3,
      );
    return { path: safePath, entries };
    },
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
    run: async (input: { path: string }) => {
      const safePath = resolveSafePath(input.path);
      const exists = fs.existsSync(safePath);
      let isFile = false,
        isDir = false;
      if (exists) {
        const stat = fs.statSync(safePath);
        isFile = stat.isFile();
        isDir = stat.isDirectory();
      }
      return { exists, isFile, isDirectory: isDir, path: safePath };
    },
  });

  // Clipboard Tools
  tools.set("builtin.clipboardRead", {
    name: "builtin.clipboardRead",
    description: "Read text from system clipboard",
    inputSchema: { type: "object", properties: {} },
    run: async () => {
      const text = clipboard.readText();
      return { content: text, length: text.length };
    },
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
    run: async (input: { content: string }) => {
      clipboard.writeText(input.content);
      return { success: true, length: input.content.length };
    },
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
    run: async (input: { command: string; cwd?: string; timeout?: number }) => {
      return new Promise((resolve) => {
        const cwd = input.cwd ? resolveSafePath(input.cwd) : process.cwd();
        const isWindows = process.platform === "win32";
        const shell = isWindows ? "cmd.exe" : "/bin/sh";
        const shellArg = isWindows ? "/c" : "-c";
        const runId = (input as any).__runId as string | undefined;

        const proc = spawn(shell, [shellArg, input.command], {
          cwd,
          timeout: input.timeout || 30000,
          env: process.env,
        });
        processRegistry.register(proc, {
          runId,
          toolName: "builtin.shell",
          command: input.command,
          type: "tool",
        });
        if (runId && proc.pid) {
          runManager.setProcessId(runId, proc.pid);
        }

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data) => {
          stdout += data.toString();
          if (proc.pid) processRegistry.recordActivity(proc.pid);
        });
        proc.stderr?.on("data", (data) => {
          stderr += data.toString();
          if (proc.pid) processRegistry.recordActivity(proc.pid);
        });

        proc.on("close", (code) => {
          resolve({ exitCode: code, stdout, stderr, command: input.command });
        });

        proc.on("error", (err) => {
          resolve({
            exitCode: -1,
            stdout,
            stderr,
            error: err.message,
            command: input.command,
          });
        });
      });
    },
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
    run: async () => {
      const os = require("os");
      return {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        cpus: os
          .cpus()
          .map((cpu: any) => ({ model: cpu.model, speed: cpu.speed })),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        usedMemory: os.totalmem() - os.freemem(),
        memoryUsagePercent: (
          ((os.totalmem() - os.freemem()) / os.totalmem()) *
          100
        ).toFixed(1),
        homeDir: os.homedir(),
        tempDir: os.tmpdir(),
        userInfo: os.userInfo(),
      };
    },
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
    run: async (input: { limit?: number; __runId?: string }) => {
      return new Promise((resolve) => {
        const limit = input.limit || 20;
        const isWindows = process.platform === "win32";
        const cmd = isWindows ? "tasklist" : "ps aux";

        const proc = spawn(
          isWindows ? "cmd.exe" : "/bin/sh",
          [isWindows ? "/c" : "-c", cmd],
          {
            timeout: 10000,
          },
        );
        processRegistry.register(proc, {
          runId: input.__runId,
          toolName: "builtin.processes",
          command: cmd,
          type: "tool",
        });
        if (input.__runId && proc.pid) {
          runManager.setProcessId(input.__runId, proc.pid);
        }

        let output = "";
        proc.stdout?.on("data", (data) => {
          output += data.toString();
        });
        proc.on("close", () => {
          const lines = output.trim().split("\n");
          resolve({
            count: lines.length - 1,
            processes: lines.slice(1, limit + 1),
            raw: lines.slice(0, limit + 1).join("\n"),
          });
        });
        proc.on("error", (err) => {
          resolve({ error: err.message });
        });
      });
    },
  });

  tools.set("builtin.diskSpace", {
    name: "builtin.diskSpace",
    description: "Check disk space usage",
    inputSchema: { type: "object", properties: {} },
    run: async (input: { __runId?: string } = {}) => {
      return new Promise((resolve) => {
        const isWindows = process.platform === "win32";
        const cmd = isWindows
          ? "wmic logicaldisk get size,freespace,caption"
          : "df -h";

        const proc = spawn(
          isWindows ? "cmd.exe" : "/bin/sh",
          [isWindows ? "/c" : "-c", cmd],
          {
            timeout: 10000,
          },
        );
        processRegistry.register(proc, {
          runId: input.__runId,
          toolName: "builtin.diskSpace",
          command: cmd,
          type: "tool",
        });
        if (input.__runId && proc.pid) {
          runManager.setProcessId(input.__runId, proc.pid);
        }

        let output = "";
        proc.stdout?.on("data", (data) => {
          output += data.toString();
        });
        proc.on("close", () => {
          resolve({ raw: output.trim() });
        });
        proc.on("error", (err) => {
          resolve({ error: err.message });
        });
      });
    },
  });

  tools.set("builtin.networkInfo", {
    name: "builtin.networkInfo",
    description: "Get network interface information",
    inputSchema: { type: "object", properties: {} },
    run: async () => {
      const os = require("os");
      const interfaces = os.networkInterfaces();
      const result: any = {};
      for (const [name, addrs] of Object.entries(interfaces)) {
        result[name] = (addrs as any[]).map((addr) => ({
          address: addr.address,
          family: addr.family,
          internal: addr.internal,
          mac: addr.mac,
        }));
      }
      return result;
    },
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
    run: async (input: { filter?: string }) => {
      const env = process.env;
      const safeKeys = Object.keys(env).filter((key) => {
        // Filter out sensitive-looking keys
        const lower = key.toLowerCase();
        if (
          lower.includes("key") ||
          lower.includes("secret") ||
          lower.includes("password") ||
          lower.includes("token") ||
          lower.includes("credential")
        ) {
          return false;
        }
        if (input.filter) {
          return lower.includes(input.filter.toLowerCase());
        }
        return true;
      });

      const result: Record<string, string> = {};
      safeKeys.forEach((key) => {
        result[key] = env[key] || "";
      });
      return { count: safeKeys.length, variables: result };
    },
  });

  tools.set("builtin.installedApps", {
    name: "builtin.installedApps",
    description: "List installed applications (Windows only)",
    inputSchema: { type: "object", properties: {} },
    run: async (input: { __runId?: string } = {}) => {
      if (process.platform !== "win32") {
        return { error: "This tool only works on Windows" };
      }
      return new Promise((resolve) => {
        const cmd = "wmic product get name,version";
        const proc = spawn("cmd.exe", ["/c", cmd], { timeout: 30000 });
        processRegistry.register(proc, {
          runId: input.__runId,
          toolName: "builtin.installedApps",
          command: cmd,
          type: "tool",
        });
        if (input.__runId && proc.pid) {
          runManager.setProcessId(input.__runId, proc.pid);
        }

        let output = "";
        proc.stdout?.on("data", (data) => {
          output += data.toString();
        });
        proc.on("close", () => {
          const lines = output
            .trim()
            .split("\n")
            .slice(1)
            .filter((l) => l.trim());
          resolve({
            count: lines.length,
            apps: lines.slice(0, 50).map((l) => l.trim()),
          });
        });
        proc.on("error", (err) => {
          resolve({ error: err.message });
        });
      });
    },
  });

  // Ensure builtin tools always have declared permission metadata.
  tools.forEach((_tool, toolName) => {
    if (
      toolName.startsWith("builtin.") &&
      !permissionManager.getToolPermissions(toolName)
    ) {
      permissionManager.registerToolPermissions(toolName, {});
    }
  });
}

function resolveSafePath(inputPath: string): string {
  const normalized = inputPath.trim();
  // Allow absolute paths or resolve relative to user's home
  if (path.isAbsolute(normalized)) {
    return path.resolve(normalized);
  }
  const workingDir = (store.get("workingDir") as string) || app.getPath("home");
  return path.resolve(workingDir, normalized);
}

function normalizePathForComparison(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  const normalized = path.normalize(resolved);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isPathWithinRoot(targetPath: string, rootPath: string): boolean {
  const target = normalizePathForComparison(targetPath);
  const root = normalizePathForComparison(rootPath);
  if (target === root) return true;
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return target.startsWith(rootWithSep);
}

function isPathSafe(targetPath: string): boolean {
  const safePaths = (store.get("safePaths") as string[]) || [];
  const workingDir = store.get("workingDir") as string;
  const resolvedTarget = path.resolve(targetPath);

  // If no safe paths configured, allow workingDir and home
  if (safePaths.length === 0) {
    const allowedRoots = [workingDir, app.getPath("home"), process.cwd()].filter(Boolean);
    return allowedRoots.some((root) => isPathWithinRoot(resolvedTarget, root));
  }

  // Check if path is within any safe path
  return safePaths.some((safePath) => {
    return isPathWithinRoot(resolvedTarget, safePath);
  });
}

function assertPathSafe(targetPath: string): void {
  if (!isPathSafe(targetPath)) {
    throw new Error(
      `Access denied: ${targetPath} is outside allowed directories`,
    );
  }
}

function listDirRecursive(
  dirPath: string,
  recursive: boolean,
  depth: number,
  maxDepth: number,
): any[] {
  if (depth > maxDepth) return [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map((entry) => {
      const entryPath = path.join(dirPath, entry.name);
      const result: any = {
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
      };
      if (entry.isFile()) {
        result.size = fs.statSync(entryPath).size;
      }
      if (entry.isDirectory() && recursive && depth < maxDepth) {
        result.children = listDirRecursive(
          entryPath,
          recursive,
          depth + 1,
          maxDepth,
        );
      }
      return result;
    });
  } catch (e: any) {
    return [{ error: e.message }];
  }
}

// ============================================================================
// MCP CLIENT SUPPORT
// ============================================================================

interface MCPMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

class MCPClient {
  private process: ChildProcess | null = null;
  private messageId = 0;
  private pendingRequests: Map<
    number,
    { resolve: Function; reject: Function }
  > = new Map();
  private buffer = "";
  public tools: any[] = [];
  public status: "disconnected" | "connecting" | "connected" | "error" =
    "disconnected";

  constructor(
    public name: string,
    public command: string,
    public args: string[] = [],
  ) {}

  async connect(): Promise<void> {
    // Wrap connection in timeout
    return Promise.race([
      this._doConnect(),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection timeout after 30 seconds")),
          30000,
        ),
      ),
    ]);
  }

  private async _doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.status = "connecting";

      try {
        console.log(
          `[MCP ${this.name}] Spawning process: ${this.command} ${this.args.join(" ")}`,
        );

        // Create environment for clean Node.js execution
        const cleanEnv = { ...process.env };
        delete cleanEnv.NODE_CHANNEL_FD; // Remove Electron IPC channel
        // Add ELECTRON_RUN_AS_NODE to make spawned process behave like plain Node
        cleanEnv.ELECTRON_RUN_AS_NODE = "1";
        // Ensure unbuffered stdio
        cleanEnv.NODE_NO_READLINE = "1";
        cleanEnv.PYTHONUNBUFFERED = "1";

        // On Windows, use process.execPath (Electron as Node) or explicit node command
        const isWindows = process.platform === "win32";
        let command = this.command;
        let args = this.args;

        if (isWindows && this.command === "npx") {
          // Extract package name and resolve to actual JS entry point
          const packageArg = args.find((arg) =>
            arg.startsWith("@modelcontextprotocol/"),
          );
          if (packageArg) {
            // Build the direct path to the server's dist/index.js
            const modulePath = path.join(
              __dirname,
              "node_modules",
              packageArg,
              "dist",
              "index.js",
            );

            if (fs.existsSync(modulePath)) {
              // Use plain 'node' command from PATH, not Electron's process
              command = "node";
              args = [modulePath];
              console.log(
                `[MCP ${this.name}] Spawning system Node.js: node ${modulePath}`,
              );
            } else {
              // Fallback: try .bin wrapper
              const serverName = packageArg.replace(
                "@modelcontextprotocol/",
                "mcp-",
              );
              const binPath = path.join(
                __dirname,
                "node_modules",
                ".bin",
                `${serverName}.cmd`,
              );

              if (fs.existsSync(binPath)) {
                command = binPath;
                args = args.filter((arg) => arg !== "-y" && arg !== packageArg);
                console.log(
                  `[MCP ${this.name}] Using local .bin wrapper: ${binPath}`,
                );
              } else {
                // Last resort: npx.cmd
                command = "npx.cmd";
                console.log(
                  `[MCP ${this.name}] Module not found, using npx.cmd`,
                );
              }
            }
          } else {
            command = "npx.cmd";
          }
        }

        this.process = spawn(command, args, {
          stdio: ["pipe", "pipe", "pipe"],
          env: cleanEnv,
          shell: false,
          detached: false, // Keep process attached
        });
        if (this.process?.pid) {
          processRegistry.register(this.process, {
            toolName: this.name,
            command: `${command} ${args.join(" ")}`.trim(),
            type: "mcp",
          });
        }

        // Prevent stdin from auto-closing
        if (this.process.stdin) {
          this.process.stdin.on("error", (err) => {
            console.error(`[MCP ${this.name}] stdin error:`, err);
          });
        }

        // Set encoding and ensure stdout is readable
        if (this.process.stdout) {
          this.process.stdout.setEncoding("utf8");
          this.process.stdout.on("data", (data) => {
            console.log(
              `[MCP ${this.name}] 📥 STDOUT DATA RECEIVED (${data.length} chars):`,
              data.substring(0, 200),
            );
            console.log(
              `[MCP ${this.name}] 📥 Hex dump:`,
              Buffer.from(data).toString("hex").substring(0, 200),
            );
            this.handleData(data.toString());
          });
          this.process.stdout.on("readable", () => {
            console.log(`[MCP ${this.name}] stdout is readable`);
          });
          this.process.stdout.on("end", () => {
            console.log(`[MCP ${this.name}] stdout ended`);
          });
        }

        if (this.process.stderr) {
          this.process.stderr.setEncoding("utf8");
          this.process.stderr.on("data", (data) => {
            console.error(`[MCP ${this.name}] stderr:`, data.toString());
          });
        }

        this.process.on("error", (err) => {
          console.error(`[MCP ${this.name}] process error:`, err);
          this.status = "error";
          reject(new Error(`Failed to start MCP server: ${err.message}`));
        });

        this.process.on("exit", (code, signal) => {
          console.log(
            `[MCP ${this.name}] process exited with code: ${code}, signal: ${signal}`,
          );
        });

        this.process.on("close", (code, signal) => {
          console.log(
            `[MCP ${this.name}] process closed with code: ${code}, signal: ${signal}`,
          );
          if (this.status === "connecting") {
            reject(
              new Error(
                `MCP server exited during connection (code ${code}, signal ${signal})`,
              ),
            );
          }
          this.status = "disconnected";
        });

        // Initialize the connection
        setTimeout(async () => {
          try {
            console.log(`[MCP ${this.name}] Initializing...`);
            await this.initialize();
            console.log(`[MCP ${this.name}] Loading tools...`);
            await this.loadTools();
            console.log(
              `[MCP ${this.name}] Connected successfully with ${this.tools.length} tools`,
            );
            this.status = "connected";
            resolve();
          } catch (e: any) {
            console.error(
              `[MCP ${this.name}] Initialization failed:`,
              e.message,
            );
            this.status = "error";
            reject(new Error(`Initialization failed: ${e.message}`));
          }
        }, 500);
      } catch (e: any) {
        this.status = "error";
        reject(new Error(`Connection setup failed: ${e.message}`));
      }
    });
  }

  private handleData(data: string) {
    this.buffer += data;
    console.log(
      `[MCP ${this.name}] Received data (${data.length} bytes):`,
      data.substring(0, 200),
    );

    // Try to process messages - handle both Content-Length framing and line-delimited JSON
    while (true) {
      // First, try Content-Length framing
      const headerEndIndex = this.buffer.indexOf("\r\n\r\n");
      if (headerEndIndex !== -1) {
        const header = this.buffer.substring(0, headerEndIndex);
        const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);

        if (contentLengthMatch) {
          const contentLength = parseInt(contentLengthMatch[1], 10);
          const bodyStart = headerEndIndex + 4; // Skip \r\n\r\n
          const bodyEnd = bodyStart + contentLength;

          // Check if we have the full message body
          if (this.buffer.length < bodyEnd) {
            // Not enough data yet, wait for more
            break;
          }

          // Extract and parse the message body
          const body = this.buffer.substring(bodyStart, bodyEnd);
          this.buffer = this.buffer.substring(bodyEnd);

          try {
            const message: MCPMessage = JSON.parse(body);
            this.handleMessage(message);
          } catch (e) {
            console.error(
              `[MCP ${this.name}] Failed to parse Content-Length message:`,
              body,
              e,
            );
          }
          continue;
        }
      }

      // If no Content-Length framing, try line-delimited JSON
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex !== -1) {
        const line = this.buffer.substring(0, newlineIndex).trim();
        this.buffer = this.buffer.substring(newlineIndex + 1);

        // Skip empty lines and non-JSON lines (like the "Secure MCP Filesystem Server" message)
        if (line && line.startsWith("{")) {
          try {
            const message: MCPMessage = JSON.parse(line);
            this.handleMessage(message);
          } catch (e) {
            console.error(
              `[MCP ${this.name}] Failed to parse line-delimited JSON:`,
              line,
              e,
            );
          }
        }
        continue;
      }

      // No complete message yet, wait for more data
      break;
    }
  }

  private handleMessage(message: MCPMessage) {
    console.log(
      `[MCP ${this.name}] Received:`,
      message.id !== undefined
        ? `response #${message.id}`
        : message.method || "notification",
    );

    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message || "MCP error"));
      } else {
        resolve(message.result);
      }
    }
  }

  private send(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error("MCP process not connected"));
        return;
      }

      const id = ++this.messageId;
      const message: MCPMessage = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      // Use line-delimited JSON (NOT Content-Length framing)
      const body = JSON.stringify(message);
      const lineDelimitedMessage = body + "\n";

      // Debug logging
      console.log(`[MCP ${this.name}] Sending request:`, method);
      console.log(`[MCP ${this.name}] Message:`, lineDelimitedMessage.trim());
      console.log(
        `[MCP ${this.name}] stdin.writable:`,
        this.process.stdin.writable,
      );

      const written = this.process.stdin.write(
        lineDelimitedMessage,
        "utf8",
        (err) => {
          if (err) {
            console.error(`[MCP ${this.name}] Error writing to stdin:`, err);
            reject(new Error(`Failed to write to MCP server: ${err.message}`));
          } else {
            console.log(
              `[MCP ${this.name}] ✅ Write completed and flushed successfully`,
            );
          }
        },
      );

      console.log(`[MCP ${this.name}] write() returned:`, written);

      // Keep stdin open for bidirectional communication

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("MCP request timeout"));
        }
      }, 30000);
    });
  }

  // Send a notification (no id, no response expected)
  private notify(method: string, params?: any): void {
    if (!this.process?.stdin) {
      console.error(
        `[MCP ${this.name}] Cannot send notification: process not connected`,
      );
      return;
    }

    const message: any = {
      jsonrpc: "2.0",
      method,
    };
    if (params !== undefined) {
      message.params = params;
    }

    // Use Content-Length framing for MCP protocol
    const body = JSON.stringify(message);
    const contentLength = Buffer.byteLength(body, "utf8");
    const framedMessage = `Content-Length: ${contentLength}\r\n\r\n${body}`;
    console.log(
      `[MCP ${this.name}] Sending notification:`,
      method,
      `(${contentLength} bytes)`,
    );
    this.process.stdin.write(framedMessage);
  }

  private async initialize(): Promise<void> {
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "Workbench",
        version: "0.1.0",
      },
    });
    // notifications/initialized is a notification, not a request (no id, no response)
    this.notify("notifications/initialized");
  }

  private async loadTools(): Promise<void> {
    const result = await this.send("tools/list");
    this.tools = result.tools || [];
    console.log(`[MCP ${this.name}] Loaded ${this.tools.length} tools`);
  }

  async callTool(toolName: string, args: any): Promise<any> {
    const result = await this.send("tools/call", {
      name: toolName,
      arguments: args,
    });
    return result;
  }

  disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.status = "disconnected";
    this.tools = [];
  }
}

/**
 * MCP Proxy Client - connects to PipeWrench proxy via TCP
 * Same interface as MCPClient but uses TCP socket instead of stdio
 */
class MCPProxyClient {
  private socket: net.Socket | null = null;
  private messageId = 0;
  private pendingRequests: Map<
    number,
    { resolve: Function; reject: Function }
  > = new Map();
  private buffer = "";
  public tools: any[] = [];
  public status: "disconnected" | "connecting" | "connected" | "error" =
    "disconnected";
  private proxyHost: string;
  private proxyPort: number;

  constructor(
    public name: string,
    public command: string,
    public args: string[] = [],
    proxyPort: number = 9999,
    proxyHost: string = "127.0.0.1",
  ) {
    this.proxyHost = proxyHost;
    this.proxyPort = proxyPort;
  }

  async connect(): Promise<void> {
    return Promise.race([
      this._doConnect(),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error("Proxy connection timeout after 30 seconds")),
          30000,
        ),
      ),
    ]);
  }

  private async _doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.status = "connecting";

      console.log(
        `[MCPProxy ${this.name}] Connecting to proxy at ${this.proxyHost}:${this.proxyPort}`,
      );

      this.socket = new net.Socket();

      this.socket.on("connect", async () => {
        console.log(`[MCPProxy ${this.name}] Connected to proxy`);

        // Send connect command to proxy
        const connectCmd =
          JSON.stringify({
            type: "connect",
            command: this.command,
            args: this.args,
          }) + "\n";

        this.socket!.write(connectCmd);

        try {
          await this.initialize();
          await this.loadTools();
          this.status = "connected";
          resolve();
        } catch (e) {
          this.status = "error";
          reject(e);
        }
      });

      this.socket.on("data", (data: Buffer) => {
        this.handleData(data.toString());
      });

      this.socket.on("error", (err: Error) => {
        console.error(`[MCPProxy ${this.name}] Socket error:`, err.message);
        this.status = "error";
        reject(err);
      });

      this.socket.on("close", () => {
        console.log(`[MCPProxy ${this.name}] Socket closed`);
        this.status = "disconnected";
      });

      this.socket.connect(this.proxyPort, this.proxyHost);
    });
  }

  private handleData(data: string) {
    this.buffer += data;

    // Parse JSON lines from proxy
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const msg = JSON.parse(line);

        // Handle proxy wrapper messages
        if (msg.type === "message" && msg.payload) {
          this.handleMCPMessage(msg.payload);
        } else if (msg.type === "error") {
          console.error(`[MCPProxy ${this.name}] Proxy error:`, msg.message);
        } else if (msg.type === "connected") {
          console.log(`[MCPProxy ${this.name}] Server spawned by proxy`);
        } else if (msg.jsonrpc === "2.0") {
          // Direct MCP message (some proxies may send unwrapped)
          this.handleMCPMessage(msg);
        }
      } catch (e) {
        // May be partial JSON, will be handled next chunk
      }
    }
  }

  private handleMCPMessage(message: MCPMessage) {
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(
          new Error(message.error.message || JSON.stringify(message.error)),
        );
      } else {
        pending.resolve(message.result);
      }
    }
  }

  private send(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error("Not connected to proxy"));
      }

      const id = ++this.messageId;
      this.pendingRequests.set(id, { resolve, reject });

      const mcpMessage: MCPMessage = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      // Wrap in proxy message format
      const proxyMessage =
        JSON.stringify({
          type: "message",
          payload: mcpMessage,
        }) + "\n";

      this.socket.write(proxyMessage);

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("MCP request timeout"));
        }
      }, 30000);
    });
  }

  private notify(method: string, params?: any): void {
    if (!this.socket) {
      console.error(
        `[MCPProxy ${this.name}] Cannot send notification: not connected`,
      );
      return;
    }

    const notification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    const proxyMessage =
      JSON.stringify({
        type: "message",
        payload: notification,
      }) + "\n";

    this.socket.write(proxyMessage);
  }

  private async initialize(): Promise<void> {
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "Workbench",
        version: "0.1.0",
      },
    });
    this.notify("notifications/initialized");
  }

  private async loadTools(): Promise<void> {
    const result = await this.send("tools/list");
    this.tools = result.tools || [];
    console.log(
      `[MCPProxy ${this.name}] Loaded ${this.tools.length} tools via proxy`,
    );
  }

  async callTool(toolName: string, args: any): Promise<any> {
    const result = await this.send("tools/call", {
      name: toolName,
      arguments: args,
    });
    return result;
  }

  disconnect() {
    if (this.socket) {
      // Send disconnect to proxy
      try {
        this.socket.write(JSON.stringify({ type: "disconnect" }) + "\n");
      } catch (e) {}
      this.socket.destroy();
      this.socket = null;
    }
    this.status = "disconnected";
    this.tools = [];
  }
}

const mcpClients: Map<string, MCPClient | MCPProxyClient> = new Map();

function createMCPClient(config: {
  name: string;
  command: string;
  args?: string[];
  transport?: "stdio" | "pipewrench";
}): MCPClient | MCPProxyClient {
  const transport = config.transport || "stdio";
  const proxyPort = store.get("pipewrenchPort", 9999) as number;
  if (transport === "pipewrench") {
    return new MCPProxyClient(
      config.name,
      config.command,
      config.args || [],
      proxyPort,
    );
  }
  return new MCPClient(config.name, config.command, config.args || []);
}

function registerMCPTools(
  client: MCPClient | MCPProxyClient,
  serverName: string,
): void {
  client.tools.forEach((tool) => {
    const toolName = `mcp.${serverName}.${tool.name}`;
    tools.set(toolName, {
      name: toolName,
      description: tool.description,
      inputSchema: tool.inputSchema,
      mcpServer: serverName,
      mcpToolName: tool.name,
      run: async (input: any) => client.callTool(tool.name, input),
    });

    // MCP tools are external; we still register explicit metadata.
    permissionManager.registerToolPermissions(toolName, {});
  });
}

function loadMCPServers() {
  const serverConfigs = (store.get("mcpServers") as any[]) || [];
  console.log("[loadMCPServers] Loading MCP servers:", serverConfigs.length);

  serverConfigs.forEach(async (config) => {
    if (!config.name || !config.command) return;

    const client = createMCPClient(config);
    mcpClients.set(config.name, client);

    try {
      await client.connect();
      // Register MCP tools with mcp. prefix
      registerMCPTools(client, config.name);
      console.log(
        `[MCP] Connected to ${config.name}, registered ${client.tools.length} tools`,
      );
    } catch (e) {
      console.error(`[MCP] Failed to connect to ${config.name}:`, e);
    }
  });
}

type PermissionProfileDecision = "allow" | "ask" | "deny";
type ToolPermissionProfile = Partial<
  Record<PermissionAction, PermissionProfileDecision>
>;

function getPermissionProfileDecision(
  toolName: string,
  action: PermissionAction,
): PermissionProfileDecision | undefined {
  const profiles =
    (store.get("permissionProfiles") as Record<string, ToolPermissionProfile>) ||
    {};
  const exact = profiles[toolName];
  const wildcard = profiles["*"];
  return exact?.[action] ?? wildcard?.[action];
}

function enforceToolPermissions(toolName: string): void {
  const permissions = permissionManager.getToolPermissions(toolName);

  // Tools must declare metadata explicitly.
  if (!permissions) {
    throw new Error(`Permission metadata missing for tool: ${toolName}`);
  }

  const categories: PermissionCategory[] = ["filesystem", "network", "process"];
  for (const category of categories) {
    const categoryPerms = permissions[category];
    if (!categoryPerms) continue;

    for (const action of categoryPerms.actions) {
      if (isFeatureEnabled("N_PERMISSION_PROFILES")) {
        const profileDecision = getPermissionProfileDecision(toolName, action);
        if (profileDecision === "allow") {
          continue;
        }
        if (profileDecision === "deny") {
          throw new Error(`Permission denied by profile for ${category}:${action}`);
        }
        if (profileDecision === "ask") {
          throw new Error(`PERMISSION_REQUIRED:${toolName}`);
        }
      }

      const check = permissionManager.checkPermission(toolName, category, action);
      if (!check.allowed) {
        if (check.needsPrompt) {
          throw new Error(`PERMISSION_REQUIRED:${toolName}`);
        }
        throw new Error(`Permission denied for ${category}:${action}`);
      }
    }
  }
}

type HealthSignalStatus = "pass" | "warn" | "fail";

interface ToolHealthSignals {
  enabled: boolean;
  toolName: string;
  totalRuns: number;
  completed: number;
  failed: number;
  timedOut: number;
  killed: number;
  timeoutRate: number;
  frequentTimeout: boolean;
  timeoutHints: string[];
  knownIssues: string[];
  mcpStatus?: {
    transport: string;
    rawStatus: string;
    status: HealthSignalStatus;
    detail: string;
  };
}

interface SafeFixChange {
  key: string;
  before: any;
  after: any;
}

interface SafeFixPreviewPayload {
  fixId: string;
  title: string;
  description: string;
  changes: SafeFixChange[];
}

interface DiagnosticSuggestion {
  classifier: "PATH" | "permissions" | "AV" | "network_timeout" | "invalid_config";
  doctorSections: string[];
  explanation: string;
  suggestions: string[];
  safeFixes: Array<{
    fixId: string;
    title: string;
    description: string;
  }>;
}

const pendingSafeFixPreviews: Map<
  string,
  { fixId: string; createdAt: number; changes: SafeFixChange[] }
> = new Map();

const TOOL_TIMEOUT_HINTS: Array<{ pattern: RegExp; hints: string[] }> = [
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

function getKnownIssuesForTool(toolName: string): string[] {
  const fromConfig =
    ((store.get("toolKnownIssues") as Record<string, string[]>) || {})[toolName] ||
    [];
  const manifest = manifestRegistry.get(toolName) as any;
  const fromManifest = Array.isArray(manifest?.knownIssues)
    ? manifest.knownIssues
    : [];
  return Array.from(
    new Set(
      [...fromManifest, ...fromConfig]
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function getTimeoutHintsForTool(toolName: string): string[] {
  const match = TOOL_TIMEOUT_HINTS.find((m) => m.pattern.test(toolName));
  if (match) return match.hints;
  return [
    "Try a smaller input payload.",
    "Verify local system resources and retry.",
  ];
}

function toHealthStatus(
  raw: "disconnected" | "connecting" | "connected" | "error",
): HealthSignalStatus {
  if (raw === "connected") return "pass";
  if (raw === "error") return "fail";
  return "warn";
}

function getMCPHealthStatusForTool(toolName: string) {
  if (!toolName.startsWith("mcp.")) return undefined;
  const parts = toolName.split(".");
  if (parts.length < 3) return undefined;

  const serverName = parts[1];
  const client = mcpClients.get(serverName);
  const rawStatus =
    (client?.status as "disconnected" | "connecting" | "connected" | "error") ||
    "disconnected";
  const serverConfig =
    ((store.get("mcpServers") as any[]) || []).find((s) => s.name === serverName) ||
    {};
  const transport = serverConfig.transport || "stdio";

  return {
    transport,
    rawStatus,
    status: toHealthStatus(rawStatus),
    detail:
      transport === "pipewrench"
        ? `PipeWrench transport is ${rawStatus}`
        : `MCP transport is ${rawStatus}`,
  };
}

function computeToolHealthSignals(toolName: string): ToolHealthSignals {
  const runs = runManager.getAllRuns().filter((r) => r.toolName === toolName);
  const terminal = runs.filter((r) =>
    ["completed", "failed", "timed-out", "killed"].includes(r.state),
  );
  const completed = terminal.filter((r) => r.state === "completed").length;
  const failed = terminal.filter((r) => r.state === "failed").length;
  const timedOut = terminal.filter((r) => r.state === "timed-out").length;
  const killed = terminal.filter((r) => r.state === "killed").length;
  const timeoutRate = terminal.length > 0 ? timedOut / terminal.length : 0;
  const frequentTimeout =
    timedOut >= 2 && terminal.length >= 3 && timeoutRate >= 0.3;

  return {
    enabled: true,
    toolName,
    totalRuns: terminal.length,
    completed,
    failed,
    timedOut,
    killed,
    timeoutRate,
    frequentTimeout,
    timeoutHints: frequentTimeout ? getTimeoutHintsForTool(toolName) : [],
    knownIssues: getKnownIssuesForTool(toolName),
    mcpStatus: getMCPHealthStatusForTool(toolName),
  };
}

function buildDiagnosticSuggestions(
  toolName: string,
  errorText: string,
): DiagnosticSuggestion[] {
  const text = `${toolName} ${errorText}`.toLowerCase();
  const suggestions: DiagnosticSuggestion[] = [];

  const pushSuggestion = (suggestion: DiagnosticSuggestion) => {
    if (!suggestions.some((s) => s.classifier === suggestion.classifier)) {
      suggestions.push(suggestion);
    }
  };

  if (
    /(command not found|is not recognized|enoent|path|cannot find)/i.test(text)
  ) {
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

  if (
    /(timeout|timed out|etimedout|econnreset|econnrefused|enotfound|network)/i.test(
      text,
    )
  ) {
    const toolHints = getTimeoutHintsForTool(toolName);
    pushSuggestion({
      classifier: "network_timeout",
      doctorSections: ["Localhost Network", "Proxy/Firewall"],
      explanation: "The failure pattern suggests a network or timeout issue.",
      suggestions: [
        ...toolHints,
        "Check proxy/firewall settings and local network diagnostics.",
      ],
      safeFixes: [],
    });
  }

  if (
    /(no model configured|api key|invalid|bad request|misconfig|configuration|missing)/i.test(
      text,
    )
  ) {
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
          description:
            "Sets `apiEndpoint` to `https://openrouter.ai/api/v1` only if needed.",
        },
      ],
    });
  }

  return suggestions;
}

function createSafeFixPreview(fixId: string): SafeFixPreviewPayload | null {
  const cfg = store.store as any;

  if (fixId === "fix:set-default-api-endpoint") {
    const before = cfg.apiEndpoint || "";
    const after = "https://openrouter.ai/api/v1";
    if (before === after) return null;
    return {
      fixId,
      title: "Set default API endpoint",
      description: "Config-only update. Reversible by restoring previous value.",
      changes: [{ key: "apiEndpoint", before, after }],
    };
  }

  if (fixId === "fix:add-working-dir-to-safe-paths") {
    const workingDir = cfg.workingDir || app.getPath("home");
    const before = Array.isArray(cfg.safePaths) ? cfg.safePaths : [];
    if (!workingDir || before.includes(workingDir)) return null;
    const after = [...before, workingDir];
    return {
      fixId,
      title: "Add working directory to safe paths",
      description: "Config-only update. Reversible by removing the added path.",
      changes: [{ key: "safePaths", before, after }],
    };
  }

  return null;
}

function applySafeFix(fixId: string, changes: SafeFixChange[]): {
  success: boolean;
  error?: string;
} {
  try {
    if (fixId === "fix:set-default-api-endpoint") {
      const change = changes.find((c) => c.key === "apiEndpoint");
      if (!change) return { success: false, error: "Preview mismatch for apiEndpoint" };
      store.set("apiEndpoint", change.after);
      return { success: true };
    }

    if (fixId === "fix:add-working-dir-to-safe-paths") {
      const change = changes.find((c) => c.key === "safePaths");
      if (!change || !Array.isArray(change.after)) {
        return { success: false, error: "Preview mismatch for safePaths" };
      }
      store.set("safePaths", change.after);
      return { success: true };
    }

    return { success: false, error: "Unknown fix ID" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

// Config
ipcMain.handle("config:get", () => store.store);
ipcMain.handle("config:set", (_e, partial) => {
  store.set(partial);
  return store.store;
});

// Plugins
ipcMain.handle("plugins:reload", () => {
  loadPlugins();
  return true;
});

ipcMain.handle("plugins:save", async (_e, pluginName: string, code: string) => {
  try {
    const pluginsDir =
      (store.get("pluginsDir") as string) || path.join(__dirname, "plugins");
    
    console.log(`[plugins:save] Request to save "${pluginName}" to "${pluginsDir}"`);

    if (fs.existsSync(pluginsDir) && fs.statSync(pluginsDir).isFile()) {
      throw new Error(`Plugins directory configuration is invalid (is a file): ${pluginsDir}`);
    }

    const safeName = pluginName
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!safeName) throw new Error("Invalid plugin name");

    const pluginPath = path.join(pluginsDir, safeName);

    // Check if path exists as a file and remove it
    if (fs.existsSync(pluginPath)) {
      const stat = fs.statSync(pluginPath);
      if (stat.isFile()) {
        fs.unlinkSync(pluginPath);
      }
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(pluginPath)) {
      fs.mkdirSync(pluginPath, { recursive: true });
    }

    let cleanCode = code;
    const fenceMatch = code.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/);
    if (fenceMatch) {
      cleanCode = fenceMatch[1].trim();
    }

    fs.writeFileSync(path.join(pluginPath, "index.js"), cleanCode, "utf-8");
    fs.writeFileSync(
      path.join(pluginPath, "package.json"),
      '{\n  "type": "commonjs"\n}\n',
      "utf-8",
    );

    loadPlugins();
    return { success: true, path: pluginPath, name: safeName };
  } catch (e: any) {
    console.error(`[plugins:save] Failed for "${pluginName}":`, e);
    throw e;
  }
});

// Delete a plugin
// Delete a plugin
ipcMain.handle("plugins:delete", async (_e, pluginName: string) => {
  const pluginsDir =
    (store.get("pluginsDir") as string) || path.join(__dirname, "plugins");
  const safeName = pluginName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const pluginPath = path.join(pluginsDir, safeName);

  if (!fs.existsSync(pluginPath)) {
    throw new Error(`Plugin "${pluginName}" not found`);
  }

  // Only allow deleting custom plugins, not built-in ones
  fs.rmSync(pluginPath, { recursive: true, force: true });
  console.log("[plugins:delete] Deleted plugin:", safeName);

  loadPlugins();
  return { success: true, name: safeName };
});

// Tools
ipcMain.handle("tools:list", () => {
  return Array.from(tools.values()).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    category: t.name.split(".")[0],
    _sourceFolder: t._sourceFolder,
    _sourcePath: t._sourcePath,
  }));
});

ipcMain.handle("tools:refresh", () => {
  console.log("[IPC] Refreshing tools...");
  loadPlugins();
  return Array.from(tools.values()).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    category: t.name.split(".")[0],
    _sourceFolder: t._sourceFolder,
    _sourcePath: t._sourcePath,
  }));
});

// Tool Health Signals (L) - optional, local-only
ipcMain.handle("toolHealth:get", (_e, toolName: string) => {
  if (!isFeatureEnabled("L_TOOL_HEALTH_SIGNALS")) {
    return { enabled: false, toolName };
  }
  return computeToolHealthSignals(toolName);
});

ipcMain.handle("toolHealth:addKnownIssue", (_e, toolName: string, note: string) => {
  if (!isFeatureEnabled("L_TOOL_HEALTH_SIGNALS")) {
    return { success: false, error: "Feature disabled" };
  }
  const trimmed = (note || "").trim();
  if (!trimmed) {
    return { success: false, error: "Note cannot be empty" };
  }
  const allIssues =
    (store.get("toolKnownIssues") as Record<string, string[]>) || {};
  const current = Array.isArray(allIssues[toolName]) ? allIssues[toolName] : [];
  allIssues[toolName] = Array.from(new Set([...current, trimmed]));
  store.set("toolKnownIssues", allIssues);
  return { success: true, issues: allIssues[toolName] };
});

ipcMain.handle(
  "toolHealth:removeKnownIssue",
  (_e, toolName: string, index: number) => {
    if (!isFeatureEnabled("L_TOOL_HEALTH_SIGNALS")) {
      return { success: false, error: "Feature disabled" };
    }
    const allIssues =
      (store.get("toolKnownIssues") as Record<string, string[]>) || {};
    const current = Array.isArray(allIssues[toolName]) ? allIssues[toolName] : [];
    if (index < 0 || index >= current.length) {
      return { success: false, error: "Issue index out of range" };
    }
    current.splice(index, 1);
    allIssues[toolName] = current;
    store.set("toolKnownIssues", allIssues);
    return { success: true, issues: current };
  },
);

ipcMain.handle("tools:run", async (_e, name: string, input: any) => {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Tool not found: ${name}`);

  // Concurrency cap check
  if (!processRegistry.canSpawn()) {
    throw new Error(
      `Concurrency limit reached (${processRegistry.getCount()} processes running). Wait for existing tools to finish or kill some first.`
    );
  }

  // Create run tracking
  const runId = runManager.createRun(name, input, 'user');

  try {
    enforceToolPermissions(name);
  } catch (permissionError: any) {
    const message = permissionError?.message || "Permission denied";
    runManager.failRun(
      runId,
      message.startsWith("PERMISSION_REQUIRED:")
        ? "Permission required"
        : message,
    );
    throw permissionError;
  }

  // Start the run
  runManager.startRun(runId);

  const runInput =
    name.startsWith("builtin.")
      ? input && typeof input === "object" && !Array.isArray(input)
        ? { ...input, __runId: runId }
        : { __runId: runId }
      : input;

  // Per-tool timeout: check manifest, fallback to global default (30s)
  const DEFAULT_TOOL_TIMEOUT = 30000;
  const manifest = manifestRegistry.get(name) as any;
  const TOOL_TIMEOUT = (manifest?.timeoutMs && manifest.timeoutMs > 0)
    ? manifest.timeoutMs
    : DEFAULT_TOOL_TIMEOUT;
  const MAX_OUTPUT_SIZE = 500000; // 500KB max output

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`Tool execution timeout (${Math.round(TOOL_TIMEOUT / 1000)}s limit)`)),
      TOOL_TIMEOUT,
    );
  });

  try {
    const rawOutput = await Promise.race([tool.run(runInput), timeoutPromise]);

    const normalized = normalizeToolOutput(rawOutput);

    // Safety: Truncate large outputs
    if (
      typeof normalized.content === "string" &&
      normalized.content.length > MAX_OUTPUT_SIZE
    ) {
      normalized.content =
        normalized.content.substring(0, MAX_OUTPUT_SIZE) +
        `\n\n[Output truncated - exceeded ${MAX_OUTPUT_SIZE} character limit]`;
      normalized.metadata = {
        ...normalized.metadata,
        truncated: true,
        originalSize: normalized.content.length,
      };
    }

    // Complete the run
    const snippet = typeof normalized.content === 'string' 
      ? normalized.content.slice(0, 200) 
      : JSON.stringify(normalized.content).slice(0, 200);
    runManager.completeRun(runId, normalized, snippet);

    return normalized;
  } catch (error: any) {
    // Mark run as failed or timed out
    if (error.message.includes("timeout")) {
      runManager.timeoutRun(runId);
    } else {
      runManager.failRun(runId, error.message);
    }

    // Friendly error handling
    return normalizeToolOutput({
      content: error.message.includes("timeout")
        ? "Tool execution timed out. Please try again or simplify your request."
        : `Tool error: ${error.message}`,
      error: error.message,
      metadata: {
        tool: name,
        input,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// Cost tracking
interface CostData {
  total: number;
  requests: number;
  byModel: Record<
    string,
    {
      cost: number;
      requests: number;
      tokens: { prompt: number; completion: number };
    }
  >;
}
let sessionCosts: CostData = { total: 0, requests: 0, byModel: {} };

// Cost calculation based on OpenRouter pricing
function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  // Approximate pricing per 1M tokens (adjust based on actual OpenRouter pricing)
  const pricing: Record<string, { prompt: number; completion: number }> = {
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
  const isFreeModel = model.includes(":free");
  
  const rates = isFreeModel 
    ? { prompt: 0, completion: 0 }
    : (pricing[model] || pricing["default"]);
    
  return (
    (promptTokens * rates.prompt) / 1_000_000 +
    (completionTokens * rates.completion) / 1_000_000
  );
}

ipcMain.handle("costs:get", () => sessionCosts);
ipcMain.handle("costs:reset", () => {
  sessionCosts = { total: 0, requests: 0, byModel: {} };
  return sessionCosts;
});

// Task runner (non-streaming)
ipcMain.handle(
  "task:run",
  async (_e, taskType: string, prompt: string, includeTools = false) => {
    const config = store.store as any;
    const router = config.router || {};
    const roleConfig = router[taskType];
    if (!roleConfig?.model)
      throw new Error(`No model configured for task type: ${taskType}`);

    const apiKey = config.openrouterApiKey;
    if (!apiKey) throw new Error("No API key configured");

    const apiEndpoint = config.apiEndpoint || "https://openrouter.ai/api/v1";

    const messages: any[] = [];

    // Add system prompt with tools if requested
    if (includeTools) {
      const toolsList = Array.from(tools.values())
        .filter((t) => !t.name.startsWith("builtin."))
        .map((t) => `- ${t.name}: ${t.description || "No description"}`)
        .join("\n");

      const systemPrompt = `You are a helpful AI assistant with access to tools that can perform actions.

Available tools:
${toolsList}

When a user asks you to create, build, or do something, you should USE THE APPROPRIATE TOOL instead of just providing instructions.

For example:
- If asked to "create an artifact to connect Google Calendar", use the workbench.convertArtifact tool
- If asked to "build a tool for X", use the workbench.convertArtifact tool
- If asked to create/generate code or plugins, use the appropriate tool

Your response should indicate which tool you would use and with what parameters. Format like:
TOOL: tool.name
INPUT: { "param": "value" }

Be action-oriented. Do things, don't just explain how to do them.`;

      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const res = await axios.post(
      `${apiEndpoint}/chat/completions`,
      {
        model: roleConfig.model,
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    // Track costs if available
    const usage = res.data.usage;
    if (usage) {
      sessionCosts.requests++;
      // OpenRouter includes cost in generation response
      if (res.data.usage?.total_cost) {
        sessionCosts.total += res.data.usage.total_cost;
      }
    }

    return {
      content: res.data.choices?.[0]?.message?.content || "",
      usage: res.data.usage,
      model: res.data.model,
      sessionCosts: { ...sessionCosts },
    };
  },
);

// List available models from OpenRouter
ipcMain.handle("models:list", async () => {
  const config = store.store as any;
  const apiKey = config.openrouterApiKey;

  if (!apiKey) {
    throw new Error("No OpenRouter API key configured");
  }

  try {
    const res = await axios.get("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // Sort by pricing (cheapest first) and return relevant fields
    const models = res.data.data.map((m: any) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      context_length: m.context_length,
      pricing: {
        prompt: m.pricing?.prompt ? parseFloat(m.pricing.prompt) : 0,
        completion: m.pricing?.completion
          ? parseFloat(m.pricing.completion)
          : 0,
      },
      top_provider: m.top_provider,
      per_million_prompt: m.pricing?.prompt
        ? (parseFloat(m.pricing.prompt) * 1000000).toFixed(2)
        : "0",
      per_million_completion: m.pricing?.completion
        ? (parseFloat(m.pricing.completion) * 1000000).toFixed(2)
        : "0",
    }));

    // Sort by prompt price
    models.sort((a: any, b: any) => a.pricing.prompt - b.pricing.prompt);

    return models;
  } catch (e: any) {
    throw new Error(`Failed to fetch models: ${e.message}`);
  }
});

// Template variable replacement
function processTemplateVariables(text: string): string {
  const now = new Date();
  const user = require("os").userInfo().username;

  return text
    .replace(/\{\{today\}\}/g, now.toLocaleDateString())
    .replace(/\{\{time\}\}/g, now.toLocaleTimeString())
    .replace(/\{\{datetime\}\}/g, now.toLocaleString())
    .replace(/\{\{user\}\}/g, user)
    .replace(/\{\{clipboard\}\}/g, clipboard.readText());
}

// Filter out model thinking/reasoning blocks
function filterThinkingBlocks(text: string): string {
  // Remove various thinking block patterns
  let filtered = text;
  
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
ipcMain.handle(
  "task:runStream",
  async (_e, taskType: string, prompt: string, requestId: string) => {
    const config = store.store as any;
    const router = config.router || {};
    const roleConfig = router[taskType];

    // Check if model is configured
    if (!roleConfig?.model) {
      const error = `No model configured for "${taskType}". Please configure a model in Settings tab.`;
      console.error("[task:runStream]", error);
      mainWindow?.webContents.send("stream:error", { requestId, error });
      throw new Error(error);
    }

    const apiKey = config.openrouterApiKey;
    if (!apiKey) {
      const error =
        "No API key configured. Please add your API key in Settings tab.";
      console.error("[task:runStream]", error);
      mainWindow?.webContents.send("stream:error", { requestId, error });
      throw new Error(error);
    }

    const apiEndpoint = config.apiEndpoint || "https://openrouter.ai/api/v1";

    console.log(
      `[task:runStream] Model: ${roleConfig.model}, TaskType: ${taskType}`,
    );

    // Process template variables in prompt
    const processedPrompt = processTemplateVariables(prompt);

    try {
      const res = await axios.post(
        `${apiEndpoint}/chat/completions`,
        {
          model: roleConfig.model,
          messages: [
            {
              role: "system",
              content: `You are a helpful AI assistant integrated into Workbench - a desktop application with tools.

CRITICAL: When users say "build", "create a tool", or "make an artifact", you should IMMEDIATELY generate the complete code for a Workbench plugin. Don't ask for confirmation or details - just build it based on their request.

Workbench Plugin Format:
\`\`\`javascript
module.exports.register = (api) => {
  api.registerTool({
    name: 'category.toolName',
    inputSchema: {
      type: 'object',
      properties: {
        // input parameters
      },
      required: []
    },
    run: async (input) => {
      // Tool logic here
      // For API calls, return the data or result
      return { result: 'data' };
    }
  });
};
\`\`\`

When user asks you to build something:
1. Generate the COMPLETE plugin code immediately
2. Explain what it does briefly
3. Tell them to save it in the plugins folder

Example:
User: "Build a tool that tells me the temperature"
You: "Here's a weather temperature tool for Workbench:

\`\`\`javascript
module.exports.register = (api) => {
  api.registerTool({
    name: 'weather.temperature',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' }
      },
      required: ['city']
    },
    run: async (input) => {
      // In production, you'd call a real weather API
      return { 
        temperature: 72,
        city: input.city,
        message: \`Temperature in \${input.city} is 72°F\`
      };
    }
  });
};
\`\`\`

This tool fetches temperature data. Save this as \`plugins/weather_temperature/index.js\` and restart Workbench to use it."

BE PROACTIVE. BUILD THE CODE IMMEDIATELY when asked.`,
            },
            { role: "user", content: processedPrompt },
          ],
          stream: true,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          responseType: "stream",
        },
      );

      let fullContent = "";
      let promptTokens = 0;
      let completionTokens = 0;
      let requestCost = 0;
      let costTracked = false;
      let doneSent = false;

      const trackCostOnce = () => {
        if (costTracked) return;
        requestCost = calculateCost(
          roleConfig.model,
          promptTokens,
          completionTokens,
        );
        sessionCosts.total += requestCost;
        sessionCosts.requests += 1;
        if (!sessionCosts.byModel[roleConfig.model]) {
          sessionCosts.byModel[roleConfig.model] = {
            cost: 0,
            requests: 0,
            tokens: { prompt: 0, completion: 0 },
          };
        }
        sessionCosts.byModel[roleConfig.model].cost += requestCost;
        sessionCosts.byModel[roleConfig.model].requests += 1;
        sessionCosts.byModel[roleConfig.model].tokens.prompt += promptTokens;
        sessionCosts.byModel[roleConfig.model].tokens.completion +=
          completionTokens;
        costTracked = true;
      };

      const emitDoneOnce = () => {
        if (doneSent) return;
        doneSent = true;
        // Filter out thinking blocks before sending final content
        const filteredContent = filterThinkingBlocks(fullContent);
        mainWindow?.webContents.send("stream:done", {
          requestId,
          content: filteredContent,
          cost: requestCost,
          tokens: { prompt: promptTokens, completion: completionTokens },
        });
      };

      res.data.on("data", (chunk: Buffer) => {
        const lines = chunk
          .toString()
          .split("\n")
          .filter((line) => line.trim().startsWith("data:"));

        for (const line of lines) {
          const data = line.replace("data:", "").trim();
          if (data === "[DONE]") {
            trackCostOnce();
            emitDoneOnce();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            
            // Some models send reasoning/thinking in separate fields - ignore those
            // Only use the actual content field, not reasoning_content or thinking
            const delta = parsed.choices?.[0]?.delta?.content || "";
            
            if (delta) {
              fullContent += delta;
              mainWindow?.webContents.send("stream:chunk", {
                requestId,
                chunk: delta,
                content: fullContent,
              });
            }
            // Track usage if available
            if (parsed.usage) {
              promptTokens = parsed.usage.prompt_tokens || 0;
              completionTokens = parsed.usage.completion_tokens || 0;
            }
          } catch (e) {
            // Skip malformed chunks
          }
        }
      });

      res.data.on("end", () => {
        trackCostOnce();
        emitDoneOnce();
      });

      res.data.on("error", (err: Error) => {
        mainWindow?.webContents.send("stream:error", {
          requestId,
          error: err.message,
        });
      });

      return { started: true, requestId };
    } catch (e: any) {
      let errorData = e.response?.data;
      
      // If data is a stream (circular structure), read it to get the actual error
      if (errorData && typeof errorData.pipe === 'function') {
        try {
          const chunks = [];
          for await (const chunk of errorData) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const rawParams = Buffer.concat(chunks).toString('utf8');
          try {
             errorData = JSON.parse(rawParams);
          } catch {
             errorData = rawParams;
          }
        } catch (streamErr) {
          errorData = '[Stream Read Failed]';
        }
      }

      const errorDetails = {
        status: e.response?.status,
        statusText: e.response?.statusText,
        data: errorData,
        message: e.message,
      };
      console.error(
        "[task:runStream] Full error:",
        util.inspect(errorDetails, { depth: null, colors: false })
      );

      let errorMessage = "Request failed";
      let detailedMsg = "";
      
      if (typeof errorData === 'object' && errorData?.error?.message) {
          detailedMsg = errorData.error.message;
      } else if (typeof errorData === 'string') {
          detailedMsg = errorData;
      } else if (errorData) {
          try { detailedMsg = JSON.stringify(errorData); } catch {}
      }

      errorMessage = `[${e.response?.status || 'Unknown'}] ${detailedMsg || e.message || 'Request failed'}`;
      
      // Fallbacks for specific status codes if no message found
      if (!detailedMsg) {
          if (e.response?.status === 429) {
            errorMessage = `[429] Rate limit exceeded for model "${roleConfig.model}". Free tier models have limited requests. Try again in a moment or use a different model.`;
          } else if (e.response?.status === 404) {
            errorMessage = `[404] Model not found: ${roleConfig.model}.`;
          } else if (e.response?.status === 400) {
            errorMessage = `[400] Bad request to model "${roleConfig.model}".`;
          }
      } else if (e.response?.status === 429 && !detailedMsg.toLowerCase().includes('rate limit')) {
        // Enhance 429 message even if we got some detail
        errorMessage = `[429] Rate limit exceeded. ${detailedMsg}. Try again in a moment or use a different model.`;
      }

      mainWindow?.webContents.send("stream:error", {
        requestId,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  },
);

// Tool chaining
ipcMain.handle(
  "chain:run",
  async (_e, steps: { tool: string; input: any; outputKey?: string }[]) => {
    const results: any[] = [];
    const context: Record<string, any> = {};
    const executionLog: Array<{
      step: number;
      tool: string;
      status: "success" | "failed";
      error?: string;
      output?: any;
    }> = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const tool = tools.get(step.tool);

      if (!tool) {
        const errorMsg = `Tool not found: ${step.tool}`;
        executionLog.push({
          step: i + 1,
          tool: step.tool,
          status: "failed",
          error: errorMsg,
        });
        return {
          success: false,
          failedAt: i + 1,
          error: errorMsg,
          results,
          context,
          executionLog,
        };
      }

      try {
        // Interpolate context variables in input
        const resolvedInput = interpolateContext(step.input, context);

        enforceToolPermissions(step.tool);

        console.log(`[chain:run] Step ${i + 1}: ${step.tool}`);
        const result = await tool.run(resolvedInput);
        const normalized = normalizeToolOutput(result);

        // Check if tool returned an error
        if (normalized.error) {
          executionLog.push({
            step: i + 1,
            tool: step.tool,
            status: "failed",
            error: normalized.error,
            output: normalized,
          });
          return {
            success: false,
            failedAt: i + 1,
            error: `Tool "${step.tool}" failed: ${normalized.error}`,
            results,
            context,
            executionLog,
          };
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
        context[`step${i}`] = normalized;
        context.lastResult = normalized;
      } catch (error: any) {
        executionLog.push({
          step: i + 1,
          tool: step.tool,
          status: "failed",
          error: error.message,
        });
        return {
          success: false,
          failedAt: i + 1,
          error: `Step ${i + 1} (${step.tool}) threw exception: ${error.message}`,
          results,
          context,
          executionLog,
        };
      }
    }

    return {
      success: true,
      results,
      context,
      executionLog,
    };
  },
);

function interpolateContext(input: any, context: Record<string, any>): any {
  if (typeof input === "string") {
    // Replace {{key}} or {{key.subkey}} patterns
    return input.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const value = key
        .split(".")
        .reduce((obj: any, k: string) => obj?.[k], context);
      return value !== undefined
        ? typeof value === "string"
          ? value
          : JSON.stringify(value)
        : `{{${key}}}`;
    });
  }
  if (Array.isArray(input)) {
    return input.map((item) => interpolateContext(item, context));
  }
  if (typeof input === "object" && input !== null) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = interpolateContext(value, context);
    }
    return result;
  }
  return input;
}

// MCP Management
ipcMain.handle("mcp:list", () => {
  return Array.from(mcpClients.entries()).map(([name, client]) => ({
    name,
    status: client.status,
    toolCount: client.tools.length,
    tools: client.tools.map((t) => t.name),
  }));
});

ipcMain.handle(
  "mcp:add",
  async (
    _e,
    config: {
      name: string;
      command: string;
      args?: string[];
      transport?: "stdio" | "pipewrench";
    },
  ) => {
    console.log("[mcp:add] Adding server:", config);

    const servers = (store.get("mcpServers") as any[]) || [];
    servers.push(config);
    store.set("mcpServers", servers);

    const transport = config.transport || "stdio";
    const client = createMCPClient(config);

    mcpClients.set(config.name, client);

    try {
      console.log("[mcp:add] Connecting to server...");
      await client.connect();
      console.log("[mcp:add] Connected! Tools:", client.tools.length);

      registerMCPTools(client, config.name);
      return { success: true, toolCount: client.tools.length, transport };
    } catch (e: any) {
      console.error("[mcp:add] Connection failed:", e.message);
      client.disconnect(); // Clean up failed connection
      mcpClients.delete(config.name); // Remove from map
      return { success: false, error: e.message || "Connection failed" };
    }
  },
);

ipcMain.handle("mcp:remove", async (_e, name: string) => {
  const client = mcpClients.get(name);
  if (client) {
    client.disconnect();
    mcpClients.delete(name);

    // Remove MCP tools
    tools.forEach((_, toolName) => {
      if (toolName.startsWith(`mcp.${name}.`)) {
        tools.delete(toolName);
      }
    });
  }

  const servers = ((store.get("mcpServers") as any[]) || []).filter(
    (s) => s.name !== name,
  );
  store.set("mcpServers", servers);

  return { success: true };
});

ipcMain.handle("mcp:reconnect", async (_e, name: string) => {
  const client = mcpClients.get(name);
  if (!client) throw new Error(`MCP server not found: ${name}`);

  client.disconnect();
  try {
    await client.connect();
    registerMCPTools(client, name);
    return { success: true, toolCount: client.tools.length };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// ============================================================================
// DOCTOR ENGINE - System Diagnostics
// ============================================================================

// Doctor engine instance
let doctorEngine: DoctorEngine | null = null;
let lastDoctorReport: DoctorReport | null = null;

function getDoctorEngine(): DoctorEngine {
  if (!doctorEngine) {
    const configDir = app.getPath("userData");
    const version = app.getVersion();
    doctorEngine = new DoctorEngine(configDir, version);
  }
  return doctorEngine;
}

// Run all diagnostics
ipcMain.handle("doctor:run", async () => {
  console.log("[doctor:run] Running diagnostics...");
  const engine = getDoctorEngine();
  lastDoctorReport = await engine.runAll();
  console.log("[doctor:run] Complete:", lastDoctorReport.summary);
  return lastDoctorReport;
});

// Get last report
ipcMain.handle("doctor:getLastReport", () => {
  return lastDoctorReport;
});

// Get report as text (sanitized)
ipcMain.handle("doctor:getReportText", (_e, sanitize: boolean = true) => {
  if (!lastDoctorReport) return null;
  const engine = getDoctorEngine();
  return engine.formatReportText(lastDoctorReport, sanitize);
});

// Export report to file
ipcMain.handle("doctor:export", async (_e, sanitize: boolean = true) => {
  if (!lastDoctorReport) {
    throw new Error("No diagnostic report available. Run diagnostics first.");
  }

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
    title: "Export Doctor Report",
    defaultPath: `workbench-doctor-${new Date().toISOString().split("T")[0]}.txt`,
    filters: [
      { name: "Text Files", extensions: ["txt"] },
      { name: "JSON Files", extensions: ["json"] },
    ],
  });

  if (canceled || !filePath) {
    return { success: false, canceled: true };
  }

  const engine = getDoctorEngine();
  let content: string;

  if (filePath.endsWith(".json")) {
    const report = sanitize ? engine.sanitizeReport(lastDoctorReport) : lastDoctorReport;
    content = JSON.stringify(report, null, 2);
  } else {
    content = engine.formatReportText(lastDoctorReport, sanitize);
  }

  fs.writeFileSync(filePath, content, "utf-8");
  return { success: true, filePath };
});

// Auto-Diagnostics - basic suggestions always enabled (V2.0 Trust Core).
// Safe-fix preview flow is gated behind M_SMART_AUTO_DIAGNOSTICS.
ipcMain.handle(
  "doctor:suggestFailure",
  (_e, toolName: string, errorText: string) => {
    const suggestions = buildDiagnosticSuggestions(toolName || "", errorText || "");
    const smartEnabled = isFeatureEnabled("M_SMART_AUTO_DIAGNOSTICS");
    // Strip safeFixes when M flag is off so safe-fix UI stays hidden
    const cleaned = smartEnabled
      ? suggestions
      : suggestions.map((s) => ({ ...s, safeFixes: [] }));
    return {
      enabled: true,
      suggestions: cleaned,
    };
  },
);

ipcMain.handle("safeFix:preview", (_e, fixId: string) => {
  if (!isFeatureEnabled("M_SMART_AUTO_DIAGNOSTICS")) {
    return { success: false, error: "Feature disabled" };
  }
  const preview = createSafeFixPreview(fixId);
  if (!preview) {
    return { success: false, error: "No applicable safe fix changes found" };
  }
  const token = `safe_fix_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  pendingSafeFixPreviews.set(token, {
    fixId,
    createdAt: Date.now(),
    changes: preview.changes,
  });
  return { success: true, token, preview };
});

ipcMain.handle("safeFix:apply", (_e, token: string) => {
  if (!isFeatureEnabled("M_SMART_AUTO_DIAGNOSTICS")) {
    return { success: false, error: "Feature disabled" };
  }
  const pending = pendingSafeFixPreviews.get(token);
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
ipcMain.handle("permissions:register", (_e, toolName: string, permissions: ToolPermissions) => {
  permissionManager.registerToolPermissions(toolName, permissions);
  return { success: true };
});

// Check if tool has permission for an action
ipcMain.handle("permissions:check", (_e, toolName: string, category: PermissionCategory, action: PermissionAction) => {
  return permissionManager.checkPermission(toolName, category, action);
});

// Get tool's declared permissions
ipcMain.handle("permissions:getToolPermissions", (_e, toolName: string) => {
  const permissions = permissionManager.getToolPermissions(toolName);
  if (!permissions) return null;
  return {
    permissions,
    formatted: permissionManager.formatPermissionsForDisplay(permissions),
    isDestructive: permissionManager.isDestructive(toolName),
  };
});

// Grant permission (one-time or permanent)
ipcMain.handle("permissions:grant", (_e, toolName: string, category: PermissionCategory, permanent: boolean) => {
  permissionManager.grantPermission(toolName, category, permanent);
  return { success: true };
});

// Deny permission
ipcMain.handle("permissions:deny", (_e, toolName: string, category: PermissionCategory, permanent: boolean) => {
  permissionManager.denyPermission(toolName, category, permanent);
  return { success: true };
});

// Get tool's current policy
ipcMain.handle("permissions:getPolicy", (_e, toolName: string) => {
  return permissionManager.getToolPolicy(toolName);
});

// Reset tool policy
ipcMain.handle("permissions:resetPolicy", (_e, toolName: string) => {
  permissionManager.resetToolPolicy(toolName);
  return { success: true };
});

// Reset all policies
ipcMain.handle("permissions:resetAll", () => {
  permissionManager.resetAllPolicies();
  return { success: true };
});

// ============================================================================
// CHAT HISTORY PERSISTENCE
// ============================================================================

// Save chat history
ipcMain.handle("chat:save", (_e, history: any[]) => {
  try {
    store.set('chatHistory', history);
    return { success: true };
  } catch (error: any) {
    console.error('[chat:save] Error:', error);
    return { success: false, error: error.message };
  }
});

// Load chat history
ipcMain.handle("chat:load", () => {
  try {
    const history = store.get('chatHistory', []) as any[];
    return { success: true, history };
  } catch (error: any) {
    console.error('[chat:load] Error:', error);
    return { success: false, error: error.message, history: [] };
  }
});

// Clear chat history
ipcMain.handle("chat:clear", () => {
  try {
    store.delete('chatHistory');
    return { success: true };
  } catch (error: any) {
    console.error('[chat:clear] Error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// RUN MANAGER - EXECUTION TRACKING
// ============================================================================

// Get active runs
ipcMain.handle("runs:getActive", () => {
  return runManager.getActiveRuns();
});

// Get run history
ipcMain.handle("runs:getHistory", (_e, limit?: number) => {
  return runManager.getHistory(limit);
});

// Get all runs
ipcMain.handle("runs:getAll", () => {
  return runManager.getAllRuns();
});

// Get specific run
ipcMain.handle("runs:get", (_e, runId: string) => {
  return runManager.getRun(runId);
});

// Get run statistics
ipcMain.handle("runs:getStats", () => {
  return runManager.getStats();
});

// Kill a run (graceful: SIGTERM then SIGKILL after 3s)
ipcMain.handle("runs:kill", async (_e, runId: string) => {
  const run = runManager.getRun(runId);
  if (!run) return { success: false, error: 'Run not found' };

  // Graceful kill: SIGTERM → wait 3s → SIGKILL remaining
  const killed = await processRegistry.gracefulKillRun(runId, 3000);
  console.log(`[runs:kill] Killed ${killed} processes for run ${runId}`);

  runManager.killRun(runId);
  return { success: true, processesKilled: killed };
});

// Clear run history
ipcMain.handle("runs:clearHistory", () => {
  runManager.clearHistory();
  return { success: true };
});

// Clear all runs
ipcMain.handle("runs:clearAll", () => {
  runManager.clearAll();
  return { success: true };
});

// Get interrupted runs (for crash recovery)
ipcMain.handle("runs:getInterrupted", () => {
  return runManager.getInterruptedRuns();
});

// Export run bundle (N) - optional, read-only support artifact for issue filing
ipcMain.handle("runs:exportBundle", async (_e, runId?: string) => {
  if (!isFeatureEnabled("N_EXPORT_RUN_BUNDLE")) {
    return { success: false, error: "Feature disabled" };
  }

  const allRuns = runManager.getAllRuns();
  const selectedRuns =
    runId && runId.trim()
      ? allRuns.filter((r) => r.runId === runId)
      : runManager.getHistory(200);

  const bundle = {
    exportedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    platform: process.platform,
    runId: runId || null,
    runCount: selectedRuns.length,
    stats: runManager.getStats(),
    runs: selectedRuns,
    doctorReport: lastDoctorReport
      ? getDoctorEngine().sanitizeReport(lastDoctorReport)
      : null,
  };

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
    title: "Export Run Bundle",
    defaultPath: `workbench-run-bundle-${new Date().toISOString().split("T")[0]}.json`,
    filters: [{ name: "JSON Files", extensions: ["json"] }],
  });

  if (canceled || !filePath) {
    return { success: false, canceled: true };
  }

  fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2), "utf-8");
  return { success: true, filePath, runCount: selectedRuns.length };
});

// ============================================================================
// SECRETS MANAGER IPC HANDLERS
// ============================================================================

// Check if secure storage is available
ipcMain.handle("secrets:isAvailable", () => {
  return {
    available: secretsManager.isSecureStorageAvailable(),
    backend: secretsManager.getStorageBackend(),
  };
});

// Store a new secret
ipcMain.handle("secrets:store", async (_e, name: string, value: string, type: string, tags?: string[]) => {
  try {
    const handle = await secretsManager.storeSecret(name, value, type as any, tags);
    return { success: true, handle };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Get secret value (requires explicit user action)
ipcMain.handle("secrets:get", async (_e, secretId: string) => {
  try {
    const secret = await secretsManager.getSecret(secretId);
    return { success: true, secret };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Delete secret
ipcMain.handle("secrets:delete", async (_e, secretId: string) => {
  const success = await secretsManager.deleteSecret(secretId);
  return { success };
});

// List all secrets (metadata only)
ipcMain.handle("secrets:list", () => {
  return secretsManager.listSecrets();
});

// Update secret metadata
ipcMain.handle("secrets:updateMetadata", (_e, secretId: string, updates: any) => {
  const success = secretsManager.updateSecretMetadata(secretId, updates);
  return { success };
});

// Find secrets by tool
ipcMain.handle("secrets:findByTool", (_e, toolName: string) => {
  return secretsManager.findSecretsByTool(toolName);
});

// Redact secrets from text/object
ipcMain.handle("secrets:redact", (_e, data: any) => {
  if (typeof data === 'string') {
    return secretsManager.redactSecrets(data);
  } else {
    return secretsManager.redactSecretsFromObject(data);
  }
});

// ============================================================================
// TOOL MANIFEST IPC HANDLERS
// ============================================================================

// Register tool manifest
ipcMain.handle("manifest:register", (_e, manifest: ToolManifest) => {
  return manifestRegistry.register(manifest);
});

// Get tool manifest
ipcMain.handle("manifest:get", (_e, toolName: string) => {
  return manifestRegistry.get(toolName);
});

// List all manifests
ipcMain.handle("manifest:list", () => {
  return manifestRegistry.list();
});

// Check tool compatibility
ipcMain.handle("manifest:checkCompatibility", (_e, toolName: string) => {
  return manifestRegistry.checkCompatibility(toolName);
});

// Get tool info for display
ipcMain.handle("manifest:getToolInfo", (_e, toolName: string) => {
  return manifestRegistry.getToolInfo(toolName);
});

// Find tools by tag
ipcMain.handle("manifest:findByTag", (_e, tag: string) => {
  return manifestRegistry.findByTag(tag);
});

// Find tools by stability
ipcMain.handle("manifest:findByStability", (_e, stability: string) => {
  return manifestRegistry.findByStability(stability as any);
});

// ============================================================================
// PREVIEW / DRY-RUN IPC HANDLERS
// ============================================================================

// Get preview history
ipcMain.handle("preview:getHistory", (_e, limit?: number) => {
  return previewManager.getHistory(limit);
});

// Approve preview
ipcMain.handle("preview:approve", (_e, index: number) => {
  return previewManager.approvePreview(index);
});

// Get specific preview
ipcMain.handle("preview:get", (_e, index: number) => {
  return previewManager.getPreview(index);
});

// Format preview for display
ipcMain.handle("preview:format", (_e, preview: any) => {
  return previewManager.formatPreview(preview);
});

// Clear preview history
ipcMain.handle("preview:clear", () => {
  previewManager.clearHistory();
  return { success: true };
});

// ============================================================================
// USER MEMORY IPC HANDLERS
// ============================================================================

// Remember something
ipcMain.handle("memory:remember", (_e, category: string, key: string, value: any, options?: any) => {
  const memory = memoryManager.remember(category as any, key, value, options);
  return { success: true, memory };
});

// Recall something
ipcMain.handle("memory:recall", (_e, category: string, key: string) => {
  const memory = memoryManager.recall(category as any, key);
  return memory;
});

// Forget something
ipcMain.handle("memory:forget", (_e, memoryId: string) => {
  const success = memoryManager.forget(memoryId);
  return { success };
});

// Forget all
ipcMain.handle("memory:forgetAll", () => {
  memoryManager.forgetAll();
  return { success: true };
});

// Update memory
ipcMain.handle("memory:update", (_e, memoryId: string, updates: any) => {
  const success = memoryManager.update(memoryId, updates);
  return { success };
});

// List all memories
ipcMain.handle("memory:listAll", () => {
  return memoryManager.listAll();
});

// List by category
ipcMain.handle("memory:listByCategory", (_e, category: string) => {
  return memoryManager.listByCategory(category as any);
});

// Search memories
ipcMain.handle("memory:search", (_e, query: string) => {
  return memoryManager.search(query);
});

// Get most used
ipcMain.handle("memory:getMostUsed", (_e, limit?: number) => {
  return memoryManager.getMostUsed(limit);
});

// Get recently used
ipcMain.handle("memory:getRecentlyUsed", (_e, limit?: number) => {
  return memoryManager.getRecentlyUsed(limit);
});

// Get statistics
ipcMain.handle("memory:getStats", () => {
  return memoryManager.getStats();
});

// Enable/disable memory system
ipcMain.handle("memory:setEnabled", (_e, enabled: boolean) => {
  memoryManager.setEnabled(enabled);
  return { success: true };
});

// Check if enabled
ipcMain.handle("memory:isEnabled", () => {
  return memoryManager.isEnabled();
});

// Convenience: Remember preference
ipcMain.handle("memory:rememberPreference", (_e, key: string, value: any) => {
  const memory = memoryManager.rememberPreference(key, value);
  return { success: true, memory };
});

// Convenience: Recall preference
ipcMain.handle("memory:recallPreference", (_e, key: string) => {
  return memoryManager.recallPreference(key);
});

// ============================================================================
// TOOL DISPATCH IPC HANDLERS
// ============================================================================

// Create dispatch plan from natural language
ipcMain.handle("dispatch:createPlan", async (_e, query: string, context?: any) => {
  const availableManifests = manifestRegistry.list();
  const plan = await toolDispatcher.createDispatchPlan(query, availableManifests, context);
  return plan;
});

// Suggest relevant tools
ipcMain.handle("dispatch:suggest", (_e, context: string, limit?: number) => {
  const availableManifests = manifestRegistry.list();
  return toolDispatcher.suggestTools(context, availableManifests, limit);
});

// Format dispatch plan for confirmation
ipcMain.handle("dispatch:formatPlan", (_e, plan: any) => {
  return toolDispatcher.formatPlanForConfirmation(plan);
});

// ============================================================================
// ENVIRONMENT DETECTION IPC HANDLERS
// ============================================================================

// Get environment info
ipcMain.handle("environment:getInfo", async () => {
  return await environmentDetector.getEnvironmentInfo();
});

// Format environment info
ipcMain.handle("environment:format", async (_e, info: any) => {
  return environmentDetector.formatEnvironmentInfo(info);
});

// Get unsupported message
ipcMain.handle("environment:getUnsupportedMessage", (_e, info: any) => {
  return environmentDetector.getUnsupportedMessage(info);
});

// Get lockdown warning
ipcMain.handle("environment:getLockdownWarning", (_e, info: any) => {
  return environmentDetector.getLockdownWarning(info);
});

// Check environment on startup
(async () => {
  const envInfo = await environmentDetector.getEnvironmentInfo();
  console.log('[Environment] Platform:', envInfo.platform, 'Arch:', envInfo.arch);
  console.log('[Environment] Supported:', envInfo.supported);
  
  if (envInfo.risks.length > 0) {
    console.log('[Environment] Risks detected:');
    envInfo.risks.forEach(risk => {
      console.log(`  [${risk.level.toUpperCase()}] ${risk.category}: ${risk.message}`);
    });
  }
  
  if (!envInfo.supported) {
    console.warn('[Environment] Running on unsupported platform!');
  }
})();

// Clear interrupted runs
ipcMain.handle("runs:clearInterrupted", () => {
  runManager.clearInterruptedRuns();
  return { success: true };
});

// Check if there are interrupted runs
ipcMain.handle("runs:hasInterrupted", () => {
  return runManager.hasInterruptedRuns();
});
