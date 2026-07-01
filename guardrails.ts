/**
 * Guardrails - V2.0 Trust Core
 * Schema validation, path sandboxing, and dangerous command blocking
 */

import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface GuardrailCheckResult {
  allowed: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export type ActionType = 'file_write' | 'file_delete' | 'terminal_command' | 'network_call' | 'file_read';

export interface ActionProposal {
  id: string;
  toolName: string;
  actionType: ActionType;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  details: Record<string, any>;
  timestamp: number;
}

// ============================================================================
// DANGEROUS COMMAND PATTERNS
// ============================================================================

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; reason: string; riskLevel: 'medium' | 'high' }> = [
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

export class PathSandbox {
  private safePaths: string[];
  private workspaceRoot: string;

  constructor(workspaceRoot: string, safePaths: string[] = []) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.safePaths = safePaths.map(p => path.resolve(p));
  }

  updateSafePaths(paths: string[]): void {
    this.safePaths = paths.map(p => path.resolve(p));
  }

  updateWorkspaceRoot(root: string): void {
    this.workspaceRoot = path.resolve(root);
  }

  /**
   * Check if a file path is within the sandbox
   */
  isPathAllowed(filePath: string): GuardrailCheckResult {
    const resolved = path.resolve(filePath);
    const normalized = path.normalize(resolved);

    // Block path traversal attempts
    if (filePath.includes('..')) {
      const afterResolve = path.resolve(this.workspaceRoot, filePath);
      if (!afterResolve.startsWith(this.workspaceRoot)) {
        return {
          allowed: false,
          reason: `Path traversal detected: "${filePath}" resolves outside workspace`,
          riskLevel: 'high',
        };
      }
    }

    // Check workspace root
    if (normalized.startsWith(this.workspaceRoot)) {
      return { allowed: true, riskLevel: 'low' };
    }

    // Check configured safe paths
    for (const safe of this.safePaths) {
      if (normalized.startsWith(safe)) {
        return { allowed: true, riskLevel: 'low' };
      }
    }

    // Check temp directory
    const tmpDir = os.tmpdir();
    if (normalized.startsWith(tmpDir)) {
      return { allowed: true, riskLevel: 'medium' };
    }

    return {
      allowed: false,
      reason: `Path "${filePath}" is outside the workspace and safe paths`,
      riskLevel: 'high',
    };
  }
}

// ============================================================================
// SCHEMA VALIDATOR
// ============================================================================

