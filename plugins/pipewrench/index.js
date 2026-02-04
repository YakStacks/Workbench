/**
 * PipeWrench Plugin for Workbench
 * 
 * Diagnose MCP server connection issues from within Workbench.
 * This wraps the standalone PipeWrench tool as a Workbench plugin.
 * 
 * Usage in chat:
 *   "Run MCP diagnostics on the memory server"
 *   "Why isn't my filesystem MCP server connecting?"
 * 
 * Usage in Tools tab:
 *   Tool: debug.mcpDoctor
 *   Input: { "target": "mcp-stdio:npx -y @modelcontextprotocol/server-memory" }
 */

const { spawn } = require('child_process');
const path = require('path');

module.exports.register = (api) => {
  
  // Main diagnostic tool
  api.registerTool({
    name: 'debug.mcpDoctor',
    description: 'Diagnose MCP server connection issues. Returns detailed diagnostic report with pass/warn/fail status for each check.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { 
          type: 'string', 
          description: 'Target to diagnose. Examples: "mcp-stdio:npx -y @modelcontextprotocol/server-memory", "mcp-stdio:npx -y @modelcontextprotocol/server-filesystem C:\\Projects", "mcp-http:http://localhost:3000/mcp"'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 15000)'
        },
        verbose: {
          type: 'boolean',
          description: 'Include detailed evidence for all checks, not just failures'
        }
      },
      required: ['target']
    },
    run: async (input) => {
      const timeout = input.timeout || 15000;
      const verbose = input.verbose || false;
      
      try {
        const result = await runPipeWrench('doctor', input.target, { timeout, verbose, json: true });
        
        // Parse JSON output
        const report = JSON.parse(result.stdout);
        
        // Format for readability
        const summary = formatDiagnosticSummary(report);
        
        return {
          content: summary,
          metadata: {
            exitCode: result.exitCode,
            passed: report.summary?.passed || 0,
            warned: report.summary?.warned || 0,
            failed: report.summary?.failed || 0,
            score: report.score || 0,
            target: input.target
          }
        };
      } catch (err) {
        return {
          content: `Diagnostic failed: ${err.message}`,
          error: err.message
        };
      }
    }
  });
  
  // Trace tool for detailed I/O capture
  api.registerTool({
    name: 'debug.mcpTrace',
    description: 'Capture detailed I/O trace from an MCP server. Shows raw protocol messages, timings, and framing details.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { 
          type: 'string', 
          description: 'Target to trace. Examples: "mcp-stdio:npx -y @modelcontextprotocol/server-memory"'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 15000)'
        }
      },
      required: ['target']
    },
    run: async (input) => {
      const timeout = input.timeout || 15000;
      
      try {
        const result = await runPipeWrench('trace', input.target, { timeout, json: true });
        
        // Parse JSON output
        const trace = JSON.parse(result.stdout);
        
        // Format trace for readability
        const summary = formatTraceSummary(trace);
        
        return {
          content: summary,
          metadata: {
            exitCode: result.exitCode,
            duration: trace.timings?.duration,
            framing: trace.mcp?.framing,
            initialized: trace.mcp?.initialized,
            toolCount: trace.mcp?.tools?.length || 0
          }
        };
      } catch (err) {
        return {
          content: `Trace failed: ${err.message}`,
          error: err.message
        };
      }
    }
  });
  
  // Quick test tool - simplified interface
  api.registerTool({
    name: 'debug.mcpTest',
    description: 'Quick test if an MCP server can connect. Returns simple pass/fail with basic info.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { 
          type: 'string', 
          description: 'Command to run the MCP server (e.g., "npx")'
        },
        args: {
          type: 'string',
          description: 'Arguments for the command (e.g., "-y @modelcontextprotocol/server-memory")'
        }
      },
      required: ['command']
    },
    run: async (input) => {
      const args = input.args || '';
      const target = `mcp-stdio:${input.command} ${args}`.trim();
      
      try {
        const result = await runPipeWrench('doctor', target, { timeout: 15000, json: true });
        const report = JSON.parse(result.stdout);
        
        const passed = report.summary?.failed === 0;
        const tools = report.rules?.find(r => r.id === 'mcp-tools-available')?.evidence || [];
        
        if (passed) {
          return {
            content: `✅ MCP server connected successfully!\n\nFraming: ${report.rules?.find(r => r.id === 'mcp-framing-detected')?.evidence?.[0] || 'unknown'}\nTools: ${tools.length > 0 ? tools.join(', ') : 'none detected'}`,
            metadata: { success: true, toolCount: tools.length }
          };
        } else {
          const failures = report.rules?.filter(r => r.status === 'fail') || [];
          const failureList = failures.map(f => `• ${f.title}: ${f.evidence?.[0] || 'unknown'}`).join('\n');
          
          return {
            content: `❌ MCP server connection failed\n\nIssues:\n${failureList}\n\nRun debug.mcpDoctor for detailed diagnostics.`,
            metadata: { success: false, failures: failures.length }
          };
        }
      } catch (err) {
        return {
          content: `❌ Test failed: ${err.message}`,
          error: err.message
        };
      }
    }
  });
};

