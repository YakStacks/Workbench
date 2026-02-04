/**
 * PipeWrench Plugin for Workbench
 * 
 * Diagnose MCP server connection issues from within Workbench.
 * Inlines the PipeWrench core logic to run diagnostics directly.
 */

const path = require('path');

module.exports.register = (api) => {
  
  // Doctor Tool
  api.registerTool({
    name: 'debug.mcpDoctor',
    description: 'Diagnose MCP server connection issues. Returns detailed diagnostic report with pass/warn/fail status for each check.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { 
          type: 'string', 
          description: 'Target to diagnose. Examples: "mcp-stdio:npx -y @modelcontextprotocol/server-memory"'
        },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default: 15000)' },
        verbose: { type: 'boolean', description: 'Include detailed evidence' }
      },
      required: ['target']
    },
    run: async (input) => {
      try {
        // Dynamic import of ESM modules
        const { parseTarget, TargetType } = await import('./lib/types.js');
        const { runDiagnostics, calculateScore } = await import('./lib/engine.js');
        const { formatTerminal } = await import('./lib/reporter.js');
        
        const target = parseTarget(input.target);
        const timeout = input.timeout || 15000;
        const verbose = input.verbose || false;
        
        let probe, rules;
        
        // Select probe and rules based on target type
        switch (target.type) {
          case 'http':
          case 'https':
            probe = await import('./probes/http.js');
            const httpRules = await import('./rules/http.js');
            rules = httpRules.allRules;
            break;
            
          case 'cmd':
          case 'stdio':
            probe = await import('./probes/command.js');
            const cmdRules = await import('./rules/command.js');
            rules = cmdRules.allRules;
            break;
            
          case 'mcp-http':
          case 'mcp-stdio':
            probe = await import('./probes/mcp.js');
            const mcpRules = await import('./rules/mcp.js');
            rules = mcpRules.allRules;
            break;
            
          default:
            return {
              content: `Error: Target type '${target.type}' not supported`,
              metadata: { error: true }
            };
        }
        
        // Run diagnostics
        const report = await runDiagnostics(target, probe, rules, { timeout, verbose });
        
        // Format output using the reporter logic, but adapted for markdown
        const summary = formatDiagnosticSummary(report);
        
        return {
          content: summary,
          metadata: {
            exitCode: report.getExitCode(),
            passed: report.summary.passed,
            warned: report.summary.warned,
            failed: report.summary.failed,
            score: calculateScore(report),
            target: input.target,
            rawReport: report
          }
        };
      } catch (e) {
        return { 
          content: `Diagnostic error: ${e.message}`, 
          metadata: { error: true, message: e.message } 
        };
      }
    }
  });

  // Trace Tool
  api.registerTool({
    name: 'debug.mcpTrace',
    description: 'Capture detailed I/O trace from an MCP server.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target to trace' },
        timeout: { type: 'number', description: 'Timeout in milliseconds' }
      },
      required: ['target']
    },
    run: async (input) => {
      try {
        const { parseTarget } = await import('./lib/types.js');
        const target = parseTarget(input.target);
        const timeout = input.timeout || 15000;
        
        let probe;
        switch (target.type) {
          case 'http': case 'https': probe = await import('./probes/http.js'); break;
          case 'cmd': case 'stdio': probe = await import('./probes/command.js'); break;
          case 'mcp-http': case 'mcp-stdio': probe = await import('./probes/mcp.js'); break;
          default: throw new Error(`Unsupported target type: ${target.type}`);
        }
        
        const result = await probe.run(target, { timeout });
        
        // Format trace summary
        const summary = formatTraceSummary(result);
        
        return {
          content: summary,
          metadata: result
        };
      } catch (e) {
        return { content: `Trace error: ${e.message}`, metadata: { error: true } };
      }
    }
  });
  
  // Test Tool (Simplified)
  api.registerTool({
    name: 'debug.mcpTest',
    description: 'Quick test if an MCP server can connect.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        args: { type: 'string' }
      },
      required: ['command']
    },
    run: async (input) => {
      const args = input.args || '';
      const targetStr = `mcp-stdio:${input.command} ${args}`.trim();
      
      try {
        // Reuse doctor logic
        const { parseTarget } = await import('./lib/types.js');
        const { runDiagnostics } = await import('./lib/engine.js');
        const probe = await import('./probes/mcp.js');
        const rulesMod = await import('./rules/mcp.js');
        
        const target = parseTarget(targetStr);
        const report = await runDiagnostics(target, probe, rulesMod.allRules, { timeout: 15000 });
        
        const passed = report.summary.failed === 0;
        
        if (passed) {
           return {
             content: `✅ MCP server connected successfully!`,
             metadata: { success: true }
           };
        } else {
           const failures = report.rules.filter(r => r.status === 'fail');
           return {
             content: `❌ Connection failed:\n${failures.map(f => `• ${f.title}: ${f.evidence[0]}`).join('\n')}`,
             metadata: { success: false, failures: failures.length }
           };
        }
      } catch (e) {
        return { content: `Test error: ${e.message}`, metadata: { error: true } };
      }
    }
  });

};

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
