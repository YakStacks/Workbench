#!/usr/bin/env node

/**
 * PipeWrench CLI - MCP Connection Diagnostic Tool
 * 
 * Usage:
 *   pipewrench doctor <target>     Run diagnostics
 *   pipewrench trace <target>      Trace I/O
 *   pipewrench proxy [--port N]    Start TCP proxy
 *   pipewrench help                Show help
 */

import { parseTarget, TargetType, ExitCode } from './lib/types.js';
import { runDiagnostics, calculateScore } from './lib/engine.js';
import { formatTerminal, formatJSON, formatTrace, printProgress, printError } from './lib/reporter.js';
import * as httpProbe from './probes/http.js';
import * as commandProbe from './probes/command.js';
import * as mcpProbe from './probes/mcp.js';
import { allRules as httpRules } from './rules/http.js';
import { allRules as commandRules } from './rules/command.js';
import { allRules as mcpRules } from './rules/mcp.js';
import { MCPProxy } from './index.js';

const args = process.argv.slice(2);

// Parse global options
let jsonOutput = false;
let timeout = 10000;
let verbose = false;

// Extract global flags
const filteredArgs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') {
    jsonOutput = true;
  } else if (args[i] === '--timeout' && args[i + 1]) {
    timeout = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    verbose = true;
  } else {
    filteredArgs.push(args[i]);
  }
}

const command = filteredArgs[0];

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                         PipeWrench                           ║
║           MCP Connection Diagnostic & Debug Tool             ║
╚══════════════════════════════════════════════════════════════╝

USAGE:
  pipewrench <command> [target] [options]

COMMANDS:
  doctor <target>       Run diagnostics on a target
  trace <target>        Capture detailed I/O trace
  proxy [--port N]      Start TCP proxy server
  help                  Show this help

TARGETS:
  http://...            HTTP endpoint
  cmd:<command>         Execute and diagnose a command
  stdio:<command>       Test stdio-based server
  mcp-http:<url>        MCP server over HTTP (V2)
  mcp-stdio:<command>   MCP server over stdio (V2)

GLOBAL OPTIONS:
  --json                Output as JSON (for CI)
  --timeout <ms>        Set timeout (default: 10000)
  --verbose, -v         Show more details

EXAMPLES:
  # Test HTTP endpoint
  pipewrench doctor http://localhost:3000

  # Test command execution
  pipewrench doctor "cmd:node server.js"

  # Test with JSON output
  pipewrench doctor http://localhost:3000 --json

  # Start proxy for Workbench
  pipewrench proxy --port 9999

EXIT CODES:
  0    All checks passed
  1    Warnings present
  2    Failures present
  3    Tool/runtime error
`);
}

async function runDoctor() {
  const targetArg = filteredArgs.slice(1).join(' ');
  
  if (!targetArg) {
    printError('No target specified');
    console.log('Usage: pipewrench doctor <target>');
    console.log('Example: pipewrench doctor http://localhost:3000');
    process.exit(ExitCode.ERROR);
  }
  
  const target = parseTarget(targetArg);
  
  if (!jsonOutput) {
    printProgress(`Diagnosing ${target.type} target: ${target.raw}`);
  }
  
  let probe, rules;
  
  switch (target.type) {
    case TargetType.HTTP:
      probe = httpProbe;
      rules = httpRules;
      break;
    case TargetType.CMD:
    case TargetType.STDIO:
      probe = commandProbe;
      rules = commandRules;
      break;
    case TargetType.MCP_HTTP:
    case TargetType.MCP_STDIO:
      probe = mcpProbe;
      rules = mcpRules;
      break;
    default:
      printError(`Target type '${target.type}' not yet supported`);
      printError('Supported: http://, cmd:, stdio:, mcp-http:, mcp-stdio:');
      process.exit(ExitCode.ERROR);
  }
  
  try {
    const report = await runDiagnostics(target, probe, rules, { timeout, verbose });
    
    if (jsonOutput) {
      console.log(formatJSON(report));
    } else {
      console.log(formatTerminal(report, { verbose }));
      
      // Show score
      const score = calculateScore(report);
      console.log(`Health Score: ${score}%`);
    }
    
    process.exit(report.getExitCode());
  } catch (e) {
    printError(e.message);
    process.exit(ExitCode.ERROR);
  }
}

async function runTrace() {
  const targetArg = filteredArgs.slice(1).join(' ');
  
  if (!targetArg) {
    printError('No target specified');
    console.log('Usage: pipewrench trace <target>');
    process.exit(ExitCode.ERROR);
  }
  
  const target = parseTarget(targetArg);
  
  if (!jsonOutput) {
    printProgress(`Tracing ${target.type} target: ${target.raw}`);
  }
  
  let probe;
  
  switch (target.type) {
    case TargetType.HTTP:
      probe = httpProbe;
      break;
    case TargetType.CMD:
    case TargetType.STDIO:
      probe = commandProbe;
      break;
    case TargetType.MCP_HTTP:
    case TargetType.MCP_STDIO:
      probe = mcpProbe;
      break;
    default:
      printError(`Target type '${target.type}' not yet supported`);
      process.exit(ExitCode.ERROR);
  }
  
  try {
    const probeResult = await probe.run(target, { timeout });
    
    if (jsonOutput) {
      console.log(JSON.stringify(probeResult, null, 2));
    } else {
      console.log(formatTrace(probeResult, { maxBodySize: 2000 }));
    }
    
    process.exit(probeResult.success ? ExitCode.PASS : ExitCode.FAIL);
  } catch (e) {
    printError(e.message);
    process.exit(ExitCode.ERROR);
  }
}

async function runProxy() {
  let port = 9999;
  
  for (let i = 1; i < filteredArgs.length; i++) {
    if (filteredArgs[i] === '--port' && filteredArgs[i + 1]) {
      port = parseInt(filteredArgs[i + 1], 10);
      i++;
    }
  }
  
  const proxy = new MCPProxy({ port });
  
  proxy.on('listening', ({ host, port }) => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              PipeWrench MCP Proxy Server                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`   Listening on: ${host}:${port}`);
    console.log('');
    console.log('   Connect from Workbench using TCP transport');
    console.log('   or send JSON commands directly:');
    console.log('');
    console.log('   {"type":"connect","command":"npx","args":["-y","@modelcontextprotocol/server-memory"]}');
    console.log('   {"type":"message","payload":{"jsonrpc":"2.0","id":1,"method":"initialize",...}}');
    console.log('   {"type":"disconnect"}');
    console.log('');
    console.log('   Press Ctrl+C to stop');
    console.log('');
  });
  
  proxy.on('connection', ({ id }) => {
    console.log(`[${new Date().toISOString()}] Client connected (id: ${id})`);
  });
  
  proxy.on('disconnection', ({ id }) => {
    console.log(`[${new Date().toISOString()}] Client disconnected (id: ${id})`);
  });
  
  try {
    await proxy.start();
  } catch (err) {
    printError(`Failed to start proxy: ${err.message}`);
    process.exit(ExitCode.ERROR);
  }
  
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    proxy.stop();
    process.exit(0);
  });
}

// Main entry point
switch (command) {
  case 'doctor':
    runDoctor();
    break;
    
  case 'trace':
    runTrace();
    break;
    
  case 'proxy':
    runProxy();
    break;
  
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    printHelp();
    break;
  
  default:
    printError(`Unknown command: ${command}`);
    console.log('Run "pipewrench help" for usage information');
    process.exit(ExitCode.ERROR);
}
