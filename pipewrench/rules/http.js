/**
 * PipeWrench - HTTP Rules
 * 
 * Diagnostic rules for HTTP endpoints.
 */

import { RuleResult, Status } from '../lib/types.js';
import { defineRule } from '../lib/engine.js';

/**
 * Rule: Connection refused / cannot resolve host
 */
export const connectionRule = defineRule(
  'http.connection',
  'HTTP Connection',
  ['http', 'connection'],
  (probeResult, target, options) => {
    const result = new RuleResult('http.connection', 'HTTP Connection');
    result.addTags('http', 'connection');
    
    if (probeResult.error) {
      if (probeResult.error.includes('Connection refused')) {
        return result.fail(
          `Connection refused to ${target.url}`,
          'Check that the server is running and the port is correct'
        );
      }
      if (probeResult.error.includes('Host not found') || probeResult.error.includes('ENOTFOUND')) {
        return result.fail(
          `Cannot resolve host: ${target.url}`,
          'Check the hostname/URL spelling, or try using IP address'
        );
      }
      if (probeResult.error.includes('Timeout')) {
        return result.fail(
          probeResult.error,
          'Server may be slow, unreachable, or blocked by firewall'
        );
      }
      return result.fail(probeResult.error);
    }
    
    return result.pass(`Connected to ${target.url}`);
  }
);

/**
 * Rule: Response timing (slow vs timeout)
 */
export const timingRule = defineRule(
  'http.timing',
  'Response Timing',
  ['http', 'timing'],
  (probeResult, target, options) => {
    const result = new RuleResult('http.timing', 'Response Timing');
    result.addTags('http', 'timing');
    
    const slowThreshold = options.slowThreshold || 2000;
    const duration = probeResult.timings?.duration || 0;
    
    if (duration > slowThreshold) {
      return result.warn(
        `Slow response: ${duration}ms (threshold: ${slowThreshold}ms)`,
        'Consider optimizing server response time'
      );
    }
    
    return result.pass(`Response time: ${duration}ms`);
  }
);

/**
 * Rule: HTTP status code
 */
export const statusCodeRule = defineRule(
  'http.status',
  'HTTP Status Code',
  ['http', 'status'],
  (probeResult, target, options) => {
    const result = new RuleResult('http.status', 'HTTP Status Code');
    result.addTags('http', 'status');
    
    if (!probeResult.http) {
      return result.fail('No HTTP response received');
    }
    
    const status = probeResult.http.status;
    
    if (status >= 200 && status < 300) {
      return result.pass(`Status ${status} ${probeResult.http.statusText}`);
    }
    
    if (status === 401) {
      return result.fail(
        `401 Unauthorized`,
        'Authentication required - check API key or credentials'
      );
    }
    
    if (status === 403) {
      return result.fail(
        `403 Forbidden`,
        'Access denied - check permissions or API key scope'
      );
    }
    
    if (status === 404) {
      return result.fail(
        `404 Not Found`,
        'Check the URL path - endpoint may not exist'
      );
    }
    
    if (status === 405) {
      return result.fail(
        `405 Method Not Allowed`,
        'Try using a different HTTP method (GET/POST/etc)'
      );
    }
    
    if (status >= 500) {
      return result.fail(
        `${status} Server Error`,
        'Server-side error - check server logs'
      );
    }
    
    if (status >= 300 && status < 400) {
      return result.warn(
        `${status} Redirect`,
        'Response was redirected - check final destination'
      );
    }
    
    return result.warn(`Unexpected status: ${status}`);
  }
);

/**
 * Rule: Content-Type validation
 */
export const contentTypeRule = defineRule(
  'http.content-type',
  'Content-Type Header',
  ['http', 'json'],
  (probeResult, target, options) => {
    const result = new RuleResult('http.content-type', 'Content-Type Header');
    result.addTags('http', 'json');
    
    if (!probeResult.http) return result.pass('N/A');
    
    const contentType = probeResult.http.contentType || '';
    const expectJson = options.expectJson !== false; // Default to expecting JSON
    
    if (expectJson && !contentType.includes('application/json')) {
      // Check if body looks like JSON anyway
      const body = probeResult.http.body || '';
      if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
        return result.warn(
          `Content-Type is '${contentType}' but body appears to be JSON`,
          'Server should set Content-Type: application/json'
        );
      }
      
      // Check if it's an HTML error page
      if (contentType.includes('text/html')) {
        return result.fail(
          'Response is HTML (likely an error page)',
          'Check if the URL is correct and server is returning JSON'
        );
      }
      
      return result.warn(`Content-Type: ${contentType} (expected JSON)`);
    }
    
    return result.pass(`Content-Type: ${contentType}`);
  }
);

/**
 * Rule: TLS/Certificate errors
 */
export const tlsRule = defineRule(
  'http.tls',
  'TLS/Certificate',
  ['http', 'tls', 'security'],
  (probeResult, target, options) => {
    const result = new RuleResult('http.tls', 'TLS/Certificate');
    result.addTags('http', 'tls', 'security');
    
    // Only applies to HTTPS
    if (!target.url?.startsWith('https://')) {
      return result.pass('N/A (not HTTPS)');
    }
    
    if (probeResult.http?.tlsError) {
      return result.fail(
        `TLS error: ${probeResult.http.tlsError}`,
        'Check certificate validity, or use --insecure flag if testing locally'
      );
    }
    
    if (probeResult.error?.includes('certificate')) {
      return result.fail(
        probeResult.error,
        'Certificate error - may be self-signed or expired'
      );
    }
    
    return result.pass('TLS connection OK');
  }
);

/**
 * Rule: localhost vs 127.0.0.1 check
 */
export const localhostRule = defineRule(
  'http.localhost',
  'Localhost Binding',
  ['http', 'localhost'],
  (probeResult, target, options) => {
    const result = new RuleResult('http.localhost', 'Localhost Binding');
    result.addTags('http', 'localhost');
    
    // Only check on connection refused
    if (!probeResult.error?.includes('Connection refused')) {
      return result.pass('N/A');
    }
    
    const url = target.url || '';
    if (url.includes('localhost')) {
      return result.warn(
        'Connection refused on localhost',
        'Try using 127.0.0.1 instead - some servers only bind to IP'
      );
    }
    
    if (url.includes('127.0.0.1')) {
      return result.warn(
        'Connection refused on 127.0.0.1',
        'Try using localhost instead, or check if server is bound to a different interface'
      );
    }
    
    return result.pass('N/A');
  }
);

/**
 * All HTTP rules
 */
export const allRules = [
  connectionRule,
  timingRule,
  statusCodeRule,
  contentTypeRule,
  tlsRule,
  localhostRule
];

export default { allRules };
