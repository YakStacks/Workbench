"use strict";
/**
 * Runner Interface - Foundation for language-agnostic tool execution
 *
 * Runners execute tools in specific environments (shell, Python, Node, Go, etc.)
 * Core does not implement language logic. Runners do.
 *
 * Phase 1: Only ShellRunner exists. All tools route through it.
 * Future: PythonRunner, NodeRunner, GoRunner, etc.
 */
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
exports.runnerRegistry = exports.RunnerRegistry = exports.ShellRunner = void 0;
/**
 * ShellRunner - Wraps current execution behavior
 *
 * Phase 1: This is the ONLY runner. All existing tools route through it.
 * No behavior changes. No new error handling. Just routing.
 */
var ShellRunner = /** @class */ (function () {
    function ShellRunner() {
        this.name = 'shell';
    }
    ShellRunner.prototype.canRun = function (toolSpec) {
        // Phase 1: Accept all tools (wraps existing behavior)
        return true;
    };
    ShellRunner.prototype.prepare = function (toolSpec, input) {
        // Wrap current execution path - no changes to logic
        var command = toolSpec.command || toolSpec.script || '';
        return {
            runner: this.name,
            command: command,
            args: [], // Phase 1: command is already formatted with args
            cwd: toolSpec.cwd,
            env: toolSpec.env,
            timeout: toolSpec.timeout || 30000,
            shell: true // Current behavior uses shell execution
        };
    };
    ShellRunner.prototype.execute = function (plan) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Phase 1: This will be called by tool-dispatch.ts
                // For now, this is a placeholder - actual execution still happens in tool-dispatch
                // This allows gradual migration without breaking existing code
                throw new Error('ShellRunner.execute() - not yet migrated. Execution still in tool-dispatch.ts');
            });
        });
    };
    ShellRunner.prototype.verify = function (result, toolSpec) {
        // Phase 1: Simple exit code verification (matches current behavior)
        if (result.exitCode === 0) {
            return {
                status: 'PASS',
                reason: 'Exit code 0'
            };
        }
        if (result.error) {
            return {
                status: 'FAIL',
                reason: result.error,
                suggestion: 'Check stderr for details'
            };
        }
        return {
            status: 'FAIL',
            reason: "Non-zero exit code: ".concat(result.exitCode),
            suggestion: 'Check stderr for error details'
        };
    };
    return ShellRunner;
}());
exports.ShellRunner = ShellRunner;
/**
 * RunnerRegistry - Singleton for runner management
 *
 * Phase 1: Only ShellRunner registered.
 * Future: PythonRunner, NodeRunner, etc.
 */
var RunnerRegistry = /** @class */ (function () {
    function RunnerRegistry() {
        this.runners = new Map();
        // Phase 1: Auto-register ShellRunner
        this.register(new ShellRunner());
    }
    RunnerRegistry.getInstance = function () {
        if (!RunnerRegistry.instance) {
            RunnerRegistry.instance = new RunnerRegistry();
        }
        return RunnerRegistry.instance;
    };
    RunnerRegistry.prototype.register = function (runner) {
        this.runners.set(runner.name, runner);
        console.log("[RunnerRegistry] Registered runner: ".concat(runner.name));
    };
    RunnerRegistry.prototype.findRunner = function (toolSpec) {
        // Phase 1: Always return ShellRunner
        // This ensures zero behavior change during migration
        var runnerArray = Array.from(this.runners.values());
        for (var i = 0; i < runnerArray.length; i++) {
            var runner = runnerArray[i];
            if (runner.canRun(toolSpec)) {
                // GUARDRAIL: Log which runner selected
                console.log("[RunnerRegistry] Selected runner: ".concat(runner.name, " for tool"));
                // ASSERTION: Phase 1 - must always be ShellRunner
                if (runner.name !== 'shell') {
                    console.warn("[RunnerRegistry] WARNING: Non-shell runner selected during Phase 1. This should not happen.");
                }
                return runner;
            }
        }
        console.error('[RunnerRegistry] No runner found for tool spec');
        return null;
    };
    RunnerRegistry.prototype.getRunner = function (name) {
        return this.runners.get(name) || null;
    };
    RunnerRegistry.prototype.listRunners = function () {
        return Array.from(this.runners.keys());
    };
    return RunnerRegistry;
}());
exports.RunnerRegistry = RunnerRegistry;
// Export singleton instance for convenience
exports.runnerRegistry = RunnerRegistry.getInstance();
