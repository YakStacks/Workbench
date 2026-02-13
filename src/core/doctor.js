"use strict";
/**
 * Doctor Core - Foundation Diagnostics Layer
 *
 * Doctor is NOT a UI feature. Doctor is runtime trust verification.
 *
 * Phase 1: Extract diagnostic logic from application layer
 * Core diagnostic functions callable from anywhere (main, renderer, CLI)
 *
 * Original doctor.ts remains for backward compatibility
 * Future: Deprecate original doctor.ts, migrate fully to core
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDiagnostics = runDiagnostics;
var child_process_1 = require("child_process");
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var os = __importStar(require("os"));
var net = __importStar(require("net"));
// ============================================================================
// CORE DIAGNOSTICS (Pure functions - no state)
// ============================================================================
/**
 * Run all diagnostics
 * Returns structured report with PASS/WARN/FAIL for each check
 */
function runDiagnostics() {
    return __awaiter(this, arguments, void 0, function (appVersion) {
        var results, _a, _b, _c, _d, _e, _f, summary;
        if (appVersion === void 0) { appVersion = '2.0.1-dev'; }
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    results = [];
                    // System checks
                    results.push(checkOSAndArch());
                    results.push(checkDiskSpace());
                    results.push(checkMemory());
                    // Process checks
                    _b = (_a = results).push;
                    return [4 /*yield*/, checkProcessSpawn()];
                case 1:
                    // Process checks
                    _b.apply(_a, [_g.sent()]);
                    _d = (_c = results).push;
                    return [4 /*yield*/, checkStdoutStderr()];
                case 2:
                    _d.apply(_c, [_g.sent()]);
                    // Network checks
                    _f = (_e = results).push;
                    return [4 /*yield*/, checkLocalhostBind()];
                case 3:
                    // Network checks
                    _f.apply(_e, [_g.sent()]);
                    results.push(checkLoopback());
                    // Path checks
                    results.push(checkPathSanity());
                    // Platform-specific checks
                    if (process.platform === 'win32') {
                        results.push(checkWindowsDefender());
                    }
                    summary = {
                        pass: results.filter(function (r) { return r.status === 'PASS'; }).length,
                        warn: results.filter(function (r) { return r.status === 'WARN'; }).length,
                        fail: results.filter(function (r) { return r.status === 'FAIL'; }).length
                    };
                    return [2 /*return*/, {
                            timestamp: new Date().toISOString(),
                            platform: "".concat(os.platform(), " ").concat(os.arch(), " ").concat(os.release()),
                            version: appVersion,
                            results: results,
                            summary: summary,
                            trigger: 'manual'
                        }];
            }
        });
    });
}
/**
 * Check OS and architecture
 */
function checkOSAndArch() {
    var platform = os.platform();
    var arch = os.arch();
    var release = os.release();
    var supported = ['win32', 'darwin', 'linux'].includes(platform);
    return {
        name: 'OS and Architecture',
        category: 'system',
        status: supported ? 'PASS' : 'WARN',
        evidence: "".concat(platform, " ").concat(arch, " ").concat(release),
        fixSteps: supported ? undefined : ['Workbench is designed for Windows, macOS, and Linux']
    };
}
/**
 * Check available disk space
 */
function checkDiskSpace() {
    try {
        var homedir = os.homedir();
        // Simple check - detailed disk space check would need platform-specific code
        var canWrite = fs.existsSync(homedir);
        return {
            name: 'Disk Space',
            category: 'system',
            status: canWrite ? 'PASS' : 'WARN',
            evidence: canWrite ? 'Home directory accessible' : 'Cannot access home directory'
        };
    }
    catch (error) {
        return {
            name: 'Disk Space',
            category: 'system',
            status: 'FAIL',
            evidence: error.message,
            fixSteps: ['Check disk permissions']
        };
    }
}
/**
 * Check available memory
 */
function checkMemory() {
    var freeMemMB = Math.round(os.freemem() / 1024 / 1024);
    var totalMemMB = Math.round(os.totalmem() / 1024 / 1024);
    var status = freeMemMB < 500 ? 'WARN' : 'PASS';
    return {
        name: 'Memory',
        category: 'system',
        status: status,
        evidence: "".concat(freeMemMB, " MB free of ").concat(totalMemMB, " MB"),
        fixSteps: status === 'WARN' ? ['Close unused applications to free memory'] : undefined
    };
}
/**
 * Check process spawn capability
 */
function checkProcessSpawn() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    var _a;
                    var start = Date.now();
                    try {
                        var proc = (0, child_process_1.spawn)(process.platform === 'win32' ? 'cmd' : 'sh', process.platform === 'win32' ? ['/c', 'echo test'] : ['-c', 'echo test']);
                        var output_1 = '';
                        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) { output_1 += data.toString(); });
                        proc.on('close', function (code) {
                            var duration = Date.now() - start;
                            resolve({
                                name: 'Process Spawn',
                                category: 'process',
                                status: code === 0 ? 'PASS' : 'FAIL',
                                evidence: code === 0 ? 'Can spawn child processes' : "Spawn failed with code ".concat(code),
                                duration: duration,
                                fixSteps: code === 0 ? undefined : ['Check OS permissions for process execution']
                            });
                        });
                        proc.on('error', function (err) {
                            resolve({
                                name: 'Process Spawn',
                                category: 'process',
                                status: 'FAIL',
                                evidence: err.message,
                                fixSteps: ['Verify Node.js installation', 'Check system permissions']
                            });
                        });
                    }
                    catch (error) {
                        resolve({
                            name: 'Process Spawn',
                            category: 'process',
                            status: 'FAIL',
                            evidence: error.message,
                            fixSteps: ['Verify Node.js installation']
                        });
                    }
                })];
        });
    });
}
/**
 * Check stdout/stderr capture
 */
