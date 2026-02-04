import { spawn } from 'child_process';

// Test filesystem server with required path argument
const proc = spawn('node', [
  'C:\\Workbench\\node_modules\\@modelcontextprotocol\\server-filesystem\\dist\\index.js',
  'C:\\Workbench'  // Required: allowed path
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

console.log('📤 Sending initialize to filesystem server...');
console.log('Body length:', contentLength);

let buffer = '';

proc.stdout.on('data', (data) => {
  buffer += data.toString();
  console.log('✅ SERVER RESPONSE:', buffer);
  proc.kill();
  process.exit(0);
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
