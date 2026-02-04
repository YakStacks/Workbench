/**
 * PipeWrench - MCP Rules
 * 
 * Diagnostic rules for MCP protocol issues.
 */

import { RuleResult, Status } from '../lib/types.js';
import { defineRule } from '../lib/engine.js';

/**
 * Rule: MCP transport mismatch
 */
export const transportRule = defineRule(
  'mcp.transport',
  'MCP Transport',
  ['mcp', 'transport'],
  (probeResult, target, options) => {
    const result = new RuleResult('mcp.transport', 'MCP Transport');
    result.addTags('mcp', 'transport');
    
    if (!probeResult.mcp) {
      return result.fail('No MCP data collected');
    }
    
    const expectedTransport = target.type === 'mcp-http' ? 'http' : 'stdio';
    
    if (probeResult.mcp.transport !== expectedTransport) {
      return result.fail(
        `Transport mismatch: expected ${expectedTransport}, got ${probeResult.mcp.transport}`,
        'Check that target type matches server transport'
      );
    }
    
    return result.pass(`Transport: ${probeResult.mcp.transport}`);
  }
);

/**
 * Rule: Stdio pollution (non-protocol output)
 */
export const pollutionRule = defineRule(
  'mcp.pollution',
  'Stdout Cleanliness',
  ['mcp', 'stdio', 'pollution'],
  (probeResult, target, options) => {
    const result = new RuleResult('mcp.pollution', 'Stdout Cleanliness');
    result.addTags('mcp', 'stdio', 'pollution');
    
    // Only applies to stdio transport
    if (!probeResult.mcp || probeResult.mcp.transport === 'http') {
      return result.pass('N/A (HTTP transport)');
    }
    
    const pollution = probeResult.mcp.pollution || [];
    
    if (pollution.length > 0) {
      result.fail(
        `Non-protocol output on stdout (${pollution.length} items)`,
        'Log messages must go to stderr, not stdout - stdout is reserved for MCP protocol'
      );
      
      for (const item of pollution.slice(0, 3)) {
        result.addEvidence(`→ "${item.content.substring(0, 50)}..."`);
      }
      
      return result;
    }
    
    return result.pass('No stdout pollution detected');
  }
);

/**
 * Rule: MCP framing detection
 */
export const framingRule = defineRule(
  'mcp.framing',
  'MCP Framing',
  ['mcp', 'framing'],
  (probeResult, target, options) => {
    const result = new RuleResult('mcp.framing', 'MCP Framing');
    result.addTags('mcp', 'framing');
    
    if (!probeResult.mcp) {
      return result.fail('No MCP data collected');
    }
    
    const framing = probeResult.mcp.framing;
    
    if (framing === 'unknown') {
      return result.fail(
        'Could not detect framing type',
        'Server may not be responding with valid MCP messages'
      );
    }
    
    // Check for framing errors in frames
    const frames = probeResult.mcp.frames || [];
    let framingErrors = 0;
    
    for (const frame of frames) {
      if (frame.error) {
        framingErrors++;
      }
    }
    
    if (framingErrors > 0) {
      return result.warn(
        `${framingErrors} framing error(s) detected`,
        'Check for Content-Length mismatches or partial frames'
      );
    }
    
    return result.pass(`Framing: ${framing}`);
  }
);

/**
 * Rule: JSON-RPC validity
 */
export const jsonrpcRule = defineRule(
  'mcp.jsonrpc',
  'JSON-RPC Validity',
  ['mcp', 'jsonrpc', 'protocol'],
  (probeResult, target, options) => {
    const result = new RuleResult('mcp.jsonrpc', 'JSON-RPC Validity');
    result.addTags('mcp', 'jsonrpc', 'protocol');
    
    if (!probeResult.mcp) {
      return result.fail('No MCP data collected');
    }
    
    const frames = probeResult.mcp.frames || [];
    
    if (frames.length === 0) {
      return result.fail(
        'No JSON-RPC messages received',
        'Server may not be responding or framing is incorrect'
      );
    }
    
    let errors = [];
    
    for (const frame of frames) {
      const data = frame.data;
      
      if (!data) continue;
      
      // Check jsonrpc version
      if (data.jsonrpc !== '2.0') {
        errors.push(`Missing or wrong jsonrpc version: ${data.jsonrpc}`);
      }
      
      // Response must have result or error
      if (data.id !== undefined && data.result === undefined && data.error === undefined) {
        errors.push(`Response #${data.id} has neither result nor error`);
      }
    }
    
    if (errors.length > 0) {
      result.fail('Invalid JSON-RPC messages');
      for (const err of errors.slice(0, 3)) {
        result.addEvidence(err);
      }
      result.addFix('Ensure server returns valid JSON-RPC 2.0 responses');
      return result;
    }
    
    return result.pass('JSON-RPC messages are valid');
  }
);