function checkStdoutStderr() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    var _a, _b;
                    try {
                        var proc = (0, child_process_1.spawn)(process.platform === 'win32' ? 'cmd' : 'sh', process.platform === 'win32' ? ['/c', 'echo stdout && echo stderr >&2'] : ['-c', 'echo stdout; echo stderr >&2']);
                        var stdout_1 = '';
                        var stderr_1 = '';
                        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) { stdout_1 += data.toString(); });
                        (_b = proc.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (data) { stderr_1 += data.toString(); });
                        proc.on('close', function () {
                            var hasStdout = stdout_1.includes('stdout');
                            var hasStderr = stderr_1.includes('stderr');
                            resolve({
                                name: 'Stdout/Stderr Capture',
                                category: 'process',
                                status: (hasStdout && hasStderr) ? 'PASS' : 'WARN',
                                evidence: "stdout: ".concat(hasStdout ? 'captured' : 'missing', ", stderr: ").concat(hasStderr ? 'captured' : 'missing'),
                                fixSteps: !(hasStdout && hasStderr) ? ['Check console/terminal configuration'] : undefined
                            });
                        });
                    }
                    catch (error) {
                        resolve({
                            name: 'Stdout/Stderr Capture',
                            category: 'process',
                            status: 'FAIL',
                            evidence: error.message
                        });
                    }
                })];
        });
    });
}
/**
 * Check localhost bind capability
 */
function checkLocalhostBind() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    var server = net.createServer();
                    server.on('error', function (err) {
                        resolve({
                            name: 'Localhost Bind',
                            category: 'network',
                            status: 'FAIL',
                            evidence: err.message,
                            fixSteps: ['Check firewall settings', 'Verify no port conflicts']
                        });
                    });
                    server.listen(0, '127.0.0.1', function () {
                        var address = server.address();
                        server.close();
                        resolve({
                            name: 'Localhost Bind',
                            category: 'network',
                            status: 'PASS',
                            evidence: "Can bind to 127.0.0.1:".concat(address.port)
                        });
                    });
                })];
        });
    });
}
/**
 * Check loopback interface
 */
function checkLoopback() {
    var interfaces = os.networkInterfaces();
    var hasLoopback = Object.values(interfaces).some(function (iface) {
        return iface === null || iface === void 0 ? void 0 : iface.some(function (addr) { return addr.address === '127.0.0.1' || addr.address === '::1'; });
    });
    return {
        name: 'Loopback Interface',
        category: 'network',
        status: hasLoopback ? 'PASS' : 'FAIL',
        evidence: hasLoopback ? 'Loopback interface present' : 'No loopback interface found',
        fixSteps: hasLoopback ? undefined : ['Check network configuration', 'Restart network services']
    };
}
/**
 * Check PATH sanity
 */
function checkPathSanity() {
    var envPath = process.env.PATH || '';
    var pathEntries = envPath.split(path.delimiter).filter(Boolean);
    if (pathEntries.length === 0) {
        return {
            name: 'PATH Environment',
            category: 'system',
            status: 'FAIL',
            evidence: 'PATH is empty',
            fixSteps: ['Check environment configuration', 'Restart application']
        };
    }
    return {
        name: 'PATH Environment',
        category: 'system',
        status: 'PASS',
        evidence: "".concat(pathEntries.length, " entries in PATH")
    };
}
/**
 * Check Windows Defender (Windows only)
 */
function checkWindowsDefender() {
    if (process.platform !== 'win32') {
        return {
            name: 'Windows Defender',
            category: 'security',
            status: 'PASS',
            evidence: 'Not applicable (not Windows)'
        };
    }
    try {
        // Best-effort check - may not always be accurate
        var result = (0, child_process_1.execSync)('powershell -Command "Get-MpPreference -ErrorAction SilentlyContinue | Select-Object -ExpandProperty DisableRealtimeMonitoring"', { timeout: 5000, encoding: 'utf-8' });
        var disabled = result.trim() === 'True';
        return {
            name: 'Windows Defender',
            category: 'security',
            status: 'PASS',
            evidence: disabled ? 'Real-time protection disabled' : 'Real-time protection enabled',
            fixSteps: disabled ? undefined : ['If experiencing slowness, consider adding Workbench to exclusions']
        };
    }
    catch (_a) {
        return {
            name: 'Windows Defender',
            category: 'security',
            status: 'PASS',
            evidence: 'Unable to check (may require admin)',
            fixSteps: ['If experiencing slowness, manually check Defender exclusions']
        };
    }
}
