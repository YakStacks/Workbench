/**
 * PipeWrench - Command Probe
 * 
 * Spawns a command and collects facts: stdout, stderr, exit code, timing.
 */

import { spawn } from 'child_process';
import { ProbeResult } from '../lib/types.js';

/**
 * Run command probe against a target
 * 
 * @param {Object} target - { type: 'cmd', command: string, args: string[] }
 * @param {Object} options - { timeout: number, stayAlive: boolean }
 * @returns {ProbeResult}
 */
export async function run(target, options = {}) {
  const result = new ProbeResult('command');
  const timeout = options.timeout || 10000;
  const maxOutputSize = options.maxOutputSize || 10000;
  const stayAliveCheck = options.stayAliveCheck || false;
  const stayAliveTime = options.stayAliveTime || 500;
  
  const startTime = Date.now();
  result.timings.start = startTime;
  
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let spawned = false;
    let exited = false;
    let exitCode = null;
    let signal = null;
    let startupTime = 0;
    let firstOutputTime = 0;
    
    try {
      // Determine how to spawn the command
      const isWindows = process.platform === 'win32';
      let spawnCmd = target.command;
      let spawnArgs = target.args || [];
      
      // Handle npx on Windows
      if (target.command === 'npx' && isWindows) {
        spawnCmd = 'npx.cmd';
      }
      
      const proc = spawn(spawnCmd, spawnArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
        env: { ...process.env }
      });
      
      spawned = true;
      startupTime = Date.now() - startTime;
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!exited) {
          proc.kill('SIGTERM');
          result.error = `Command timeout after ${timeout}ms`;
        }
      }, timeout);
      
      proc.stdout?.on('data', (chunk) => {
        if (firstOutputTime === 0) {
          firstOutputTime = Date.now() - startTime;
        }
        if (stdout.length < maxOutputSize) {
          stdout += chunk.toString();
        }
      });
      
      proc.stderr?.on('data', (chunk) => {
        if (firstOutputTime === 0) {
          firstOutputTime = Date.now() - startTime;
        }
        if (stderr.length < maxOutputSize) {
          stderr += chunk.toString();
        }
      });
      
      proc.on('error', (err) => {
        exited = true;
        clearTimeout(timeoutId);
        
        const endTime = Date.now();
        result.timings.end = endTime;
        result.timings.duration = endTime - startTime;
        
        // Categorize spawn errors
        if (err.message.includes('ENOENT')) {
          result.error = `Command not found: ${target.command}`;
        } else if (err.message.includes('EACCES')) {
          result.error = `Permission denied: ${target.command}`;
        } else {
          result.error = `Spawn error: ${err.message}`;
        }
        
        result.setCommandResult({
          exitCode: -1,
          signal: null,
          stdout: stdout.substring(0, maxOutputSize),
          stderr: stderr.substring(0, maxOutputSize),
          spawned: false,
          startupTime: startupTime
        });
        
        resolve(result);
      });
      
      // Handle stay-alive check (for servers that should stay running)
      if (stayAliveCheck) {
        setTimeout(() => {
          if (!exited) {
            // Server is still running after stayAliveTime - good
            proc.kill('SIGTERM');
          }
        }, stayAliveTime);
      }
      
      proc.on('exit', (code, sig) => {
        exited = true;
        exitCode = code;
        signal = sig;
        clearTimeout(timeoutId);
        
        const endTime = Date.now();
        result.timings.end = endTime;
        result.timings.duration = endTime - startTime;
        result.timings.ttfb = firstOutputTime;
        
        result.setCommandResult({
          exitCode: exitCode,
          signal: signal,
          stdout: stdout.substring(0, maxOutputSize),
          stderr: stderr.substring(0, maxOutputSize),
          spawned: spawned,
          startupTime: startupTime
        });
        
        resolve(result);
      });
      
    } catch (e) {
      const endTime = Date.now();
      result.timings.end = endTime;
      result.timings.duration = endTime - startTime;
      result.error = `Setup error: ${e.message}`;
      
      result.setCommandResult({
        exitCode: -1,
        signal: null,
        stdout: '',
        stderr: '',
        spawned: false,
        startupTime: 0
      });
      
      resolve(result);
    }
  });
}

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command) {
  const isWindows = process.platform === 'win32';
  const checkCmd = isWindows ? 'where' : 'which';
  
  return new Promise((resolve) => {
    const proc = spawn(checkCmd, [command], { shell: true });
    proc.on('exit', (code) => {
      resolve(code === 0);
    });
    proc.on('error', () => {
      resolve(false);
    });
  });
}

export default { run, commandExists };