/**
 * Run PipeWrench CLI and capture output
 */
async function runPipeWrench(command, target, options = {}) {
  return new Promise((resolve, reject) => {
    const args = [command];
    
    if (target) args.push(target);
    if (options.json) args.push('--json');
    if (options.verbose) args.push('--verbose');
    if (options.timeout) args.push('--timeout', String(options.timeout));
    
    // Find PipeWrench - check multiple locations
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'pipewrench', 'cli.js'),  // Adjacent to plugins folder
      path.join(__dirname, '..', 'pipewrench', 'cli.js'),        // Inside plugins folder
      path.join(process.cwd(), 'pipewrench', 'cli.js'),          // Workbench root
    ];
    
    let pipewrenchPath = null;
    for (const p of possiblePaths) {
      try {
        require.resolve(p);
        pipewrenchPath = p;
        break;
      } catch (e) {
        // Try next path
      }
    }
    
    if (!pipewrenchPath) {
      // Fall back to assuming it's in PATH or node_modules
      pipewrenchPath = 'pipewrench';
    }
    
    const isWindows = process.platform === 'win32';
    let spawnCmd, spawnArgs;
    
    if (pipewrenchPath.endsWith('.js')) {
      spawnCmd = 'node';
      spawnArgs = [pipewrenchPath, ...args];
    } else {
      spawnCmd = isWindows ? 'pipewrench.cmd' : 'pipewrench';
      spawnArgs = args;
    }
    
    const proc = spawn(spawnCmd, spawnArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
      windowsHide: true,
      timeout: (options.timeout || 15000) + 5000  // Extra buffer for CLI overhead
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    
    proc.on('error', (err) => {
      reject(new Error(`Failed to run PipeWrench: ${err.message}`));
    });
    
    proc.on('close', (code) => {
      resolve({
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
    
    // Timeout fallback
    setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch (e) {}
      reject(new Error('PipeWrench execution timeout'));
    }, (options.timeout || 15000) + 10000);
  });
}

/**
 * Format diagnostic report for chat display
 */
function formatDiagnosticSummary(report) {
  const lines = [];
  
  lines.push('## MCP Diagnostic Report\n');
  
  // Overall status
  const { passed, warned, failed } = report.summary || {};
  if (failed > 0) {
    lines.push(`**Status:** ❌ ${failed} check(s) failed\n`);
  } else if (warned > 0) {
    lines.push(`**Status:** ⚠️ Passed with ${warned} warning(s)\n`);
  } else {
    lines.push(`**Status:** ✅ All checks passed\n`);
  }
  
  // Health score
  if (report.score !== undefined) {
    lines.push(`**Health Score:** ${report.score}%\n`);
  }
  
  // Individual checks
  lines.push('### Checks\n');
  
  for (const rule of (report.rules || [])) {
    const icon = rule.status === 'pass' ? '✅' : rule.status === 'warn' ? '⚠️' : '❌';
    lines.push(`${icon} **${rule.title}**`);
    
    // Show evidence for non-passing checks
    if (rule.status !== 'pass' && rule.evidence?.length > 0) {
      for (const ev of rule.evidence.slice(0, 3)) {
        lines.push(`   → ${ev}`);
      }
    }
    
    // Show fixes for failures
    if (rule.status === 'fail' && rule.fix?.length > 0) {
      lines.push(`   💡 Fix: ${rule.fix[0]}`);
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Format trace output for chat display
 */
function formatTraceSummary(trace) {
  const lines = [];
  
  lines.push('## MCP Trace Results\n');
  
  // Timings
  if (trace.timings) {
    lines.push(`**Duration:** ${trace.timings.duration}ms`);
    if (trace.timings.ttfb) {
      lines.push(`**Time to First Byte:** ${trace.timings.ttfb}ms`);
    }
    lines.push('');
  }
  
  // MCP details
  if (trace.mcp) {
    lines.push('### Protocol Details\n');
    lines.push(`- **Transport:** ${trace.mcp.transport}`);
    lines.push(`- **Framing:** ${trace.mcp.framing}`);
    lines.push(`- **Initialized:** ${trace.mcp.initialized ? 'Yes' : 'No'}`);
    lines.push(`- **Tools Found:** ${trace.mcp.tools?.length || 0}`);
    
    if (trace.mcp.tools?.length > 0) {
      lines.push('\n**Available Tools:**');
      for (const tool of trace.mcp.tools.slice(0, 10)) {
        lines.push(`- ${tool}`);
      }
      if (trace.mcp.tools.length > 10) {
        lines.push(`- ... and ${trace.mcp.tools.length - 10} more`);
      }
    }
    lines.push('');
  }
  
  // Frames
  if (trace.mcp?.frames?.length > 0) {
    lines.push('### Protocol Frames\n');
    lines.push('```json');
    for (const frame of trace.mcp.frames.slice(0, 5)) {
      lines.push(`[${frame.direction}] ${JSON.stringify(frame.data).substring(0, 100)}...`);
    }
    lines.push('```');
  }
  
  // Errors
  if (trace.error) {
    lines.push(`\n**Error:** ${trace.error}`);
  }
  
  return lines.join('\n');
}