export class SchemaValidator {
  /**
   * Validate tool input against its declared JSON Schema
   */
  validateToolInput(input: any, schema: any): ValidationResult {
    const errors: string[] = [];

    if (!schema) {
      return { valid: true, errors: [] };
    }

    if (schema.type === 'object' && typeof input !== 'object') {
      errors.push(`Expected object input, got ${typeof input}`);
      return { valid: false, errors };
    }

    // Validate required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (input[field] === undefined || input[field] === null || input[field] === '') {
          errors.push(`Missing required field: "${field}"`);
        }
      }
    }

    // Validate property types
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties) as [string, any][]) {
        const value = input[key];
        if (value === undefined || value === null) continue;

        // Type check
        if (propSchema.type) {
          const typeValid = this.checkType(value, propSchema.type);
          if (!typeValid) {
            errors.push(`Field "${key}" expected type "${propSchema.type}", got "${typeof value}"`);
          }
        }

        // Enum check
        if (propSchema.enum && Array.isArray(propSchema.enum)) {
          if (!propSchema.enum.includes(value)) {
            errors.push(`Field "${key}" must be one of: ${propSchema.enum.join(', ')}`);
          }
        }

        // String constraints
        if (propSchema.type === 'string' && typeof value === 'string') {
          if (propSchema.minLength && value.length < propSchema.minLength) {
            errors.push(`Field "${key}" must be at least ${propSchema.minLength} characters`);
          }
          if (propSchema.maxLength && value.length > propSchema.maxLength) {
            errors.push(`Field "${key}" must be at most ${propSchema.maxLength} characters`);
          }
          if (propSchema.pattern) {
            const re = new RegExp(propSchema.pattern);
            if (!re.test(value)) {
              errors.push(`Field "${key}" does not match pattern "${propSchema.pattern}"`);
            }
          }
        }

        // Number constraints
        if ((propSchema.type === 'number' || propSchema.type === 'integer') && typeof value === 'number') {
          if (propSchema.minimum !== undefined && value < propSchema.minimum) {
            errors.push(`Field "${key}" must be >= ${propSchema.minimum}`);
          }
          if (propSchema.maximum !== undefined && value > propSchema.maximum) {
            errors.push(`Field "${key}" must be <= ${propSchema.maximum}`);
          }
        }
      }
    }

    // Reject unknown fields if additionalProperties is false
    if (schema.additionalProperties === false && schema.properties) {
      const known = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(input)) {
        if (key.startsWith('__')) continue; // Allow internal keys like __runId
        if (!known.has(key)) {
          errors.push(`Unknown field: "${key}"`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private checkType(value: any, type: string): boolean {
    switch (type) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number' && !isNaN(value);
      case 'integer': return typeof value === 'number' && Number.isInteger(value);
      case 'boolean': return typeof value === 'boolean';
      case 'array': return Array.isArray(value);
      case 'object': return typeof value === 'object' && !Array.isArray(value) && value !== null;
      default: return true;
    }
  }
}

// ============================================================================
// COMMAND GUARDRAILS
// ============================================================================

export class CommandGuardrails {
  /**
   * Check if a command string contains dangerous patterns
   */
  checkCommand(command: string, args: string[] = []): GuardrailCheckResult {
    const fullCommand = [command, ...args].join(' ');

    for (const { pattern, reason, riskLevel } of DANGEROUS_PATTERNS) {
      if (pattern.test(fullCommand)) {
        return {
          allowed: false,
          reason: `Blocked: ${reason}`,
          riskLevel,
        };
      }
    }

    return { allowed: true, riskLevel: 'low' };
  }

  /**
   * Determine the risk level for a tool action
   */
  assessRisk(toolName: string, actionType: ActionType, input: any): 'low' | 'medium' | 'high' {
    // Read-only operations are low risk
    if (actionType === 'file_read') return 'low';

    // File writes are medium unless they target system paths
    if (actionType === 'file_write') {
      const filePath = input?.path || input?.filePath || '';
      if (this.isSystemPath(filePath)) return 'high';
      return 'medium';
    }

    // File deletes are high risk
    if (actionType === 'file_delete') return 'high';

    // Terminal commands need pattern checking
    if (actionType === 'terminal_command') {
      const cmd = input?.command || '';
      const check = this.checkCommand(cmd, input?.args || []);
      return check.allowed ? 'medium' : 'high';
    }

    // Network calls are medium risk
    if (actionType === 'network_call') return 'medium';

    return 'medium';
  }

  /**
   * Create an action proposal for user approval
   */
  createProposal(toolName: string, actionType: ActionType, input: any): ActionProposal {
    const riskLevel = this.assessRisk(toolName, actionType, input);
    let summary = '';

    switch (actionType) {
      case 'file_write':
        summary = `Write to file: ${input?.path || input?.filePath || 'unknown'}`;
        break;
      case 'file_delete':
        summary = `Delete file: ${input?.path || input?.filePath || 'unknown'}`;
        break;
      case 'file_read':
        summary = `Read file: ${input?.path || input?.filePath || 'unknown'}`;
        break;
      case 'terminal_command':
        summary = `Execute: ${input?.command || 'unknown'} ${(input?.args || []).join(' ')}`.trim();
        break;
      case 'network_call':
        summary = `Network request: ${input?.method || 'GET'} ${input?.url || 'unknown'}`;
        break;
    }

    return {
      id: `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      toolName,
      actionType,
      summary,
      riskLevel,
      details: input,
      timestamp: Date.now(),
    };
  }

  /**
   * Classify what type of action a tool performs based on its name and input
   */
  classifyAction(toolName: string, input: any): ActionType {
    const name = toolName.toLowerCase();

    if (name.includes('write') || name.includes('save') || name.includes('create')) return 'file_write';
    if (name.includes('delete') || name.includes('remove')) return 'file_delete';
    if (name.includes('read') || name.includes('list') || name.includes('get')) return 'file_read';
    if (name.includes('shell') || name.includes('exec') || name.includes('command') || name.includes('spawn')) return 'terminal_command';
    if (name.includes('fetch') || name.includes('http') || name.includes('url') || name.includes('api')) return 'network_call';

    // If input has command/args, it's a terminal command
    if (input?.command) return 'terminal_command';
    // If input has a URL, it's a network call
    if (input?.url) return 'network_call';
    // If input has a file path and content, it's a write
    if (input?.path && input?.content) return 'file_write';
    // Default to file_read as safest assumption
    if (input?.path) return 'file_read';

    return 'file_read';
  }

  private isSystemPath(filePath: string): boolean {
    if (!filePath) return false;
    const normalized = path.normalize(filePath).toLowerCase();
    const systemPaths = [
      '/usr', '/bin', '/sbin', '/etc', '/var', '/boot', '/lib',
      '/system', '/windows', 'c:\\windows', 'c:\\program files',
    ];
    return systemPaths.some(sp => normalized.startsWith(sp));
  }
}

// ============================================================================
// LOOP DETECTOR (Failure Recovery)
// ============================================================================

export class LoopDetector {
  private recentFailures: Array<{ toolName: string; error: string; timestamp: number }> = [];
  private readonly maxHistorySize = 50;
  private readonly windowMs = 60000; // 1 minute window
  private readonly thresholdCount = 3; // 3 identical failures = loop

  recordFailure(toolName: string, error: string): void {
    this.recentFailures.push({
      toolName,
      error: error.substring(0, 200), // Truncate for comparison
      timestamp: Date.now(),
    });

    // Trim old entries
    if (this.recentFailures.length > this.maxHistorySize) {
      this.recentFailures = this.recentFailures.slice(-this.maxHistorySize);
    }
  }

  /**
   * Check if we're in a failure loop for a given tool
   */
  isInLoop(toolName: string, error: string): boolean {
    const now = Date.now();
    const truncatedError = error.substring(0, 200);
    const recentMatches = this.recentFailures.filter(
      f => f.toolName === toolName
        && f.error === truncatedError
        && (now - f.timestamp) < this.windowMs
    );
    return recentMatches.length >= this.thresholdCount;
  }

  /**
   * Get suggestion when a loop is detected
   */
  getLoopSuggestion(toolName: string): string {
    return `Repeated identical failures detected for "${toolName}". Consider: (1) Running Doctor to diagnose the issue, (2) Trying a different approach, or (3) Checking the tool's input parameters.`;
  }

  reset(): void {
    this.recentFailures = [];
  }
}
