/**
 * PipeWrench - MCP Probe
 * 
 * Tests MCP servers over stdio or HTTP, capturing protocol details.
 */

import { spawn } from 'child_process';
import { ProbeResult } from '../lib/types.js';

/**
 * MCP framing types
 */
export const MCPFraming = {
  LINE_DELIMITED: 'line-delimited',
  CONTENT_LENGTH: 'content-length',
  UNKNOWN: 'unknown'
};

/**
 * Run MCP probe against a stdio target
 * 
 * @param {Object} target - { type: 'mcp-stdio', command: string, args: string[] }
 * @param {Object} options - { timeout: number }
 * @returns {ProbeResult}
 */
export async function run(target, options = {}) {
  const result = new ProbeResult(target.type);
  const timeout = options.timeout || 15000;
  const maxOutputSize = options.maxOutputSize || 50000;
  
  const startTime = Date.now();
  result.timings.start = startTime;
  
  // Determine transport type
  if (target.type === 'mcp-http') {
    return runHttpMcp(target, options, result);
  }
  
  // Default: stdio MCP
  return runStdioMcp(target, options, result);
}

/**
 * Run MCP over stdio
 */
async function runStdioMcp(target, options, result) {
  const timeout = options.timeout || 15000;
  const maxOutputSize = options.maxOutputSize || 50000;
  const startTime = result.timings.start;
  
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let spawned = false;
    let initialized = false;
    let initSent = false;
    let finalized = false;
    let detectedFraming = MCPFraming.UNKNOWN;
    const frames = [];
    const pollution = [];
    let tools = [];
    let initializeResponse = null;
    
    const finalize = (error = null) => {
      if (finalized) return;
      finalized = true;
      
      const endTime = Date.now();
      result.timings.end = endTime;
      result.timings.duration = endTime - startTime;
      result.error = error;
      
      result.setMcpResult({
        transport: 'stdio',
        framing: detectedFraming,
        initialized,
        initializeResponse,
        tools,
        frames,
        pollution
      });
      
      result.rawOutput = stdout.substring(0, maxOutputSize);
      result.rawError = stderr.substring(0, maxOutputSize);
      
      try { proc?.kill('SIGTERM'); } catch (e) {}
      resolve(result);
    };
    
    let proc = null;
    
    try {
      const isWindows = process.platform === 'win32';
      let spawnCmd = target.command;
      let spawnArgs = target.args || [];
      
      // Handle npx on Windows - use shell mode to avoid EINVAL
      if (target.command === 'npx' && isWindows) {
        spawnCmd = 'npx.cmd';
      }
      
      // Clean environment for MCP
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_CHANNEL_FD;
      cleanEnv.ELECTRON_RUN_AS_NODE = '1';
      
      // On Windows, we need shell mode to avoid EINVAL errors
      proc = spawn(spawnCmd, spawnArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: isWindows,
        windowsHide: true,
        env: cleanEnv
      });
      
      spawned = true;
      
      const timeoutId = setTimeout(() => {
        finalize('Timeout waiting for MCP response');
      }, timeout);
      
      // Track stdout for protocol analysis
      let buffer = '';
      let firstJsonSeen = false;
      
      proc.stdout?.on('data', (chunk) => {
        if (finalized) return;
        
        const data = chunk.toString();
        stdout += data;
        buffer += data;
        
        // Detect pollution (non-protocol output before first JSON)
        if (!firstJsonSeen) {
          const lines = data.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            if (trimmed.startsWith('{')) {
              firstJsonSeen = true;
              break;
            } else if (!trimmed.startsWith('Content-Length')) {
              pollution.push({
                type: 'stdout',
                content: trimmed.substring(0, 100),
                timestamp: Date.now() - startTime
              });
            }
          }
        }
        
        // Try to parse frames
        parseFrames(buffer, frames, (f) => {
          detectedFraming = f;
        });
        
        // Check for initialize response
        for (const frame of frames) {
          if (frame.data?.result?.protocolVersion && !initialized) {
            initialized = true;
            initializeResponse = frame.data.result;
            result.timings.ttfb = Date.now() - startTime;
            
            // Send tools/list
            sendToolsList(proc, detectedFraming);
          }
          
          if (frame.data?.result?.tools && !tools.length) {
            tools = frame.data.result.tools.map(t => t.name);
            // We have tools, finish successfully
            clearTimeout(timeoutId);
            finalize();
          }
        }
      });
      
      proc.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      
      proc.on('error', (err) => {
        if (err.message.includes('ENOENT')) {
          finalize(`Command not found: ${target.command}`);
        } else {
          finalize(`Spawn error: ${err.message}`);
        }
      });
      
      proc.on('exit', (code, signal) => {
        // Only finalize on exit if we tried to initialize and failed
        if (initSent && !initialized) {
          finalize(`Process exited before initialization (code: ${code}, signal: ${signal})`);
        }
      });
      
      // Wait a bit for server to start, then send initialize
      setTimeout(() => {
        if (!finalized && proc?.stdin?.writable) {
          initSent = true;
          sendInitialize(proc, MCPFraming.LINE_DELIMITED);
          
          // Also try Content-Length framing after a bit
          setTimeout(() => {
            if (!initialized && !finalized && proc?.stdin?.writable) {
              sendInitialize(proc, MCPFraming.CONTENT_LENGTH);
            }
          }, 1000);
        }
      }, 500);
      
    } catch (e) {
      finalize(`Setup error: ${e.message}`);
    }
  });
}

