/**
 * doctorChecks unit tests — Anti-Bloat Doctor Diagnostics.
 *
 * Tests each of the 7 checks defined in the Pegboard spec:
 *   1. HOT tool without active run → FAIL
 *   2. Too many WARM tools → WARN
 *   3. Frequent timeouts/crashes → WARN
 *   4. Zombie processes → FAIL
 *   5. Log growth → WARN
 *   6. Unauthorized daemon tools → FAIL
 *   7. Unexplained background activity → WARN
 *
 * All tests use the pure runDoctorChecks() function with crafted snapshots.
 * No Zustand store, no React, no side effects.
 */

import { describe, it, expect } from 'vitest';
import { runDoctorChecks } from '../doctorChecks';
import type { DoctorCheckInput } from '../doctorChecks';
import type { ToolRecord } from '../toolStore';
import type { ToolManifest } from '../toolManifest';
import { DEFAULT_LIFECYCLE } from '../toolManifest';

// ============================================================================
// HELPERS
// ============================================================================

function makeManifest(overrides: Partial<ToolManifest> = {}): ToolManifest {
  return {
    id: 'test',
    name: 'Test',
    version: '1.0.0',
    description: 'Test tool',
    kind: 'oneshot',
    entry: 'internal:test',
    permissions: {},
    resources: { expectedMemoryMB: 8, expectedCPU: 'low', supportsWarm: false },
    lifecycle: { ...DEFAULT_LIFECYCLE },
    policy: { requiresUserApproval: false, allowDaemon: false },
    tags: [],
    ...overrides,
  };
}

function makeRecord(manifest: ToolManifest, state: ToolRecord['state'] = 'COLD'): ToolRecord {
  return {
    manifest,
    state,
    pinned: false,
    warmSince: state === 'WARM' ? Date.now() - 1000 : null,
    _ttlHandle: null,
  };
}

function makeInput(overrides: Partial<DoctorCheckInput> = {}): DoctorCheckInput {
  return {
    tools: {},
    runs: [],
    budgets: {
      maxHotTools: 2,
      maxConcurrentRuns: 3,
      defaultRunTimeoutMs: 60_000,
      defaultSessionTimeoutMs: 600_000,
      maxTotalToolMemoryMB: 2_000,
    },
    userEnabledDaemonIds: new Set(),
    logLineCap: 1_000,
    ...overrides,
  };
}

// ============================================================================
// CHECK 1 — HOT without active run
// ============================================================================

describe('Check 1 — HOT tool without active run', () => {
  it('PASS when all HOT tools have RUNNING runs', () => {
    const manifest = makeManifest({ id: 'hot-ok' });
    const input = makeInput({
      tools: { 'hot-ok': makeRecord(manifest, 'HOT') },
      runs: [{
        runId: 'r1', toolId: 'hot-ok', status: 'RUNNING',
        queuedAt: Date.now(), startedAt: Date.now(), log: [],
      }],
    });
    const report = runDoctorChecks(input);
    const check = report.results.find((r) => r.id === 'hot-no-run')!;
    expect(check.status).toBe('PASS');
  });

  it('FAIL when HOT tool has no RUNNING run', () => {
    const manifest = makeManifest({ id: 'hot-orphan' });
    const input = makeInput({
      tools: { 'hot-orphan': makeRecord(manifest, 'HOT') },
      runs: [], // no runs at all
    });
    const report = runDoctorChecks(input);
    const check = report.results.find((r) => r.id === 'hot-no-run')!;
    expect(check.status).toBe('FAIL');
    expect(check.message).toContain('Test');
    expect(check.remediation).toBeTruthy();
  });

  it('FAIL only for orphaned HOT tools; healthy HOT tool is not flagged', () => {
    const goodManifest = makeManifest({ id: 'hot-good' });
    const badManifest  = makeManifest({ id: 'hot-bad', name: 'Bad' });
    const input = makeInput({
      tools: {
        'hot-good': makeRecord(goodManifest, 'HOT'),
        'hot-bad':  makeRecord(badManifest, 'HOT'),
      },
      runs: [{
        runId: 'r1', toolId: 'hot-good', status: 'RUNNING',
        queuedAt: Date.now(), log: [],
      }],
    });
    const check = runDoctorChecks(input).results.find((r) => r.id === 'hot-no-run')!;
    expect(check.status).toBe('FAIL');
    expect(check.message).toContain('Bad');
    expect(check.message).not.toContain('Test'); // good tool not in message
  });
});

// ============================================================================
// CHECK 2 — Too many WARM tools
// ============================================================================

