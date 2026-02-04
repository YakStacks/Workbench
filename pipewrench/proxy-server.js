#!/usr/bin/env node
/**
 * PipeWrench Proxy Server - Standalone TCP-to-stdio proxy
 * 
 * Run this as a separate Node.js process, then have Workbench
 * connect via TCP to avoid Electron's stdio issues.
 */

import { MCPProxy } from './index.js';

const PORT = parseInt(process.env.PIPEWRENCH_PORT || '9876', 10);
const HOST = process.env.PIPEWRENCH_HOST || '127.0.0.1';

const proxy = new MCPProxy({ port: PORT, host: HOST });

proxy.on('listening', ({ host, port }) => {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   PipeWrench Proxy Server                    ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Listening on: ${(host + ':' + port).padEnd(45)}║`);
  console.log('║  Status: Ready                                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Waiting for connections...');
});

proxy.on('connection', ({ id }) => {
  console.log(`[${new Date().toISOString()}] Connection #${id} established`);
});

proxy.on('disconnection', ({ id }) => {
  console.log(`[${new Date().toISOString()}] Connection #${id} closed`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down proxy...');
  proxy.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  proxy.stop();
  process.exit(0);
});

// Start the proxy
proxy.start().catch((err) => {
  console.error('Failed to start proxy:', err.message);
  process.exit(1);
});
