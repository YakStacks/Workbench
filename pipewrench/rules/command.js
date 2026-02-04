/**
 * PipeWrench - Command Rules
 * 
 * Diagnostic rules for command execution.
 */

import { RuleResult, Status } from '../lib/types.js';
import { defineRule } from '../lib/engine.js';

/**
 * Rule: Command exists and can be spawned
 */
export const spawnRule = defineRule(
  'cmd.spawn',
  'Command Spawn',
  ['cmd', 'spawn'],
  (probeResult, target, options) => {
    const result = new RuleResult('cmd.spawn', 'Command Spawn');
    result.addTags('cmd', 'spawn');
    
    if (!probeResult.command?.spawned) {
      if (probeResult.error?.includes('Command not found') || probeResult.error?.includes('ENOENT')) {
        return result.fail(
          `Command not found: ${target.command}`,
          'Check that the command is installed and in PATH'
        );
      }
      if (probeResult.error?.includes('Permission denied') || probeResult.error?.includes('EACCES')) {
        return result.fail(
          `Permission denied: ${target.command}`,
          'Check file permissions (chmod +x on Unix)'
        );
      }
      return result.fail(probeResult.error || 'Failed to spawn command');
    }
    
    return result.pass(`Command spawned: ${target.command}`);
  }
);

/**
 * Rule: Exit code check
 */
export const exitCodeRule = defineRule(
  'cmd.exit',
  'Exit Code',
  ['cmd', 'exit'],
  (probeResult, target, options) => {
    const result = new RuleResult('cmd.exit', 'Exit Code');
    result.addTags('cmd', 'exit');
    
    if (!probeResult.command) {
      return result.fail('No command result');
    }
    
    const exitCode = probeResult.command.exitCode;
    const signal = probeResult.command.signal;
    
    if (signal) {
      return result.fail(
        `Command killed by signal: ${signal}`,
        'Process was terminated, possibly by timeout or external kill'
      );
    }
    
    if (exitCode === 0) {
      return result.pass('Exit code: 0');
    }
    
    if (exitCode === 1) {
      return result.fail(
        'Exit code: 1 (general error)',
        'Check stderr for error message'
      );
    }
    
    if (exitCode === 127) {
      return result.fail(
        'Exit code: 127 (command not found in shell)',
        'Check PATH or use absolute path'
      );
    }
    
    if (exitCode === 126) {
      return result.fail(
        'Exit code: 126 (permission denied)',
        'Make the file executable (chmod +x)'
      );
    }
    
    return result.fail(
      `Exit code: ${exitCode}`,
      'Check stderr for error details'
    );
  }
);

/**
 * Rule: Exits too fast (for servers)
 */
export const exitsTooFastRule = defineRule(
  'cmd.exits-fast',
  'Server Persistence',
  ['cmd', 'server'],
  (probeResult, target, options) => {
    const result = new RuleResult('cmd.exits-fast', 'Server Persistence');
    result.addTags('cmd', 'server');
    
    // Only check if explicitly testing a server
    if (!options.expectServer) {
      return result.pass('N/A (not testing as server)');
    }
    
    const duration = probeResult.timings?.duration || 0;
    const fastExitThreshold = options.fastExitThreshold || 1000;
    
    if (duration < fastExitThreshold && probeResult.command?.exitCode !== null) {
      return result.fail(
        `Server exited in ${duration}ms (expected to stay running)`,
        'Check if command requires additional arguments or configuration'
      );
    }
    
    return result.pass('Server stayed running');
  }
);

/**
 * Rule: Stdout pollution (for stdio protocols)
 */
