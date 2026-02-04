/**
 * PipeWrench - MCP Connection Diagnostic & Proxy Tool
 * 
 * Solves the stdio pipe issues between Electron and MCP servers on Windows
 * by acting as a standalone Node.js proxy process.
 */

import { spawn } from 'child_process';
import { createServer } from 'net';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';

/**
 * Framing types supported by MCP servers
 */
export const FramingType = {
  LINE_DELIMITED: 'line-delimited',
  CONTENT_LENGTH: 'content-length',
  UNKNOWN: 'unknown'
};

/**
 * Diagnostic results from testing an MCP server
 */
export class DiagnosticResult {
  constructor() {
    this.serverFound = false;
    this.serverStarted = false;
    this.stdinWritable = false;
    this.stdoutReadable = false;
    this.stderrOutput = '';
    this.framingType = FramingType.UNKNOWN;
    this.initializeResponse = null;
    this.tools = [];
    this.error = null;
    this.timings = {
      spawn: 0,
      firstStderr: 0,
      firstStdout: 0,
      initializeResponse: 0
    };
  }

  toJSON() {
    return {
      success: this.serverStarted && this.initializeResponse !== null,
      serverFound: this.serverFound,
      serverStarted: this.serverStarted,
      stdinWritable: this.stdinWritable,
      stdoutReadable: this.stdoutReadable,
      stderrOutput: this.stderrOutput,
      framingType: this.framingType,
      initializeResponse: this.initializeResponse,
      tools: this.tools,
      error: this.error,
      timings: this.timings
    };
  }

  toString() {
    const lines = [
      '╔══════════════════════════════════════════════════════════════╗',
      '║                    PipeWrench Diagnostic                     ║',
      '╠══════════════════════════════════════════════════════════════╣'
    ];

    const status = (ok) => ok ? '✅' : '❌';
    
    lines.push(`║  Server Found:      ${status(this.serverFound).padEnd(40)}║`);
    lines.push(`║  Server Started:    ${status(this.serverStarted).padEnd(40)}║`);
    lines.push(`║  Stdin Writable:    ${status(this.stdinWritable).padEnd(40)}║`);
    lines.push(`║  Stdout Readable:   ${status(this.stdoutReadable).padEnd(40)}║`);
    lines.push(`║  Initialize OK:     ${status(this.initializeResponse !== null).padEnd(40)}║`);
    lines.push(`║  Framing Type:      ${this.framingType.padEnd(40)}║`);
    
    if (this.tools.length > 0) {
      lines.push(`║  Tools Available:   ${String(this.tools.length).padEnd(40)}║`);
    }
    
    if (this.error) {
      lines.push('╠══════════════════════════════════════════════════════════════╣');
      lines.push(`║  Error: ${this.error.substring(0, 52).padEnd(52)}║`);
    }
    
    lines.push('╠══════════════════════════════════════════════════════════════╣');
    lines.push(`║  Spawn Time:        ${(this.timings.spawn + 'ms').padEnd(40)}║`);
    if (this.timings.initializeResponse > 0) {
      lines.push(`║  Response Time:     ${(this.timings.initializeResponse + 'ms').padEnd(40)}║`);
    }
    
    lines.push('╚══════════════════════════════════════════════════════════════╝');
    
    return lines.join('\n');
  }
}

/**
 * Resolve an MCP server command to an executable path
 */
export function resolveServerPath(command, args = []) {
  const result = {
    command: command,
    args: args,
    resolvedPath: null,
    isNpx: false,
    packageName: null,
    localModulePath: null
  };

  // Check if it's an npx command
  if (command === 'npx' && args.length > 0) {
    result.isNpx = true;
    
    // Extract package name (skip -y flag if present)
    const pkgIndex = args[0] === '-y' ? 1 : 0;
    result.packageName = args[pkgIndex];
    
    // Try to find locally installed package
    const possiblePaths = [
      // Local node_modules
      path.join(process.cwd(), 'node_modules', result.packageName, 'dist', 'index.js'),
      path.join(process.cwd(), 'node_modules', '.bin', result.packageName.split('/').pop()),
      // Global node_modules
      path.join(process.env.APPDATA || '', 'npm', 'node_modules', result.packageName, 'dist', 'index.js')
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        result.localModulePath = p;
        break;
      }
    }
  }
  
  return result;
}

/**
 * Test both framing types and return which one works
 */
export async function detectFraming(command, args = [], timeout = 10000) {
  // Try line-delimited first (more common)
  const lineResult = await testConnection(command, args, FramingType.LINE_DELIMITED, timeout);
  if (lineResult.initializeResponse) {
    return lineResult;
  }
  
  // Try content-length framing
  const clResult = await testConnection(command, args, FramingType.CONTENT_LENGTH, timeout);
  if (clResult.initializeResponse) {
    return clResult;
  }
  
  // Return the line-delimited result (has more diagnostic info)
  return lineResult;
}