/**
 * Run MCP over HTTP
 */
async function runHttpMcp(target, options, result) {
  const timeout = options.timeout || 15000;
  const startTime = result.timings.start;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Send initialize request
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
    
    const response = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(initRequest),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const ttfb = Date.now() - startTime;
    result.timings.ttfb = ttfb;
    
    const body = await response.text();
    
    result.timings.end = Date.now();
    result.timings.duration = result.timings.end - startTime;
    
    let initializeResponse = null;
    let initialized = false;
    const frames = [];
    
    try {
      const parsed = JSON.parse(body);
      frames.push({ direction: 'recv', data: parsed, timestamp: ttfb });
      
      if (parsed.result?.protocolVersion) {
        initialized = true;
        initializeResponse = parsed.result;
      }
    } catch (e) {
      result.error = `Invalid JSON response: ${e.message}`;
    }
    
    // Try to get tools list
    let tools = [];
    if (initialized) {
      try {
        const listRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        };
        
        const listResponse = await fetch(target.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(listRequest)
        });
        
        const listBody = await listResponse.text();
        const listParsed = JSON.parse(listBody);
        frames.push({ direction: 'recv', data: listParsed, timestamp: Date.now() - startTime });
        
        if (listParsed.result?.tools) {
          tools = listParsed.result.tools.map(t => t.name);
        }
      } catch (e) {
        // Tools list failed, continue
      }
    }
    
    result.setMcpResult({
      transport: 'http',
      framing: 'http',
      initialized,
      initializeResponse,
      tools,
      frames,
      pollution: []
    });
    
    result.rawOutput = body;
    
  } catch (e) {
    result.timings.end = Date.now();
    result.timings.duration = result.timings.end - startTime;
    
    if (e.name === 'AbortError') {
      result.error = `Timeout after ${timeout}ms`;
    } else if (e.message.includes('ECONNREFUSED')) {
      result.error = 'Connection refused';
    } else {
      result.error = e.message;
    }
    
    result.setMcpResult({
      transport: 'http',
      framing: 'http',
      initialized: false,
      initializeResponse: null,
      tools: [],
      frames: [],
      pollution: []
    });
  }
  
  return result;
}

/**
 * Parse MCP frames from buffer
 */
function parseFrames(buffer, frames, onFramingDetected) {
  // Try Content-Length framing first
  const clMatch = buffer.match(/Content-Length:\s*(\d+)\r?\n\r?\n/);
  if (clMatch) {
    onFramingDetected(MCPFraming.CONTENT_LENGTH);
    const length = parseInt(clMatch[1], 10);
    const headerEnd = buffer.indexOf(clMatch[0]) + clMatch[0].length;
    if (buffer.length >= headerEnd + length) {
      const body = buffer.substring(headerEnd, headerEnd + length);
      try {
        const data = JSON.parse(body);
        if (!frames.some(f => JSON.stringify(f.data) === JSON.stringify(data))) {
          frames.push({ direction: 'recv', data, timestamp: Date.now() });
        }
      } catch (e) {}
    }
    return;
  }
  
  // Try line-delimited JSON
  const lines = buffer.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{')) {
      onFramingDetected(MCPFraming.LINE_DELIMITED);
      try {
        const data = JSON.parse(trimmed);
        if (!frames.some(f => JSON.stringify(f.data) === JSON.stringify(data))) {
          frames.push({ direction: 'recv', data, timestamp: Date.now() });
        }
      } catch (e) {}
    }
  }
}

/**
 * Send initialize request
 */
function sendInitialize(proc, framing) {
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'PipeWrench', version: '0.1.0' }
    }
  };
  
  const body = JSON.stringify(request);
  
  if (framing === MCPFraming.CONTENT_LENGTH) {
    const length = Buffer.byteLength(body, 'utf8');
    proc.stdin?.write(`Content-Length: ${length}\r\n\r\n${body}`);
  } else {
    proc.stdin?.write(body + '\n');
  }
}

/**
 * Send tools/list request
 */
function sendToolsList(proc, framing) {
  const request = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  
  const body = JSON.stringify(request);
  
  // Send initialized notification first
  const notification = JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  });
  
  if (framing === MCPFraming.CONTENT_LENGTH) {
    const nLen = Buffer.byteLength(notification, 'utf8');
    proc.stdin?.write(`Content-Length: ${nLen}\r\n\r\n${notification}`);
    const len = Buffer.byteLength(body, 'utf8');
    proc.stdin?.write(`Content-Length: ${len}\r\n\r\n${body}`);
  } else {
    proc.stdin?.write(notification + '\n');
    proc.stdin?.write(body + '\n');
  }
}

export default { run, MCPFraming };
