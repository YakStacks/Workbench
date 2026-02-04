/**
 * PipeWrench - Reporter
 * 
 * Pretty terminal output and JSON output modes.
 */

import { Status, ExitCode } from './types.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

// Status icons and colors
const statusConfig = {
  [Status.PASS]: { icon: '✓', color: colors.green, label: 'PASS' },
  [Status.WARN]: { icon: '⚠', color: colors.yellow, label: 'WARN' },
  [Status.FAIL]: { icon: '✗', color: colors.red, label: 'FAIL' }
};

/**
 * Format a report for terminal output
 */
export function formatTerminal(report, options = {}) {
  const lines = [];
  const verbose = options.verbose || false;
  
  // Header
  lines.push('');
  lines.push(`${colors.bold}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  lines.push(`${colors.bold}║${colors.reset}                    ${colors.cyan}PipeWrench Diagnostic${colors.reset}                     ${colors.bold}║${colors.reset}`);
  lines.push(`${colors.bold}╠══════════════════════════════════════════════════════════════╣${colors.reset}`);
  
  // Target info
  const targetStr = report.target.raw || JSON.stringify(report.target);
  lines.push(`${colors.bold}║${colors.reset}  Target: ${colors.white}${truncate(targetStr, 50)}${colors.reset}`.padEnd(75) + `${colors.bold}║${colors.reset}`);
  lines.push(`${colors.bold}║${colors.reset}  Time:   ${colors.dim}${report.timestamp}${colors.reset}`.padEnd(75) + `${colors.bold}║${colors.reset}`);
  lines.push(`${colors.bold}╠══════════════════════════════════════════════════════════════╣${colors.reset}`);
  
  // Results
  for (const rule of report.rules) {
    const cfg = statusConfig[rule.status];
    const statusBadge = `${cfg.color}${cfg.icon} ${cfg.label}${colors.reset}`;
    
    lines.push(`${colors.bold}║${colors.reset}  ${statusBadge}  ${rule.title}`.padEnd(75) + `${colors.bold}║${colors.reset}`);
    
    // Show evidence for warnings and failures (or in verbose mode)
    if (rule.status !== Status.PASS || verbose) {
      for (const evidence of rule.evidence) {
        lines.push(`${colors.bold}║${colors.reset}         ${colors.dim}→ ${truncate(evidence, 50)}${colors.reset}`.padEnd(75) + `${colors.bold}║${colors.reset}`);
      }
    }
    
    // Show fixes for failures
    if (rule.status === Status.FAIL) {
      for (const fix of rule.fix) {
        lines.push(`${colors.bold}║${colors.reset}         ${colors.cyan}💡 ${truncate(fix, 48)}${colors.reset}`.padEnd(75) + `${colors.bold}║${colors.reset}`);
      }
    }
  }
  
  // Summary
  lines.push(`${colors.bold}╠══════════════════════════════════════════════════════════════╣${colors.reset}`);
  
  const { passed, warned, failed, total } = report.summary;
  const summaryLine = `  ${colors.green}${passed} passed${colors.reset}  ${colors.yellow}${warned} warned${colors.reset}  ${colors.red}${failed} failed${colors.reset}  (${total} total)`;
  lines.push(`${colors.bold}║${colors.reset}${summaryLine}`.padEnd(85) + `${colors.bold}║${colors.reset}`);
  
  // Overall status
  const exitCode = report.getExitCode();
  let overallStatus, overallColor;
  if (exitCode === ExitCode.PASS) {
    overallStatus = '✓ ALL CHECKS PASSED';
    overallColor = colors.green;
  } else if (exitCode === ExitCode.WARN) {
    overallStatus = '⚠ PASSED WITH WARNINGS';
    overallColor = colors.yellow;
  } else {
    overallStatus = '✗ CHECKS FAILED';
    overallColor = colors.red;
  }
  
  lines.push(`${colors.bold}║${colors.reset}  ${overallColor}${colors.bold}${overallStatus}${colors.reset}`.padEnd(78) + `${colors.bold}║${colors.reset}`);
  lines.push(`${colors.bold}╚══════════════════════════════════════════════════════════════╝${colors.reset}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format a report as JSON
 */
export function formatJSON(report) {
  return JSON.stringify(report.toJSON(), null, 2);
}

/**
 * Format trace output (detailed I/O capture)
 */
export function formatTrace(probeResult, options = {}) {
  const lines = [];
  const maxBodySize = options.maxBodySize || 1000;
  
  lines.push('');
  lines.push(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  lines.push(`${colors.cyan}                         TRACE OUTPUT${colors.reset}`);
  lines.push(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  
  // Timings
  if (probeResult.timings) {
    lines.push('');
    lines.push(`${colors.bold}⏱  TIMINGS${colors.reset}`);
    lines.push(`   Duration: ${probeResult.timings.duration}ms`);
    if (probeResult.timings.ttfb) {
      lines.push(`   TTFB:     ${probeResult.timings.ttfb}ms`);
    }
  }
  
  // HTTP details
  if (probeResult.http) {
    const h = probeResult.http;
    lines.push('');
    lines.push(`${colors.bold}📡 HTTP RESPONSE${colors.reset}`);
    lines.push(`   Status:       ${h.status} ${h.statusText}`);
    lines.push(`   Content-Type: ${h.contentType || 'unknown'}`);
    lines.push(`   Body Size:    ${h.bodySize} bytes`);
    
    if (h.headers && Object.keys(h.headers).length > 0) {
      lines.push('');
      lines.push(`${colors.bold}📋 HEADERS${colors.reset}`);
      for (const [key, value] of Object.entries(h.headers)) {
        lines.push(`   ${key}: ${truncate(String(value), 50)}`);
      }
    }
    
    if (h.body) {
      lines.push('');
      lines.push(`${colors.bold}📦 BODY${colors.reset}`);
      const bodyPreview = truncate(h.body, maxBodySize);
      lines.push(`   ${bodyPreview}`);
    }
  }
  
  // Command details
  if (probeResult.command) {
    const c = probeResult.command;
    lines.push('');
    lines.push(`${colors.bold}🖥  COMMAND${colors.reset}`);
    lines.push(`   Exit Code: ${c.exitCode}`);
    if (c.signal) lines.push(`   Signal:    ${c.signal}`);
    lines.push(`   Spawned:   ${c.spawned ? 'yes' : 'no'}`);
    
    if (c.stdout) {
      lines.push('');
      lines.push(`${colors.bold}📤 STDOUT${colors.reset}`);
      lines.push(`   ${truncate(c.stdout, maxBodySize)}`);
    }
    
    if (c.stderr) {
      lines.push('');
      lines.push(`${colors.bold}📥 STDERR${colors.reset}`);
      lines.push(`   ${truncate(c.stderr, maxBodySize)}`);
    }
  }
  
  // MCP details
  if (probeResult.mcp) {
    const m = probeResult.mcp;
    lines.push('');
    lines.push(`${colors.bold}🔌 MCP PROTOCOL${colors.reset}`);
    lines.push(`   Transport:   ${m.transport}`);
    lines.push(`   Framing:     ${m.framing}`);
    lines.push(`   Initialized: ${m.initialized ? 'yes' : 'no'}`);
    lines.push(`   Tools:       ${m.tools.length}`);
    
    if (m.frames && m.frames.length > 0) {
      lines.push('');
      lines.push(`${colors.bold}📨 FRAMES${colors.reset}`);
      for (const frame of m.frames.slice(0, 10)) {
        lines.push(`   [${frame.direction}] ${truncate(JSON.stringify(frame.data), 60)}`);
      }
    }
  }
  
  lines.push('');
  lines.push(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Print a message with status indicator
 */
export function printStatus(status, message) {
  const cfg = statusConfig[status];
  console.log(`${cfg.color}${cfg.icon}${colors.reset} ${message}`);
}

/**
 * Print a progress message
 */
export function printProgress(message) {
  console.log(`${colors.dim}•${colors.reset} ${message}`);
}

/**
 * Print an error message
 */
export function printError(message) {
  console.error(`${colors.red}✗ Error:${colors.reset} ${message}`);
}

/**
 * Truncate string with ellipsis
 */
function truncate(str, maxLength) {
  if (!str) return '';
  str = String(str).replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export default {
  formatTerminal,
  formatJSON,
  formatTrace,
  printStatus,
  printProgress,
  printError
};
