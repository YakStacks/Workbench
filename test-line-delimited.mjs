import { spawn } from 'child_process';

// Test with line-delimited JSON (no Content-Length framing)
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

// Try line-delimited JSON (just newline, no Content-Length)
const message = body + '\n';

console.log('📤 Sending initialize with line-delimited JSON...');
console.log('Message:', message);

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

proc.stdin.write(message, 'utf8', (err) => {
  if (err) {
    console.error('❌ Write error:', err);
  } else {
    console.log('✅ Message sent');
  }
});

setTimeout(() => {
  console.log('⏰ Timeout - no response received');
  proc.kill();
  process.exit(1);
}, 5000);
