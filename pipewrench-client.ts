/**
 * PipeWrench Client for Workbench
 * 
 * Connects to PipeWrench proxy server via TCP to communicate with MCP servers.
 * This bypasses Electron's broken stdio pipes on Windows.
 * 
 * Usage in Workbench main.ts:
 * 
 *   import { PipeWrenchClient } from './pipewrench-client';
 *   
 *   const client = new PipeWrenchClient({ port: 9999 });
 *   await client.connect();
 *   
 *   // Connect to an MCP server through PipeWrench
 *   await client.connectServer('memory', 'npx', ['-y', '@modelcontextprotocol/server-memory']);
 *   
 *   // Send MCP request
 *   const response = await client.request('memory', {
 *     method: 'tools/list',
 *     params: {}
 *   });
 */

import { Socket } from 'net';
import { EventEmitter } from 'events';

export interface PipeWrenchOptions {
  host?: string;
  port?: number;
  reconnect?: boolean;
  reconnectDelay?: number;
}

export interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class PipeWrenchClient extends EventEmitter {
  private socket: Socket | null = null;
  private host: string;
  private port: number;
  private reconnect: boolean;
  private reconnectDelay: number;
  private connected: boolean = false;
  private buffer: string = '';
  private requestId: number = 1;
  private pendingRequests: Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private serverStates: Map<string, 'connecting' | 'connected' | 'disconnected' | 'error'> = new Map();
  
  constructor(options: PipeWrenchOptions = {}) {
    super();
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 9999;
    this.reconnect = options.reconnect ?? true;
    this.reconnectDelay = options.reconnectDelay || 3000;
  }
  
  /**
   * Connect to PipeWrench proxy server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new Socket();
      
      this.socket.on('connect', () => {
        this.connected = true;
        this.emit('connected');
        resolve();
      });
      
      this.socket.on('data', (chunk) => {
        this.handleData(chunk.toString());
      });
      
      this.socket.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
        
        if (this.reconnect) {
          setTimeout(() => this.connect().catch(() => {}), this.reconnectDelay);
        }
      });
      
      this.socket.on('error', (err) => {
        this.emit('error', err);
        if (!this.connected) {
          reject(err);
        }
      });
      
      this.socket.connect(this.port, this.host);
    });
  }
  
  /**
   * Disconnect from PipeWrench
   */
  disconnect(): void {
    this.reconnect = false;
    this.socket?.destroy();
    this.socket = null;
    this.connected = false;
  }
  
  /**
   * Check if connected to PipeWrench
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Connect to an MCP server through PipeWrench
   */
  async connectServer(name: string, command: string, args: string[] = [], framing: string = 'line-delimited'): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to PipeWrench proxy');
    }
    
    this.serverStates.set(name, 'connecting');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.serverStates.set(name, 'error');
        reject(new Error('Server connection timeout'));
      }, 30000);
      
      // Listen for connected message
      const handler = (serverName: string, status: string) => {
        if (serverName === name) {
          clearTimeout(timeout);
          this.off('serverStatus', handler);
          
          if (status === 'connected') {
            resolve();
          } else {
            reject(new Error(`Server connection failed: ${status}`));
          }
        }
      };
      
      this.on('serverStatus', handler);
      
      // Send connect command
      this.send({
        type: 'connect',
        name,
        command,
        args,
        framing
      });
    });
  }
  
  /**
   * Disconnect an MCP server
   */
  disconnectServer(name: string): void {
    this.send({
      type: 'disconnect',
      name
    });
    this.serverStates.set(name, 'disconnected');
  }
  
  /**
   * Send an MCP request and wait for response
   */
  async request(serverName: string, request: MCPRequest, timeout: number = 30000): Promise<MCPResponse> {
    if (!this.connected) {
      throw new Error('Not connected to PipeWrench proxy');
    }
    
    const id = this.requestId++;
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, timeout);
      
      this.pendingRequests.set(id, { resolve, reject, timeout: timeoutId });
      
      this.send({
        type: 'message',
        name: serverName,
        payload: {
          jsonrpc: '2.0',
          id,
          method: request.method,
          params: request.params || {}
        }
      });
    });
  }
  
  /**
   * Initialize an MCP server (required before using tools)
   */
  async initialize(serverName: string): Promise<MCPResponse> {
    return this.request(serverName, {
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'Workbench', version: '0.1.0' }
      }
    });
  }
  
  /**
   * List available tools from an MCP server
   */
  async listTools(serverName: string): Promise<string[]> {
    const response = await this.request(serverName, {
      method: 'tools/list',
      params: {}
    });
    
    if (response.result && typeof response.result === 'object' && 'tools' in response.result) {
      const tools = (response.result as { tools: Array<{ name: string }> }).tools;
      return tools.map(t => t.name);
    }
    
    return [];
  }
  
  /**
   * Call a tool on an MCP server
   */
  async callTool(serverName: string, toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const response = await this.request(serverName, {
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.result;
  }
  
  /**
   * Get the state of a connected server
   */
  getServerState(name: string): string {
    return this.serverStates.get(name) || 'disconnected';
  }
  
  /**
   * Get all connected servers
   */
  getConnectedServers(): string[] {
    return Array.from(this.serverStates.entries())
      .filter(([_, state]) => state === 'connected')
      .map(([name, _]) => name);
  }
  
  // Private methods
  
  private send(data: object): void {
    if (this.socket && this.connected) {
      this.socket.write(JSON.stringify(data) + '\n');
    }
  }
  
  private handleData(data: string): void {
    this.buffer += data;
    
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const msg = JSON.parse(line);
        this.handleMessage(msg);
      } catch (e) {
        console.error('[PipeWrench] Failed to parse message:', line);
      }
    }
  }
  
  private handleMessage(msg: any): void {
    switch (msg.type) {
      case 'connected':
        // Server connected through PipeWrench
        if (msg.name) {
          this.serverStates.set(msg.name, 'connected');
          this.emit('serverStatus', msg.name, 'connected');
          this.emit('serverConnected', msg.name, msg.command, msg.args);
        }
        break;
        
      case 'message':
        // MCP response from server
        if (msg.payload && typeof msg.payload.id === 'number') {
          const pending = this.pendingRequests.get(msg.payload.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(msg.payload.id);
            pending.resolve(msg.payload);
          }
        }
        this.emit('mcpMessage', msg.name, msg.payload);
        break;
        
      case 'stderr':
        // Server stderr output
        this.emit('serverStderr', msg.name, msg.data);
        break;
        
      case 'error':
        // Error from PipeWrench or server
        this.emit('serverError', msg.name, msg.error);
        if (msg.name) {
          this.serverStates.set(msg.name, 'error');
          this.emit('serverStatus', msg.name, 'error');
        }
        break;
        
      case 'exit':
        // Server process exited
        if (msg.name) {
          this.serverStates.set(msg.name, 'disconnected');
          this.emit('serverStatus', msg.name, 'disconnected');
          this.emit('serverExit', msg.name, msg.code, msg.signal);
        }
        break;
    }
  }
}

export default PipeWrenchClient;
