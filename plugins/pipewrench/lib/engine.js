/**
 * PipeWrench - Engine
 * 
 * Rule runner that executes probes and rules, aggregates results.
 */

import { DiagnosticReport, Status, ExitCode } from './types.js';

/**
 * Run diagnostics on a target
 * 
 * @param {Object} target - Parsed target object
 * @param {Object} probe - Probe module for this target type
 * @param {Object[]} rules - Array of rule functions
 * @param {Object} options - Runtime options (timeout, etc.)
 * @returns {DiagnosticReport}
 */
export async function runDiagnostics(target, probe, rules, options = {}) {
  const report = new DiagnosticReport(target);
  const timeout = options.timeout || 10000;
  
  try {
    // Phase 1: Run probe to collect facts
    const probeResult = await Promise.race([
      probe.run(target, options),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Probe timeout')), timeout)
      )
    ]);
    
    report.probeResult = probeResult;
    
    // Phase 2: Run rules against probe results
    for (const rule of rules) {
      try {
        const result = await rule(probeResult, target, options);
        if (result) {
          report.addRuleResult(result);
        }
      } catch (e) {
        // Rule threw an error - create a fail result
        const errorResult = {
          id: rule.id || 'unknown',
          title: rule.title || 'Rule Error',
          status: Status.FAIL,
          evidence: [`Rule threw error: ${e.message}`],
          fix: [],
          links: [],
          tags: ['error']
        };
        report.addRuleResult(errorResult);
      }
    }
    
  } catch (e) {
    // Probe failed entirely
    report.probeResult = {
      success: false,
      error: e.message,
      timings: { start: Date.now(), end: Date.now(), duration: 0 }
    };
  }
  
  return report;
}

/**
 * Calculate a health score from a report (0-100)
 */
export function calculateScore(report) {
  if (report.summary.total === 0) return 100;
  
  const weights = {
    pass: 1,
    warn: 0.5,
    fail: 0
  };
  
  const score = (
    (report.summary.passed * weights.pass) +
    (report.summary.warned * weights.warn) +
    (report.summary.failed * weights.fail)
  ) / report.summary.total * 100;
  
  return Math.round(score);
}

/**
 * Get overall status from report
 */
export function getOverallStatus(report) {
  if (report.summary.failed > 0) return Status.FAIL;
  if (report.summary.warned > 0) return Status.WARN;
  return Status.PASS;
}

/**
 * Filter rules by tags
 */
export function filterRulesByTags(rules, includeTags = [], excludeTags = []) {
  return rules.filter(rule => {
    const ruleTags = rule.tags || [];
    
    // If include tags specified, rule must have at least one
    if (includeTags.length > 0) {
      if (!includeTags.some(t => ruleTags.includes(t))) {
        return false;
      }
    }
    
    // If exclude tags specified, rule must not have any
    if (excludeTags.length > 0) {
      if (excludeTags.some(t => ruleTags.includes(t))) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Create a rule function with metadata
 */
export function defineRule(id, title, tags, fn) {
  const rule = async (probeResult, target, options) => {
    return fn(probeResult, target, options);
  };
  rule.id = id;
  rule.title = title;
  rule.tags = tags;
  return rule;
}

export default {
  runDiagnostics,
  calculateScore,
  getOverallStatus,
  filterRulesByTags,
  defineRule
};
