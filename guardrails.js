"use strict";
/**
 * Guardrails - V2.0 Trust Core
 * Schema validation, path sandboxing, and dangerous command blocking
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoopDetector = exports.CommandGuardrails = exports.SchemaValidator = exports.PathSandbox = void 0;
var path = __importStar(require("path"));
var os = __importStar(require("os"));
// ============================================================================
// DANGEROUS COMMAND PATTERNS
// ============================================================================
var DANGEROUS_PATTERNS = [
    { pattern: /rm\s+(-rf|-fr)\s+\/(?!\S)/, reason: 'Recursive delete of root filesystem', riskLevel: 'high' },
    { pattern: /rm\s+(-rf|-fr)\s+~/, reason: 'Recursive delete of home directory', riskLevel: 'high' },
    { pattern: /rm\s+(-rf|-fr)\s+\$HOME/, reason: 'Recursive delete of home directory', riskLevel: 'high' },
    { pattern: /rm\s+(-rf|-fr)\s+\*/, reason: 'Recursive delete with wildcard', riskLevel: 'high' },
    { pattern: /mkfs\./, reason: 'Filesystem formatting command', riskLevel: 'high' },
    { pattern: /dd\s+if=.*of=\/dev\//, reason: 'Direct disk write', riskLevel: 'high' },
    { pattern: /:(){ :|:& };:/, reason: 'Fork bomb', riskLevel: 'high' },
    { pattern: />\s*\/dev\/sd[a-z]/, reason: 'Direct write to disk device', riskLevel: 'high' },
    { pattern: /chmod\s+(-R\s+)?777\s+\//, reason: 'Recursive permission change on root', riskLevel: 'high' },
    { pattern: /chown\s+-R\s+.*\s+\/(?!\S)/, reason: 'Recursive ownership change on root', riskLevel: 'high' },
    { pattern: /curl.*\|\s*(ba)?sh/, reason: 'Piping remote content to shell', riskLevel: 'high' },
    { pattern: /wget.*\|\s*(ba)?sh/, reason: 'Piping remote content to shell', riskLevel: 'high' },
    { pattern: /format\s+[a-zA-Z]:/, reason: 'Windows disk format', riskLevel: 'high' },
    { pattern: /del\s+\/[sS]\s+\/[qQ]\s+[cC]:\\/, reason: 'Recursive delete of Windows system drive', riskLevel: 'high' },
    { pattern: /rd\s+\/[sS]\s+\/[qQ]\s+[cC]:\\/, reason: 'Recursive directory removal of system drive', riskLevel: 'high' },
    { pattern: /shutdown\s+/, reason: 'System shutdown command', riskLevel: 'medium' },
    { pattern: /reboot/, reason: 'System reboot command', riskLevel: 'medium' },
    { pattern: /kill\s+-9\s+-1/, reason: 'Kill all processes', riskLevel: 'high' },
    { pattern: /killall\s+-9/, reason: 'Kill all matching processes', riskLevel: 'medium' },
];
// ============================================================================
// PATH SANDBOX
// ============================================================================
var PathSandbox = /** @class */ (function () {
    function PathSandbox(workspaceRoot, safePaths) {
        if (safePaths === void 0) { safePaths = []; }
        this.workspaceRoot = path.resolve(workspaceRoot);
        this.safePaths = safePaths.map(function (p) { return path.resolve(p); });
    }
    PathSandbox.prototype.updateSafePaths = function (paths) {
        this.safePaths = paths.map(function (p) { return path.resolve(p); });
    };
    PathSandbox.prototype.updateWorkspaceRoot = function (root) {
        this.workspaceRoot = path.resolve(root);
    };
    /**
     * Check if a file path is within the sandbox
     */
    PathSandbox.prototype.isPathAllowed = function (filePath) {
        var resolved = path.resolve(filePath);
        var normalized = path.normalize(resolved);
        // Block path traversal attempts
        if (filePath.includes('..')) {
            var afterResolve = path.resolve(this.workspaceRoot, filePath);
            if (!afterResolve.startsWith(this.workspaceRoot)) {
                return {
                    allowed: false,
                    reason: "Path traversal detected: \"".concat(filePath, "\" resolves outside workspace"),
                    riskLevel: 'high',
                };
            }
        }
        // Check workspace root
        if (normalized.startsWith(this.workspaceRoot)) {
            return { allowed: true, riskLevel: 'low' };
        }
        // Check configured safe paths
        for (var _i = 0, _a = this.safePaths; _i < _a.length; _i++) {
            var safe = _a[_i];
            if (normalized.startsWith(safe)) {
                return { allowed: true, riskLevel: 'low' };
            }
        }
        // Check temp directory
        var tmpDir = os.tmpdir();
        if (normalized.startsWith(tmpDir)) {
            return { allowed: true, riskLevel: 'medium' };
        }
        return {
            allowed: false,
            reason: "Path \"".concat(filePath, "\" is outside the workspace and safe paths"),
            riskLevel: 'high',
        };
    };
    return PathSandbox;
}());
exports.PathSandbox = PathSandbox;
// ============================================================================
// SCHEMA VALIDATOR
// ============================================================================
var SchemaValidator = /** @class */ (function () {
    function SchemaValidator() {
    }
    /**
     * Validate tool input against its declared JSON Schema
     */
    SchemaValidator.prototype.validateToolInput = function (input, schema) {
        var errors = [];
        if (!schema) {
            return { valid: true, errors: [] };
        }
        if (schema.type === 'object' && typeof input !== 'object') {
            errors.push("Expected object input, got ".concat(typeof input));
            return { valid: false, errors: errors };
        }
        // Validate required fields
        if (schema.required && Array.isArray(schema.required)) {
            for (var _i = 0, _a = schema.required; _i < _a.length; _i++) {
                var field = _a[_i];
                if (input[field] === undefined || input[field] === null || input[field] === '') {
                    errors.push("Missing required field: \"".concat(field, "\""));
                }
            }
        }
        // Validate property types
        if (schema.properties) {
            for (var _b = 0, _c = Object.entries(schema.properties); _b < _c.length; _b++) {
                var _d = _c[_b], key = _d[0], propSchema = _d[1];
                var value = input[key];
                if (value === undefined || value === null)
                    continue;
                // Type check
                if (propSchema.type) {
                    var typeValid = this.checkType(value, propSchema.type);
                    if (!typeValid) {
                        errors.push("Field \"".concat(key, "\" expected type \"").concat(propSchema.type, "\", got \"").concat(typeof value, "\""));
                    }
                }
                // Enum check
                if (propSchema.enum && Array.isArray(propSchema.enum)) {
                    if (!propSchema.enum.includes(value)) {
                        errors.push("Field \"".concat(key, "\" must be one of: ").concat(propSchema.enum.join(', ')));
                    }
                }
                // String constraints
                if (propSchema.type === 'string' && typeof value === 'string') {
                    if (propSchema.minLength && value.length < propSchema.minLength) {
                        errors.push("Field \"".concat(key, "\" must be at least ").concat(propSchema.minLength, " characters"));
                    }
                    if (propSchema.maxLength && value.length > propSchema.maxLength) {
                        errors.push("Field \"".concat(key, "\" must be at most ").concat(propSchema.maxLength, " characters"));
                    }
                    if (propSchema.pattern) {
                        var re = new RegExp(propSchema.pattern);
                        if (!re.test(value)) {
                            errors.push("Field \"".concat(key, "\" does not match pattern \"").concat(propSchema.pattern, "\""));
                        }
                    }
                }
                // Number constraints
                if ((propSchema.type === 'number' || propSchema.type === 'integer') && typeof value === 'number') {
                    if (propSchema.minimum !== undefined && value < propSchema.minimum) {
                        errors.push("Field \"".concat(key, "\" must be >= ").concat(propSchema.minimum));
                    }
                    if (propSchema.maximum !== undefined && value > propSchema.maximum) {
                        errors.push("Field \"".concat(key, "\" must be <= ").concat(propSchema.maximum));
                    }
                }
            }
        }
        // Reject unknown fields if additionalProperties is false
        if (schema.additionalProperties === false && schema.properties) {
            var known = new Set(Object.keys(schema.properties));
            for (var _e = 0, _f = Object.keys(input); _e < _f.length; _e++) {
                var key = _f[_e];
                if (key.startsWith('__'))
                    continue; // Allow internal keys like __runId
                if (!known.has(key)) {
                    errors.push("Unknown field: \"".concat(key, "\""));
                }
            }
        }
        return { valid: errors.length === 0, errors: errors };
    };
    SchemaValidator.prototype.checkType = function (value, type) {
        switch (type) {
            case 'string': return typeof value === 'string';
            case 'number': return typeof value === 'number' && !isNaN(value);
            case 'integer': return typeof value === 'number' && Number.isInteger(value);
            case 'boolean': return typeof value === 'boolean';
            case 'array': return Array.isArray(value);
            case 'object': return typeof value === 'object' && !Array.isArray(value) && value !== null;
            default: return true;
        }
    };
    return SchemaValidator;
}());
exports.SchemaValidator = SchemaValidator;
// ============================================================================
// COMMAND GUARDRAILS
// ============================================================================
var CommandGuardrails = /** @class */ (function () {
    function CommandGuardrails() {
    }
    /**
     * Check if a command string contains dangerous patterns
     */
    CommandGuardrails.prototype.checkCommand = function (command, args) {
        if (args === void 0) { args = []; }
        var fullCommand = __spreadArray([command], args, true).join(' ');
        for (var _i = 0, DANGEROUS_PATTERNS_1 = DANGEROUS_PATTERNS; _i < DANGEROUS_PATTERNS_1.length; _i++) {
            var _a = DANGEROUS_PATTERNS_1[_i], pattern = _a.pattern, reason = _a.reason, riskLevel = _a.riskLevel;
            if (pattern.test(fullCommand)) {
                return {
                    allowed: false,
                    reason: "Blocked: ".concat(reason),
                    riskLevel: riskLevel,
                };
            }
        }
        return { allowed: true, riskLevel: 'low' };
    };
    /**
     * Determine the risk level for a tool action
     */
    CommandGuardrails.prototype.assessRisk = function (toolName, actionType, input) {
        // Read-only operations are low risk
        if (actionType === 'file_read')
            return 'low';
        // File writes are medium unless they target system paths
        if (actionType === 'file_write') {
            var filePath = (input === null || input === void 0 ? void 0 : input.path) || (input === null || input === void 0 ? void 0 : input.filePath) || '';
            if (this.isSystemPath(filePath))
                return 'high';
            return 'medium';
        }
        // File deletes are high risk
        if (actionType === 'file_delete')
            return 'high';
        // Terminal commands need pattern checking
        if (actionType === 'terminal_command') {
            var cmd = (input === null || input === void 0 ? void 0 : input.command) || '';
            var check = this.checkCommand(cmd, (input === null || input === void 0 ? void 0 : input.args) || []);
            return check.allowed ? 'medium' : 'high';
        }
        // Network calls are medium risk
        if (actionType === 'network_call')
            return 'medium';
        return 'medium';
    };
    /**
     * Create an action proposal for user approval
     */
    CommandGuardrails.prototype.createProposal = function (toolName, actionType, input) {
        var riskLevel = this.assessRisk(toolName, actionType, input);
        var summary = '';
        switch (actionType) {
            case 'file_write':
                summary = "Write to file: ".concat((input === null || input === void 0 ? void 0 : input.path) || (input === null || input === void 0 ? void 0 : input.filePath) || 'unknown');
                break;
            case 'file_delete':
                summary = "Delete file: ".concat((input === null || input === void 0 ? void 0 : input.path) || (input === null || input === void 0 ? void 0 : input.filePath) || 'unknown');
                break;
            case 'file_read':
                summary = "Read file: ".concat((input === null || input === void 0 ? void 0 : input.path) || (input === null || input === void 0 ? void 0 : input.filePath) || 'unknown');
                break;
            case 'terminal_command':
                summary = "Execute: ".concat((input === null || input === void 0 ? void 0 : input.command) || 'unknown', " ").concat(((input === null || input === void 0 ? void 0 : input.args) || []).join(' ')).trim();
                break;
            case 'network_call':
                summary = "Network request: ".concat((input === null || input === void 0 ? void 0 : input.method) || 'GET', " ").concat((input === null || input === void 0 ? void 0 : input.url) || 'unknown');
                break;
        }
        return {
            id: "proposal_".concat(Date.now(), "_").concat(Math.random().toString(36).slice(2, 7)),
            toolName: toolName,
            actionType: actionType,
            summary: summary,
            riskLevel: riskLevel,
            details: input,
            timestamp: Date.now(),
        };
    };
    /**
     * Classify what type of action a tool performs based on its name and input
     */
    CommandGuardrails.prototype.classifyAction = function (toolName, input) {
        var name = toolName.toLowerCase();
        if (name.includes('write') || name.includes('save') || name.includes('create'))
            return 'file_write';
        if (name.includes('delete') || name.includes('remove'))
            return 'file_delete';
        if (name.includes('read') || name.includes('list') || name.includes('get'))
            return 'file_read';
        if (name.includes('shell') || name.includes('exec') || name.includes('command') || name.includes('spawn'))
            return 'terminal_command';
        if (name.includes('fetch') || name.includes('http') || name.includes('url') || name.includes('api'))
            return 'network_call';
        // If input has command/args, it's a terminal command
        if (input === null || input === void 0 ? void 0 : input.command)
            return 'terminal_command';
        // If input has a URL, it's a network call
        if (input === null || input === void 0 ? void 0 : input.url)
            return 'network_call';
        // If input has a file path and content, it's a write
        if ((input === null || input === void 0 ? void 0 : input.path) && (input === null || input === void 0 ? void 0 : input.content))
            return 'file_write';
        // Default to file_read as safest assumption
        if (input === null || input === void 0 ? void 0 : input.path)
            return 'file_read';
        return 'file_read';
    };
    CommandGuardrails.prototype.isSystemPath = function (filePath) {
        if (!filePath)
            return false;
        var normalized = path.normalize(filePath).toLowerCase();
        var systemPaths = [
            '/usr', '/bin', '/sbin', '/etc', '/var', '/boot', '/lib',
            '/system', '/windows', 'c:\\windows', 'c:\\program files',
        ];
        return systemPaths.some(function (sp) { return normalized.startsWith(sp); });
    };
    return CommandGuardrails;
}());
exports.CommandGuardrails = CommandGuardrails;
// ============================================================================
// LOOP DETECTOR (Failure Recovery)
// ============================================================================
var LoopDetector = /** @class */ (function () {
    function LoopDetector() {
        this.recentFailures = [];
        this.maxHistorySize = 50;
        this.windowMs = 60000; // 1 minute window
        this.thresholdCount = 3; // 3 identical failures = loop
    }
    LoopDetector.prototype.recordFailure = function (toolName, error) {
        this.recentFailures.push({
            toolName: toolName,
            error: error.substring(0, 200), // Truncate for comparison
            timestamp: Date.now(),
        });
        // Trim old entries
        if (this.recentFailures.length > this.maxHistorySize) {
            this.recentFailures = this.recentFailures.slice(-this.maxHistorySize);
        }
    };
    /**
     * Check if we're in a failure loop for a given tool
     */
    LoopDetector.prototype.isInLoop = function (toolName, error) {
        var _this = this;
        var now = Date.now();
        var truncatedError = error.substring(0, 200);
        var recentMatches = this.recentFailures.filter(function (f) { return f.toolName === toolName
            && f.error === truncatedError
            && (now - f.timestamp) < _this.windowMs; });
        return recentMatches.length >= this.thresholdCount;
    };
    /**
     * Get suggestion when a loop is detected
     */
    LoopDetector.prototype.getLoopSuggestion = function (toolName) {
        return "Repeated identical failures detected for \"".concat(toolName, "\". Consider: (1) Running Doctor to diagnose the issue, (2) Trying a different approach, or (3) Checking the tool's input parameters.");
    };
    LoopDetector.prototype.reset = function () {
        this.recentFailures = [];
    };
    return LoopDetector;
}());
exports.LoopDetector = LoopDetector;
