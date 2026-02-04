import { spawn } from 'child_process';
import { once } from 'events';

// Spawn Node.js directly, NOT the .cmd wrapper
const proc = spawn('node', [
  'C:\\Workbench\\node_modules\\@modelcontextprotocol\\server-memory\\dist\\index.js'
], {
  stdio: ['pipe', 'pipe', 'inherit'],
  shell: false
});

const body = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0" }
  }
});

const contentLength = Buffer.byteLength(body, 'utf8');
const framedMessage = `Content-Length: ${contentLength}\r\n\r\n${body}`;

console.log('📤 Sending initialize...');
console.log('Body length:', contentLength);

let buffer = '';

proc.stdout.on('data', (data) => {
  buffer += data.toString();
  console.log('✅ SERVER RESPONSE:', buffer);
});

proc.on('error', (err) => {
  console.error('❌ Spawn error:', err);
});

proc.stdin.write(framedMessage, 'utf8', (err) => {
  if (err) {
    console.error('❌ Write error:', err);
  } else {
    console.log('✅ Message flushed to server');
  }
});

setTimeout(() => {
  console.log('⏰ Timeout - no response received');
  proc.kill();
  process.exit(1);
}, 5000);