describe('Check 2 — Too many WARM tools', () => {
  it('PASS when WARM count is within threshold', () => {
    const tools: Record<string, ToolRecord> = {};
    for (let i = 0; i < 3; i++) {
      const m = makeManifest({ id: `warm-${i}` });
      tools[m.id] = makeRecord(m, 'WARM');
    }
    const report = runDoctorChecks(makeInput({ tools }));
    const check = report.results.find((r) => r.id === 'too-many-warm')!;
    expect(check.status).toBe('PASS');
  });

  it('WARN when WARM count exceeds threshold (> maxHotTools * 3 or > 5)', () => {
    const tools: Record<string, ToolRecord> = {};
    // maxHotTools=2, threshold=max(5,6)=6 → need >6 warm tools for WARN
    for (let i = 0; i < 7; i++) {
      const m = makeManifest({ id: `warm-many-${i}` });
      tools[m.id] = makeRecord(m, 'WARM');
    }
    const report = runDoctorChecks(makeInput({ tools }));
    const check = report.results.find((r) => r.id === 'too-many-warm')!;
    expect(check.status).toBe('WARN');
    expect(check.remediation).toBeTruthy();
  });
});

// ============================================================================
// CHECK 3 — Frequent failures
// ============================================================================

describe('Check 3 — Frequent timeouts/crashes', () => {
  it('PASS when no tool has frequent failures', () => {
    const report = runDoctorChecks(makeInput({
      runs: [
        { runId: 'r1', toolId: 't1', status: 'PASS', queuedAt: 0, log: [] },
        { runId: 'r2', toolId: 't1', status: 'TIMEOUT', queuedAt: 0, log: [] },
      ],
    }));
    const check = report.results.find((r) => r.id === 'frequent-failures')!;
    expect(check.status).toBe('PASS');
  });

  it('WARN when a tool has ≥3 TIMEOUT runs', () => {
    const manifest = makeManifest({ id: 'flaky', name: 'flaky' });
    const runs = Array.from({ length: 3 }, (_, i) => ({
      runId: `r${i}`, toolId: 'flaky', status: 'TIMEOUT' as const,
      queuedAt: 0, log: [],
    }));
    const report = runDoctorChecks(makeInput({
      tools: { flaky: makeRecord(manifest) },
      runs,
    }));
    const check = report.results.find((r) => r.id === 'frequent-failures')!;
    expect(check.status).toBe('WARN');
    expect(check.message).toContain('flaky');
  });

  it('WARN when a tool has ≥5 FAIL runs', () => {
    const manifest = makeManifest({ id: 'crasher', name: 'Crasher' });
    const runs = Array.from({ length: 5 }, (_, i) => ({
      runId: `r${i}`, toolId: 'crasher', status: 'FAIL' as const,
      queuedAt: 0, log: [],
    }));
    const report = runDoctorChecks(makeInput({
      tools: { crasher: makeRecord(manifest) },
      runs,
    }));
    const check = report.results.find((r) => r.id === 'frequent-failures')!;
    expect(check.status).toBe('WARN');
    expect(check.message).toContain('Crasher');
  });
});

// ============================================================================
// CHECK 4 — Zombie processes
// ============================================================================

describe('Check 4 — Zombie processes', () => {
  it('PASS when no HOT tools have terminal-only runs', () => {
    const manifest = makeManifest({ id: 'alive' });
    const report = runDoctorChecks(makeInput({
      tools: { alive: makeRecord(manifest, 'HOT') },
      runs: [{
        runId: 'r1', toolId: 'alive', status: 'RUNNING',
        queuedAt: 0, log: [],
      }],
    }));
    const check = report.results.find((r) => r.id === 'zombie-processes')!;
    expect(check.status).toBe('PASS');
  });

  it('FAIL when HOT tool has only terminal-status runs', () => {
    const manifest = makeManifest({ id: 'zombie' });
    const report = runDoctorChecks(makeInput({
      tools: { zombie: makeRecord(manifest, 'HOT') },
      runs: [{
        runId: 'r1', toolId: 'zombie', status: 'PASS',
        queuedAt: 0, log: [],
      }],
    }));
    const check = report.results.find((r) => r.id === 'zombie-processes')!;
    expect(check.status).toBe('FAIL');
    expect(check.remediation).toBeTruthy();
  });
});

// ============================================================================
// CHECK 5 — Log growth
// ============================================================================

