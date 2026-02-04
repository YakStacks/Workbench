/**
 * PipeWrench - HTTP Probe
 * 
 * Collects facts about HTTP endpoints: reachability, timing, headers, body.
 */

import { ProbeResult } from '../lib/types.js';

/**
 * Run HTTP probe against a target
 * 
 * @param {Object} target - { type: 'http', url: string }
 * @param {Object} options - { timeout: number }
 * @returns {ProbeResult}
 */
export async function run(target, options = {}) {
  const result = new ProbeResult('http');
  const timeout = options.timeout || 10000;
  const maxBodySize = options.maxBodySize || 10000;
  
  const startTime = Date.now();
  result.timings.start = startTime;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    let ttfbTime = 0;
    
    const response = await fetch(target.url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    ttfbTime = Date.now() - startTime;
    
    // Read body (with size cap)
    let body = '';
    let bodySize = 0;
    
    try {
      const text = await response.text();
      bodySize = text.length;
      body = text.substring(0, maxBodySize);
    } catch (e) {
      body = `[Error reading body: ${e.message}]`;
    }
    
    const endTime = Date.now();
    result.timings.end = endTime;
    result.timings.duration = endTime - startTime;
    result.timings.ttfb = ttfbTime;
    
    // Collect headers
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    result.setHttpResult({
      status: response.status,
      statusText: response.statusText,
      headers: headers,
      body: body,
      bodySize: bodySize,
      contentType: headers['content-type'] || '',
      redirects: response.redirected ? ['(redirected)'] : [],
      tlsError: null
    });
    
    result.success = response.ok;
    
  } catch (e) {
    const endTime = Date.now();
    result.timings.end = endTime;
    result.timings.duration = endTime - startTime;
    result.error = e.message;
    
    // Categorize the error
    if (e.name === 'AbortError') {
      result.error = `Timeout after ${timeout}ms`;
    } else if (e.message.includes('ECONNREFUSED')) {
      result.error = 'Connection refused';
    } else if (e.message.includes('ENOTFOUND')) {
      result.error = 'Host not found (DNS error)';
    } else if (e.message.includes('certificate')) {
      result.error = `TLS/Certificate error: ${e.message}`;
      result.setHttpResult({
        status: 0,
        statusText: 'TLS Error',
        headers: {},
        body: '',
        bodySize: 0,
        contentType: '',
        redirects: [],
        tlsError: e.message
      });
    }
    
    result.success = false;
  }
  
  return result;
}

export default { run };