/**
 * Test connection to an MCP server with specific framing
 */
export async function testConnection(command, args = [], framingType = FramingType.LINE_DELIMITED, timeout = 10000) {
  const result = new DiagnosticResult();
  result.framingType = framingType;
  
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    let proc;
    let resolved = false;
    let buffer = '';
    
    const finish = (error = null) => {
      if (resolved) return;
      resolved = true;
      
      if (error) result.error = error;
      
      try {
        proc?.kill('SIGTERM');
      } catch (e) {}
      
      resolve(result);
    };
    
    const timeoutId = setTimeout(() => {
      finish('Connection timeout after ' + timeout + 'ms');
    }, timeout);
    
    try {
      // Resolve the server path
      const resolved = resolveServerPath(command, args);
      
      let spawnCmd, spawnArgs;
      
      if (resolved.localModulePath && resolved.localModulePath.endsWith('.js')) {
        // Spawn node directly with the module
        spawnCmd = 'node';
        spawnArgs = [resolved.localModulePath, ...args.slice(resolved.isNpx ? 2 : 0)];
        result.serverFound = true;
      } else if (resolved.isNpx) {
        // Use npx (less reliable on Windows)
        spawnCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        spawnArgs = args;
      } else {
        spawnCmd = command;
        spawnArgs = args;
      }
      
      proc = spawn(spawnCmd, spawnArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true
      });
      
      result.timings.spawn = Date.now() - startTime;
      result.serverStarted = true;
      
      proc.on('error', (err) => {
        result.serverStarted = false;
        finish('Spawn error: ' + err.message);
      });
      
      proc.on('exit', (code, signal) => {
        if (!result.initializeResponse) {
          finish(`Process exited early (code: ${code}, signal: ${signal})`);
        }
      });
      
      // Check stdin
      result.stdinWritable = proc.stdin?.writable ?? false;
      
      // Handle stderr
      proc.stderr?.on('data', (chunk) => {
        if (result.timings.firstStderr === 0) {
          result.timings.firstStderr = Date.now() - startTime;
        }
        result.stderrOutput += chunk.toString();
      });
      
      // Handle stdout
      proc.stdout?.on('data', (chunk) => {
        if (result.timings.firstStdout === 0) {
          result.timings.firstStdout = Date.now() - startTime;
        }
        result.stdoutReadable = true;
        
        buffer += chunk.toString();
        
        // Try to parse response based on framing type
        try {
          let message;
          
          if (framingType === FramingType.LINE_DELIMITED) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.trim().startsWith('{')) {
                message = JSON.parse(line.trim());
                break;
              }
            }
          } else {
            // Content-Length framing
            const headerEnd = buffer.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
              const header = buffer.substring(0, headerEnd);
              const match = header.match(/Content-Length:\s*(\d+)/i);
              if (match) {
                const length = parseInt(match[1], 10);
                const bodyStart = headerEnd + 4;
                if (buffer.length >= bodyStart + length) {
                  const body = buffer.substring(bodyStart, bodyStart + length);
                  message = JSON.parse(body);
                }
              }
            }
          }
          
          if (message && message.result) {
            result.timings.initializeResponse = Date.now() - startTime;
            result.initializeResponse = message.result;
            clearTimeout(timeoutId);
            
            // Try to get tools list
            listTools(proc, framingType).then((tools) => {
              result.tools = tools;
              finish();
            }).catch(() => finish());
          }
        } catch (e) {
          // Keep buffering
        }
      });
      
      // Send initialize request after a short delay
      setTimeout(() => {
        const initRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'PipeWrench', version: '0.1.0' }
          }
        };
        
        const body = JSON.stringify(initRequest);
        let message;
        
        if (framingType === FramingType.LINE_DELIMITED) {
          message = body + '\n';
        } else {
          const length = Buffer.byteLength(body, 'utf8');
          message = `Content-Length: ${length}\r\n\r\n${body}`;
        }
        
        proc.stdin?.write(message);
      }, 100);
      
    } catch (err) {
      finish('Setup error: ' + err.message);
    }
  });
}

/**
 * Request tools list from server
 */