describe('Check 5 — Log growth', () => {
  it('PASS when logs are within bounds', () => {
    const report = runDoctorChecks(makeInput({
      runs: [{
        runId: 'r1', toolId: 't1', status: 'RUNNING',
        queuedAt: 0, log: ['line1', 'line2'],
      }],
      logLineCap: 1_000,
    }));
    const check = report.results.find((r) => r.id === 'log-growth')!;
    expect(check.status).toBe('PASS');
  });

  it('WARN when a run log is at 90% of the cap', () => {
    const cap = 100;
    const log = Array.from({ length: 91 }, (_, i) => `line ${i}`);
    const report = runDoctorChecks(makeInput({
      runs: [{ runId: 'r1', toolId: 't1', status: 'RUNNING', queuedAt: 0, log }],
      logLineCap: cap,
    }));
    const check = report.results.find((r) => r.id === 'log-growth')!;
    expect(check.status).toBe('WARN');
  });
});

// ============================================================================
// CHECK 6 — Unauthorized daemon
// ============================================================================

describe('Check 6 — Unauthorized daemon tools', () => {
  it('PASS when no daemon tools are registered', () => {
    const report = runDoctorChecks(makeInput());
    const check = report.results.find((r) => r.id === 'unauthorized-daemon')!;
    expect(check.status).toBe('PASS');
  });

  it('FAIL when a daemon tool is registered without user enablement', () => {
    const manifest = makeManifest({
      id: 'sneaky-daemon',
      name: 'Sneaky Daemon',
      kind: 'daemon',
      policy: { requiresUserApproval: false, allowDaemon: false },
    });
    const report = runDoctorChecks(makeInput({
      tools: { 'sneaky-daemon': makeRecord(manifest) },
    }));
    const check = report.results.find((r) => r.id === 'unauthorized-daemon')!;
    expect(check.status).toBe('FAIL');
    expect(check.message).toContain('Sneaky Daemon');
  });

  it('PASS when daemon tool is user-enabled', () => {
    const manifest = makeManifest({
      id: 'allowed-daemon',
      kind: 'daemon',
      policy: { requiresUserApproval: false, allowDaemon: true },
    });
    const report = runDoctorChecks(makeInput({
      tools: { 'allowed-daemon': makeRecord(manifest) },
      userEnabledDaemonIds: new Set(['allowed-daemon']),
    }));
    const check = report.results.find((r) => r.id === 'unauthorized-daemon')!;
    expect(check.status).toBe('PASS');
  });
});

// ============================================================================
// CHECK 7 — Unexplained background activity
// ============================================================================

describe('Check 7 — Unexplained background activity', () => {
  it('PASS when WARM/HOT tools have run records', () => {
    const manifest = makeManifest({ id: 'explained' });
    const report = runDoctorChecks(makeInput({
      tools: { explained: makeRecord(manifest, 'WARM') },
      runs: [{ runId: 'r1', toolId: 'explained', status: 'PASS', queuedAt: 0, log: [] }],
    }));
    const check = report.results.find((r) => r.id === 'unexplained-activity')!;
    expect(check.status).toBe('PASS');
  });

  it('WARN when WARM tool has no run records', () => {
    const manifest = makeManifest({ id: 'mystery-warm', name: 'Mystery' });
    const report = runDoctorChecks(makeInput({
      tools: { 'mystery-warm': makeRecord(manifest, 'WARM') },
      runs: [], // no runs
    }));
    const check = report.results.find((r) => r.id === 'unexplained-activity')!;
    expect(check.status).toBe('WARN');
    expect(check.message).toContain('Mystery');
  });

  it('PASS when COLD tool has no run records (expected)', () => {
    const manifest = makeManifest({ id: 'cold-no-runs' });
    const report = runDoctorChecks(makeInput({
      tools: { 'cold-no-runs': makeRecord(manifest, 'COLD') },
      runs: [],
    }));
    const check = report.results.find((r) => r.id === 'unexplained-activity')!;
    expect(check.status).toBe('PASS');
  });
});

// ============================================================================
// REPORT SUMMARY
// ============================================================================

describe('DoctorReport summary counts', () => {
  it('correctly counts PASS / WARN / FAIL', () => {
    // Craft a scenario with exactly 1 FAIL (check 1) and 1 WARN (check 2)
    const hotManifest = makeManifest({ id: 'h1' });
    const tools: Record<string, ToolRecord> = { h1: makeRecord(hotManifest, 'HOT') };
    // Add 7 WARM tools (threshold is 6 for maxHotTools=2)
    for (let i = 0; i < 7; i++) {
      const m = makeManifest({ id: `w${i}` });
      tools[m.id] = makeRecord(m, 'WARM');
    }
    const report = runDoctorChecks(makeInput({ tools, runs: [] }));

    expect(report.fail).toBeGreaterThanOrEqual(1);
    expect(report.warn).toBeGreaterThanOrEqual(1);
    expect(report.pass + report.warn + report.fail).toBe(7); // exactly 7 checks
    expect(report.results).toHaveLength(7);
    expect(report.timestamp).toBeGreaterThan(0);
  });
});
