/**
 * PipeWrench - Common Types
 * 
 * Core type definitions for targets, probes, and rules.
 */

/**
 * Target types for diagnostics
 */
export const TargetType = {
  HTTP: 'http',
  CMD: 'cmd',
  STDIO: 'stdio',
  MCP_HTTP: 'mcp-http',
  MCP_STDIO: 'mcp-stdio'
};

/**
 * Rule result status
 */
export const Status = {
  PASS: 'pass',
  WARN: 'warn',
  FAIL: 'fail'
};

/**
 * Exit codes
 */
export const ExitCode = {
  PASS: 0,      // All rules passed
  WARN: 1,      // Some warnings present
  FAIL: 2,      // Failures present
  ERROR: 3      // Tool/runtime error
};

/**
 * Parse a target string into a Target object
 * 
 * Examples:
 *   http://localhost:3000 → { type: 'http', url: 'http://localhost:3000' }
 *   cmd:npx -y @mcp/server → { type: 'cmd', command: 'npx', args: ['-y', '@mcp/server'] }
 *   stdio:node server.js   → { type: 'stdio', command: 'node', args: ['server.js'] }
 */
export function parseTarget(targetString) {
  // HTTP/HTTPS URL
  if (targetString.startsWith('http://') || targetString.startsWith('https://')) {
    return {
      type: TargetType.HTTP,
      url: targetString,
      raw: targetString
    };
  }
  
  // Command prefix: cmd:command args...
  if (targetString.startsWith('cmd:')) {
    const parts = targetString.slice(4).trim().split(/\s+/);
    return {
      type: TargetType.CMD,
      command: parts[0],
      args: parts.slice(1),
      raw: targetString
    };
  }
  
  // Stdio prefix: stdio:command args...
  if (targetString.startsWith('stdio:')) {
    const parts = targetString.slice(6).trim().split(/\s+/);
    return {
      type: TargetType.STDIO,
      command: parts[0],
      args: parts.slice(1),
      raw: targetString
    };
  }
  
  // MCP HTTP: mcp-http:url
  if (targetString.startsWith('mcp-http:')) {
    return {
      type: TargetType.MCP_HTTP,
      url: targetString.slice(9).trim(),
      raw: targetString
    };
  }
  
  // MCP stdio: mcp-stdio:command args...
  if (targetString.startsWith('mcp-stdio:')) {
    const parts = targetString.slice(10).trim().split(/\s+/);
    return {
      type: TargetType.MCP_STDIO,
      command: parts[0],
      args: parts.slice(1),
      raw: targetString
    };
  }
  
  // Default: treat as command
  const parts = targetString.split(/\s+/);
  return {
    type: TargetType.CMD,
    command: parts[0],
    args: parts.slice(1),
    raw: targetString
  };
}

/**
 * Probe result - raw facts collected from testing
 */
export class ProbeResult {
  constructor(targetType) {
    this.targetType = targetType;
    this.success = false;
    this.error = null;
    this.timings = {
      start: 0,
      end: 0,
      duration: 0,
      ttfb: 0          // Time to first byte (HTTP)
    };
    
    // HTTP-specific
    this.http = null;
    
    // Command-specific
    this.command = null;
    
    // MCP-specific
    this.mcp = null;
    
    // Raw I/O capture
    this.rawOutput = '';
    this.rawError = '';
  }
  
  /**
   * Set HTTP probe results
   */
  setHttpResult(result) {
    this.http = {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
      body: result.body,
      bodySize: result.bodySize,
      contentType: result.contentType,
      redirects: result.redirects || [],
      tlsError: result.tlsError
    };
    this.success = result.status >= 200 && result.status < 400;
  }
  
  /**
   * Set command probe results
   */
  setCommandResult(result) {
    this.command = {
      exitCode: result.exitCode,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
      spawned: result.spawned,
      startupTime: result.startupTime
    };
    this.success = result.exitCode === 0;
  }
  
  /**
   * Set MCP probe results
   */
  setMcpResult(result) {
    this.mcp = {
      transport: result.transport,
      framing: result.framing,
      initialized: result.initialized,
      initializeResponse: result.initializeResponse,
      tools: result.tools || [],
      frames: result.frames || [],
      pollution: result.pollution || []
    };
    this.success = result.initialized;
  }
}

/**
 * Rule result - diagnostic finding from a rule
 */
export class RuleResult {
  constructor(id, title) {
    this.id = id;
    this.title = title;
    this.status = Status.PASS;
    this.evidence = [];
    this.fix = [];
    this.links = [];
    this.tags = [];
  }
  
  pass(evidence = null) {
    this.status = Status.PASS;
    if (evidence) this.evidence.push(evidence);
    return this;
  }
  
  warn(evidence, fix = null) {
    this.status = Status.WARN;
    this.evidence.push(evidence);
    if (fix) this.fix.push(fix);
    return this;
  }
  
  fail(evidence, fix = null) {
    this.status = Status.FAIL;
    this.evidence.push(evidence);
    if (fix) this.fix.push(fix);
    return this;
  }
  
  addEvidence(text) {
    this.evidence.push(text);
    return this;
  }
  
  addFix(text) {
    this.fix.push(text);
    return this;
  }
  
  addLink(url, label = null) {
    this.links.push({ url, label: label || url });
    return this;
  }
  
  addTags(...tags) {
    this.tags.push(...tags);
    return this;
  }
  
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      status: this.status,
      evidence: this.evidence,
      fix: this.fix,
      links: this.links,
      tags: this.tags
    };
  }
}

/**
 * Diagnostic report - aggregated results
 */
export class DiagnosticReport {
  constructor(target) {
    this.target = target;
    this.timestamp = new Date().toISOString();
    this.probeResult = null;
    this.rules = [];
    this.summary = {
      total: 0,
      passed: 0,
      warned: 0,
      failed: 0
    };
  }
  
  addRuleResult(result) {
    this.rules.push(result);
    this.summary.total++;
    if (result.status === Status.PASS) this.summary.passed++;
    if (result.status === Status.WARN) this.summary.warned++;
    if (result.status === Status.FAIL) this.summary.failed++;
  }
  
  getExitCode() {
    if (this.summary.failed > 0) return ExitCode.FAIL;
    if (this.summary.warned > 0) return ExitCode.WARN;
    return ExitCode.PASS;
  }
  
  toJSON() {
    return {
      target: this.target,
      timestamp: this.timestamp,
      summary: this.summary,
      exitCode: this.getExitCode(),
      rules: this.rules.map(r => r.toJSON())
    };
  }
}

export default {
  TargetType,
  Status,
  ExitCode,
  parseTarget,
  ProbeResult,
  RuleResult,
  DiagnosticReport
};
