/**
 * PipeWrench Test Suite
 */

import { testConnection, detectFraming, resolveServerPath, FramingType } from './index.js';

console.log('PipeWrench Test Suite\n');

// Test 1: resolveServerPath
console.log('Test 1: resolveServerPath');
const resolved = resolveServerPath('npx', ['-y', '@modelcontextprotocol/server-memory']);
console.log('  Input: npx -y @modelcontextprotocol/server-memory');
console.log('  isNpx:', resolved.isNpx);
console.log('  packageName:', resolved.packageName);
console.log('  localModulePath:', resolved.localModulePath || '(not found locally)');
console.log('');

// Test 2: Test connection (if server available)
console.log('Test 2: Connection Test');
console.log('  Attempting to connect to memory server...');

try {
  const result = await testConnection('npx', ['-y', '@modelcontextprotocol/server-memory'], FramingType.LINE_DELIMITED, 15000);
  console.log(result.toString());
  
  if (result.initializeResponse) {
    console.log('✅ Connection test passed!');
  } else {
    console.log('❌ Connection test failed:', result.error);
  }
} catch (err) {
  console.log('❌ Test error:', err.message);
}

console.log('\nTests complete.');