async function listTools(proc, framingType) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 5000);
    
    let buffer = '';
    const handler = (chunk) => {
      buffer += chunk.toString();
      
      try {
        let message;
        if (framingType === FramingType.LINE_DELIMITED) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.trim().startsWith('{') && line.includes('"tools"')) {
              message = JSON.parse(line.trim());
              break;
            }
          }
        }
        
        if (message?.result?.tools) {
          clearTimeout(timeout);
          proc.stdout?.off('data', handler);
          resolve(message.result.tools.map(t => t.name));
        }
      } catch (e) {}
    };
    
    proc.stdout?.on('data', handler);
    
    const listRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };
    
    const body = JSON.stringify(listRequest);
    const message = framingType === FramingType.LINE_DELIMITED 
      ? body + '\n'
      : `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
    
    proc.stdin?.write(message);
  });
}

/**
 * MCP Proxy Server - bridges TCP to stdio
 * 
 * Workbench connects via TCP, PipeWrench handles stdio to MCP server
 */
export class MCPProxy extends EventEmitter {
  constructor(options = {}) {
    super();
    this.port = options.port || 0; // 0 = auto-assign
    this.host = options.host || '127.0.0.1';
    this.server = null;
    this.connections = new Map(); // connectionId -> { socket, proc, framing }
    this.nextId = 1;
  }
  
  async start() {
    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => {
        this.handleConnection(socket);
      });
      
      this.server.on('error', reject);
      
      this.server.listen(this.port, this.host, () => {
        const addr = this.server.address();
        this.port = addr.port;
        this.emit('listening', { host: this.host, port: this.port });
        resolve({ host: this.host, port: this.port });
      });
    });
  }
  
  stop() {
    // Kill all MCP processes
    for (const conn of this.connections.values()) {
      try {
        conn.proc?.kill('SIGTERM');
        conn.socket?.destroy();
      } catch (e) {}
    }
    this.connections.clear();
    
    this.server?.close();
  }
  
  handleConnection(socket) {
    const connId = this.nextId++;
    let proc = null;
    let buffer = '';
    let framing = FramingType.LINE_DELIMITED;
    
    this.emit('connection', { id: connId });
    
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      
      // Parse commands from client
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const cmd = JSON.parse(line);
          
          if (cmd.type === 'connect') {
            // Spawn MCP server
            this.spawnServer(connId, socket, cmd.command, cmd.args || [], cmd.framing || framing);
          } else if (cmd.type === 'message' && proc) {
            // Forward to MCP server
            const msg = framing === FramingType.LINE_DELIMITED
              ? JSON.stringify(cmd.payload) + '\n'
              : `Content-Length: ${Buffer.byteLength(JSON.stringify(cmd.payload), 'utf8')}\r\n\r\n${JSON.stringify(cmd.payload)}`;
            proc.stdin?.write(msg);
          } else if (cmd.type === 'disconnect') {
            proc?.kill('SIGTERM');
          }
        } catch (e) {
          this.sendToClient(socket, { type: 'error', error: e.message });
        }
      }
    });
    
    socket.on('close', () => {
      const conn = this.connections.get(connId);
      conn?.proc?.kill('SIGTERM');
      this.connections.delete(connId);
      this.emit('disconnection', { id: connId });
    });
    
    socket.on('error', () => {
      this.connections.delete(connId);
    });
  }
  
  spawnServer(connId, socket, command, args, framing) {
    const resolved = resolveServerPath(command, args);
    
    let spawnCmd, spawnArgs;
    
    if (resolved.localModulePath?.endsWith('.js')) {
      spawnCmd = 'node';
      spawnArgs = [resolved.localModulePath, ...args.slice(resolved.isNpx ? 2 : 0)];
    } else if (resolved.isNpx) {
      spawnCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      spawnArgs = args;
    } else {
      spawnCmd = command;
      spawnArgs = args;
    }
    
    const proc = spawn(spawnCmd, spawnArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true
    });
    
    this.connections.set(connId, { socket, proc, framing });
    
    proc.on('error', (err) => {
      this.sendToClient(socket, { type: 'error', error: err.message });
    });
    
    proc.on('exit', (code, signal) => {
      this.sendToClient(socket, { type: 'exit', code, signal });
    });
    
    proc.stderr?.on('data', (chunk) => {
      this.sendToClient(socket, { type: 'stderr', data: chunk.toString() });
    });
    
    proc.stdout?.on('data', (chunk) => {
      // Parse and forward MCP messages
      const data = chunk.toString();
      
      if (framing === FramingType.LINE_DELIMITED) {
        const lines = data.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            try {
              const msg = JSON.parse(line.trim());
              this.sendToClient(socket, { type: 'message', payload: msg });
            } catch (e) {}
          }
        }
      } else {
        // Forward raw for content-length parsing on client side
        this.sendToClient(socket, { type: 'stdout', data });
      }
    });
    
    this.sendToClient(socket, { type: 'connected', command: spawnCmd, args: spawnArgs });
  }
  
  sendToClient(socket, msg) {
    try {
      socket.write(JSON.stringify(msg) + '\n');
    } catch (e) {}
  }
}

export default {
  DiagnosticResult,
  FramingType,
  resolveServerPath,
  detectFraming,
  testConnection,
  MCPProxy
};