/**
 * Rule: Initialize success
 */
export const initializeRule = defineRule(
  'mcp.initialize',
  'MCP Initialize',
  ['mcp', 'initialize', 'handshake'],
  (probeResult, target, options) => {
    const result = new RuleResult('mcp.initialize', 'MCP Initialize');
    result.addTags('mcp', 'initialize', 'handshake');
    
    if (!probeResult.mcp) {
      return result.fail('No MCP data collected');
    }
    
    if (!probeResult.mcp.initialized) {
      if (probeResult.error?.includes('Timeout')) {
        return result.fail(
          'Initialize request timed out',
          'Server is too slow to respond - defer heavy work until after handshake'
        );
      }
      
      if (probeResult.error?.includes('exited')) {
        return result.fail(
          probeResult.error,
          'Server crashed during initialization - check logs'
        );
      }
      
      return result.fail(
        'Initialize handshake failed',
        'Check that server implements MCP protocol correctly'
      );
    }
    
    // Check protocol version
    const response = probeResult.mcp.initializeResponse;
    if (response?.protocolVersion) {
      result.addEvidence(`Protocol version: ${response.protocolVersion}`);
    }
    
    // Check timing
    const ttfb = probeResult.timings?.ttfb || 0;
    if (ttfb > 3000) {
      return result.warn(
        `Initialize took ${ttfb}ms (slow)`,
        'Consider deferring expensive operations until after handshake'
      );
    }
    
    return result.pass(`Initialize succeeded in ${ttfb}ms`);
  }
);

/**
 * Rule: Tools list
 */
export const toolsRule = defineRule(
  'mcp.tools',
  'MCP Tools List',
  ['mcp', 'tools'],
  (probeResult, target, options) => {
    const result = new RuleResult('mcp.tools', 'MCP Tools List');
    result.addTags('mcp', 'tools');
    
    if (!probeResult.mcp) {
      return result.fail('No MCP data collected');
    }
    
    if (!probeResult.mcp.initialized) {
      return result.fail('Cannot list tools - initialize failed');
    }
    
    const tools = probeResult.mcp.tools || [];
    
    if (tools.length === 0) {
      return result.warn(
        'No tools returned from tools/list',
        'Server may not expose any tools, or tools/list failed'
      );
    }
    
    result.addEvidence(`${tools.length} tools available`);
    if (tools.length <= 5) {
      for (const tool of tools) {
        result.addEvidence(`→ ${tool}`);
      }
    }
    
    return result.pass(`${tools.length} tools available`);
  }
);

/**
 * Rule: HTTP endpoint issues
 */
export const httpEndpointRule = defineRule(
  'mcp.http-endpoint',
  'MCP HTTP Endpoint',
  ['mcp', 'http'],
  (probeResult, target, options) => {
    const result = new RuleResult('mcp.http-endpoint', 'MCP HTTP Endpoint');
    result.addTags('mcp', 'http');
    
    if (target.type !== 'mcp-http') {
      return result.pass('N/A (stdio transport)');
    }
    
    if (!probeResult.error) {
      return result.pass('HTTP endpoint reachable');
    }
    
    if (probeResult.error.includes('Connection refused')) {
      return result.fail(
        'Connection refused',
        'Check that server is running and port is correct'
      );
    }
    
    if (probeResult.error.includes('404')) {
      return result.fail(
        'HTTP 404 Not Found',
        'Check URL path - try /mcp or /'
      );
    }
    
    if (probeResult.error.includes('405')) {
      return result.fail(
        'HTTP 405 Method Not Allowed',
        'Endpoint may not accept POST requests'
      );
    }
    
    return result.fail(probeResult.error);
  }
);

/**
 * Rule: Response timing
 */
export const timingRule = defineRule(
  'mcp.timing',
  'Response Timing',
  ['mcp', 'timing'],
  (probeResult, target, options) => {
    const result = new RuleResult('mcp.timing', 'Response Timing');
    result.addTags('mcp', 'timing');
    
    const duration = probeResult.timings?.duration || 0;
    const ttfb = probeResult.timings?.ttfb || 0;
    
    if (duration === 0 && ttfb === 0) {
      return result.pass('N/A');
    }
    
    result.addEvidence(`Total: ${duration}ms, TTFB: ${ttfb}ms`);
    
    if (ttfb > 5000) {
      return result.warn(
        `Slow response: ${ttfb}ms to first byte`,
        'Server is slow to respond - may timeout in some clients'
      );
    }
    
    return result.pass(`Response time: ${duration}ms`);
  }
);

/**
 * All MCP rules
 */
export const allRules = [
  transportRule,
  pollutionRule,
  framingRule,
  jsonrpcRule,
  initializeRule,
  toolsRule,
  httpEndpointRule,
  timingRule
];

export default { allRules };