export const stdoutPollutionRule = defineRule(
  'cmd.stdout-pollution',
  'Stdout Cleanliness',
  ['cmd', 'stdio', 'protocol'],
  (probeResult, target, options) => {
    const result = new RuleResult('cmd.stdout-pollution', 'Stdout Cleanliness');
    result.addTags('cmd', 'stdio', 'protocol');
    
    if (!probeResult.command?.stdout) {
      return result.pass('No stdout captured');
    }
    
    const stdout = probeResult.command.stdout;
    const lines = stdout.split('\n').filter(l => l.trim());
    
    // Check for common non-protocol output
    const pollutionPatterns = [
      /^npm WARN/i,
      /^npm notice/i,
      /^Debugger attached/i,
      /^Waiting for the debugger/i,
      /^Server listening/i,
      /^Started server/i,
      /^\[INFO\]/i,
      /^\[DEBUG\]/i,
      /^Loaded/i,
      /^Initializing/i
    ];
    
    const pollutedLines = [];
    for (const line of lines) {
      // Skip empty and JSON lines
      if (!line.trim() || line.trim().startsWith('{')) continue;
      
      // Check against patterns
      for (const pattern of pollutionPatterns) {
        if (pattern.test(line)) {
          pollutedLines.push(line.substring(0, 60));
          break;
        }
      }
      
      // Also flag any non-JSON lines before JSON
      if (!line.trim().startsWith('{') && !line.includes('Content-Length')) {
        const firstJsonIndex = stdout.indexOf('{');
        const lineIndex = stdout.indexOf(line);
        if (firstJsonIndex > 0 && lineIndex < firstJsonIndex) {
          if (!pollutedLines.includes(line.substring(0, 60))) {
            pollutedLines.push(line.substring(0, 60));
          }
        }
      }
    }
    
    if (pollutedLines.length > 0) {
      result.warn(
        `Non-protocol output on stdout (${pollutedLines.length} lines)`,
        'Log messages should go to stderr, not stdout'
      );
      for (const line of pollutedLines.slice(0, 3)) {
        result.addEvidence(`→ ${line}...`);
      }
      return result;
    }
    
    return result.pass('Stdout appears clean');
  }
);

/**
 * Rule: Missing environment variables
 */
export const envVarsRule = defineRule(
  'cmd.env',
  'Environment Variables',
  ['cmd', 'env', 'config'],
  (probeResult, target, options) => {
    const result = new RuleResult('cmd.env', 'Environment Variables');
    result.addTags('cmd', 'env', 'config');
    
    const stderr = probeResult.command?.stderr || '';
    const stdout = probeResult.command?.stdout || '';
    const output = stderr + stdout;
    
    // Common API key patterns
    const envPatterns = [
      { pattern: /OPENAI_API_KEY.*not set|missing.*OPENAI_API_KEY/i, name: 'OPENAI_API_KEY' },
      { pattern: /ANTHROPIC_API_KEY.*not set|missing.*ANTHROPIC_API_KEY/i, name: 'ANTHROPIC_API_KEY' },
      { pattern: /API_KEY.*not set|missing.*API_KEY/i, name: 'API_KEY' },
      { pattern: /GOOGLE.*KEY.*not|missing.*GOOGLE/i, name: 'GOOGLE_API_KEY' },
      { pattern: /DATABASE_URL.*not|missing.*DATABASE/i, name: 'DATABASE_URL' },
    ];
    
    const missingVars = [];
    for (const { pattern, name } of envPatterns) {
      if (pattern.test(output)) {
        missingVars.push(name);
      }
    }
    
    if (missingVars.length > 0) {
      result.warn(
        `Possible missing environment variable(s): ${missingVars.join(', ')}`,
        'Set required environment variables before running'
      );
      return result;
    }
    
    return result.pass('No env var issues detected');
  }
);

/**
 * Rule: Stderr contains errors
 */
export const stderrRule = defineRule(
  'cmd.stderr',
  'Stderr Output',
  ['cmd', 'stderr'],
  (probeResult, target, options) => {
    const result = new RuleResult('cmd.stderr', 'Stderr Output');
    result.addTags('cmd', 'stderr');
    
    const stderr = probeResult.command?.stderr || '';
    
    if (!stderr.trim()) {
      return result.pass('No stderr output');
    }
    
    // Check for error indicators
    const errorPatterns = [
      /^error:/im,
      /^fatal:/im,
      /unhandled.*exception/i,
      /cannot find module/i,
      /module not found/i,
      /syntax error/i,
      /reference error/i,
      /type error/i
    ];
    
    for (const pattern of errorPatterns) {
      if (pattern.test(stderr)) {
        const match = stderr.match(pattern);
        const context = stderr.substring(stderr.indexOf(match[0]), stderr.indexOf(match[0]) + 100);
        return result.fail(
          `Error detected in stderr: ${context.split('\n')[0]}`,
          'Fix the error shown in stderr'
        );
      }
    }
    
    // Has stderr but no obvious error - just warn
    if (stderr.length > 100) {
      return result.warn(
        `Stderr has output (${stderr.length} chars)`,
        'Review stderr for potential issues'
      );
    }
    
    return result.pass(`Stderr: ${stderr.length} chars (no errors detected)`);
  }
);

/**
 * All command rules
 */
export const allRules = [
  spawnRule,
  exitCodeRule,
  exitsTooFastRule,
  stdoutPollutionRule,
  envVarsRule,
  stderrRule
];

export default { allRules };
