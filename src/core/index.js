"use strict";
/**
 * Workbench Core - Runtime Foundation
 *
 * Core responsibilities:
 * - Tool contract enforcement
 * - Execution orchestration via Runners
 * - Verification
 * - Policy enforcement (future)
 * - Event emission (future)
 * - Doctor diagnostics (future)
 *
 * Core does NOT:
 * - Implement specific tools
 * - Contain UI logic
 * - Depend on application features
 * - Hardcode language implementations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDiagnostics = exports.getVerificationStatus = exports.isVerifiedResult = exports.wrapToolResult = exports.createVerification = exports.runnerRegistry = exports.RunnerRegistry = exports.ShellRunner = void 0;
var runner_1 = require("./runner");
Object.defineProperty(exports, "ShellRunner", { enumerable: true, get: function () { return runner_1.ShellRunner; } });
Object.defineProperty(exports, "RunnerRegistry", { enumerable: true, get: function () { return runner_1.RunnerRegistry; } });
Object.defineProperty(exports, "runnerRegistry", { enumerable: true, get: function () { return runner_1.runnerRegistry; } });
var verification_1 = require("./verification");
Object.defineProperty(exports, "createVerification", { enumerable: true, get: function () { return verification_1.createVerification; } });
Object.defineProperty(exports, "wrapToolResult", { enumerable: true, get: function () { return verification_1.wrapToolResult; } });
Object.defineProperty(exports, "isVerifiedResult", { enumerable: true, get: function () { return verification_1.isVerifiedResult; } });
Object.defineProperty(exports, "getVerificationStatus", { enumerable: true, get: function () { return verification_1.getVerificationStatus; } });
var doctor_1 = require("./doctor");
Object.defineProperty(exports, "runDiagnostics", { enumerable: true, get: function () { return doctor_1.runDiagnostics; } });
