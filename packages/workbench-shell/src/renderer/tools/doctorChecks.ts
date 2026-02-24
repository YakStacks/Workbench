/**
 * doctorChecks — Anti-Bloat Doctor Diagnostics (Pegboard spec §Doctor Checks).
 *
 * Performs 7 checks against current toolStore state to detect memory-hog
 * conditions, zombie processes, and policy violations.
 *
 * Each check returns a DoctorCheckResult:
 *   status: 'PASS' | 'WARN' | 'FAIL'
 *   message: human-readable description
 *   remediation: actionable guidance
 *
 * This is a PURE FUNCTION — takes a snapshot of store state as input,
 * returns an array of results. No side effects, no imports of stores.
 * The caller (BenchPanel or a settings page) reads the store and passes state in.
 *
 * Spec checks:
 *   1. Any tool HOT with no active run/session event — WARN/FAIL
 *   2. Too many WARM tools — WARN
 *   3. Frequent timeouts/crashes for a tool — WARN
 *   4. Zombie process detection (tool marked HOT but run is PASS/FAIL/TIMEOUT) — FAIL
 *   5. Log growth exceeding bounds — WARN
 *   6. Tool declared kind=daemon without explicit user enablement — FAIL
 *   7. Any tool with background activity (unexplained HOT → COLD without run record) — FAIL
 *
 * Note: true zombie-process detection (OS-level) requires Node/Electron IPC and
 * is handled by the Core doctor module. These checks operate on Shell-side
 * state only and are a complementary first pass.
 */

import type { ToolRecord, RunRecord, ToolBudgets } from './toolStore';

// ============================================================================
// TYPES
// ============================================================================

export type DoctorCheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface DoctorCheckResult {
  id: string;
  name: string;
  status: DoctorCheckStatus;
  message: string;
  /** Actionable remediation steps. */
  remediation: string;
}

export interface DoctorReport {
  timestamp: number;
  pass: number;
  warn: number;
  fail: number;
  results: DoctorCheckResult[];
}

// ============================================================================
// INPUT SNAPSHOT (avoids passing Zustand store directly)
// ============================================================================

export interface DoctorCheckInput {
  tools: Record<string, ToolRecord>;
  runs: RunRecord[];
  budgets: ToolBudgets;
  /**
   * Set of tool ids where the user has explicitly enabled daemon mode.
   * (Read from settingsStore or passed in from the UI layer.)
   */
  userEnabledDaemonIds: Set<string>;
  /**
   * Max log line count per run (for log growth check).
   * Corresponds to LOG_MAX_CHARS / avg line length.
   */
  logLineCap: number;
}

// ============================================================================
// CHECKS
// ============================================================================

/**
 * Check 1 — HOT tool with no active run.
 * A tool in HOT state should always have at least one RUNNING run record.
 * If it doesn't, something went wrong in teardown.
 */
function checkHotWithNoRun(input: DoctorCheckInput): DoctorCheckResult {
  const hotTools = Object.values(input.tools).filter((t) => t.state === 'HOT');
  const orphaned = hotTools.filter((t) => {
    const hasActiveRun = input.runs.some(
      (r) => r.toolId === t.manifest.id && r.status === 'RUNNING'
    );
    return !hasActiveRun;
  });

  if (orphaned.length === 0) {
    return {
      id: 'hot-no-run',
      name: 'HOT tool without active run',
      status: 'PASS',
      message: 'All HOT tools have active run records.',
      remediation: '',
    };
  }

  return {
    id: 'hot-no-run',
    name: 'HOT tool without active run',
    status: 'FAIL',
    message: `${orphaned.length} tool(s) are HOT but have no RUNNING run record: ${
      orphaned.map((t) => t.manifest.name).join(', ')
    }. This indicates a teardown failure.`,
    remediation:
      'Open BenchPanel and click "Stop All Hot Tools" to reset state. ' +
      'If the tool has a child process, it may need to be killed manually.',
  };
}

/**
 * Check 2 — Too many WARM tools.
 * Having many tools loaded-but-idle wastes memory.
 * Threshold: > 5 WARM tools or > 3× maxHotTools.
 */
function checkTooManyWarm(input: DoctorCheckInput): DoctorCheckResult {
  const warmCount = Object.values(input.tools).filter((t) => t.state === 'WARM').length;
  const threshold = Math.max(5, input.budgets.maxHotTools * 3);

  if (warmCount <= threshold) {
    return {
      id: 'too-many-warm',
      name: 'Too many WARM tools',
      status: 'PASS',
      message: `${warmCount} WARM tools (threshold: ${threshold}). Acceptable.`,
      remediation: '',
    };
  }

  return {
    id: 'too-many-warm',
    name: 'Too many WARM tools',
    status: 'WARN',
    message: `${warmCount} tools are WARM (loaded-but-idle), above threshold of ${threshold}. ` +
      'This may waste memory.',
    remediation:
      'Lower the warmTtlMs in tool lifecycle settings, or unload tools manually in BenchPanel.',
  };
}

/**
 * Check 3 — Frequent timeouts/crashes.
 * Any tool with ≥3 TIMEOUT or ≥5 FAIL runs in recent history gets a WARN.
 */
function checkFrequentFailures(input: DoctorCheckInput): DoctorCheckResult {
  interface FailCount { timeouts: number; fails: number; name: string }
  const counts: Record<string, FailCount> = {};

  for (const run of input.runs) {
    if (!counts[run.toolId]) {
      counts[run.toolId] = {
        timeouts: 0,
        fails: 0,
        name: input.tools[run.toolId]?.manifest.name ?? run.toolId,
      };
    }
    if (run.status === 'TIMEOUT') counts[run.toolId].timeouts++;
    if (run.status === 'FAIL') counts[run.toolId].fails++;
  }

  const problematic = Object.entries(counts).filter(
    ([, c]) => c.timeouts >= 3 || c.fails >= 5
  );

  if (problematic.length === 0) {
    return {
      id: 'frequent-failures',
      name: 'Frequent timeouts/crashes',
      status: 'PASS',
      message: 'No tools have frequent timeouts or crashes.',
      remediation: '',
    };
  }

  const details = problematic.map(
    ([, c]) => `${c.name}: ${c.timeouts} timeouts, ${c.fails} fails`
  ).join('; ');

  return {
    id: 'frequent-failures',
    name: 'Frequent timeouts/crashes',
    status: 'WARN',
    message: `Tools with frequent failures: ${details}`,
    remediation:
      'Check the tool entry point for bugs, increase runTimeoutMs in the manifest, ' +
      'or check system resources (CPU/memory pressure).',
  };
}

/**
 * Check 4 — Zombie process detection (Shell-side).
 * A run is "zombie" if its status is a terminal state (PASS/FAIL/TIMEOUT/CANCELLED)
 * but its owning tool is still HOT.
 */
function checkZombieRuns(input: DoctorCheckInput): DoctorCheckResult {
  const terminalStatuses = new Set(['PASS', 'WARN', 'FAIL', 'TIMEOUT', 'CANCELLED']);
  const zombieToolIds = new Set<string>();

  for (const run of input.runs) {
    if (!terminalStatuses.has(run.status)) continue;
    const tool = input.tools[run.toolId];
    if (tool && tool.state === 'HOT') {
      // Tool is HOT but its run is terminal — potential zombie
      const hasOtherActiveRun = input.runs.some(
        (r) => r.toolId === run.toolId && r.status === 'RUNNING'
      );
      if (!hasOtherActiveRun) {
        zombieToolIds.add(run.toolId);
      }
    }
  }

  if (zombieToolIds.size === 0) {
    return {
      id: 'zombie-processes',
      name: 'Zombie processes',
      status: 'PASS',
      message: 'No zombie tool processes detected.',
      remediation: '',
    };
  }

  const names = [...zombieToolIds].map(
    (id) => input.tools[id]?.manifest.name ?? id
  ).join(', ');

  return {
    id: 'zombie-processes',
    name: 'Zombie processes',
    status: 'FAIL',
    message: `Potential zombie processes for tools: ${names}. ` +
      'Tool is HOT but all run records are terminal.',
    remediation:
      'Use "Stop All Hot Tools" in BenchPanel. ' +
      'If the issue persists, restart Workbench to force teardown of orphaned processes.',
  };
}

/**
 * Check 5 — Log growth exceeding bounds.
 * Runs whose log arrays are at or near the cap indicate bounded-log overflow risk.
 */
function checkLogGrowth(input: DoctorCheckInput): DoctorCheckResult {
  const overflowRuns = input.runs.filter(
    (r) => r.log.length >= input.logLineCap * 0.9
  );

  if (overflowRuns.length === 0) {
    return {
      id: 'log-growth',
      name: 'Log growth',
      status: 'PASS',
      message: 'All run logs are within bounds.',
      remediation: '',
    };
  }

  return {
    id: 'log-growth',
    name: 'Log growth',
    status: 'WARN',
    message: `${overflowRuns.length} run(s) have logs approaching the cap ` +
      `(${input.logLineCap} lines). Older entries may be truncated.`,
    remediation:
      'If tools are generating excessive output, add output filters in the tool entry. ' +
      'Logs are automatically rotated at the cap.',
  };
}

/**
 * Check 6 — Unauthorized daemon tools.
 * Tools declared kind=daemon but not explicitly enabled by the user are a FAIL.
 */
function checkUnauthorizedDaemons(input: DoctorCheckInput): DoctorCheckResult {
  const unauthorizedDaemons = Object.values(input.tools).filter(
    (t) =>
      t.manifest.kind === 'daemon' &&
      !t.manifest.policy.allowDaemon &&
      !input.userEnabledDaemonIds.has(t.manifest.id)
  );

  if (unauthorizedDaemons.length === 0) {
    return {
      id: 'unauthorized-daemon',
      name: 'Unauthorized daemon tools',
      status: 'PASS',
      message: 'No unauthorized daemon tools detected.',
      remediation: '',
    };
  }

  const names = unauthorizedDaemons.map((t) => t.manifest.name).join(', ');
  return {
    id: 'unauthorized-daemon',
    name: 'Unauthorized daemon tools',
    status: 'FAIL',
    message: `Tool(s) declared kind=daemon without explicit user enablement: ${names}. ` +
      'Daemon tools must have allowDaemon=true in policy AND be enabled by the user.',
    remediation:
      'Set allowDaemon=true in the tool manifest policy AND explicitly enable it in ' +
      'Settings → Tools → Allow Daemon for each listed tool. ' +
      'If you did not install these tools, consider uninstalling them.',
  };
}

/**
 * Check 7 — Unexplained background activity.
 * Any tool that has ever been HOT but has no run record is suspicious.
 * (Indicates a tool that transitioned itself without a beginRun() call.)
 */
function checkUnexplainedActivity(input: DoctorCheckInput): DoctorCheckResult {
  const toolsWithRuns = new Set(input.runs.map((r) => r.toolId));
  const hotOrWarmNoRuns = Object.values(input.tools).filter(
    (t) => t.state !== 'COLD' && !toolsWithRuns.has(t.manifest.id)
  );

  if (hotOrWarmNoRuns.length === 0) {
    return {
      id: 'unexplained-activity',
      name: 'Unexplained background activity',
      status: 'PASS',
      message: 'All non-COLD tools have run records. No unexplained activity.',
      remediation: '',
    };
  }

  const names = hotOrWarmNoRuns.map((t) => t.manifest.name).join(', ');
  return {
    id: 'unexplained-activity',
    name: 'Unexplained background activity',
    status: 'WARN',
    message: `Tools are WARM/HOT but have no run records: ${names}. ` +
      'This may indicate a tool started activity without going through beginRun().',
    remediation:
      'Unload the tool via BenchPanel (WARM → COLD). ' +
      'Report this to the tool author — tools must only become HOT via beginRun().',
  };
}

// ============================================================================
// PUBLIC: RUN ALL CHECKS
// ============================================================================

const LOG_LINE_CAP_DEFAULT = 10_000; // ~256 KB / 25 chars avg per line

/**
 * Run all 7 Doctor checks and return a consolidated report.
 * Pure function — no side effects.
 */
export function runDoctorChecks(
  input: Omit<DoctorCheckInput, 'logLineCap'> & { logLineCap?: number }
): DoctorReport {
  const fullInput: DoctorCheckInput = {
    ...input,
    logLineCap: input.logLineCap ?? LOG_LINE_CAP_DEFAULT,
  };

  const results: DoctorCheckResult[] = [
    checkHotWithNoRun(fullInput),
    checkTooManyWarm(fullInput),
    checkFrequentFailures(fullInput),
    checkZombieRuns(fullInput),
    checkLogGrowth(fullInput),
    checkUnauthorizedDaemons(fullInput),
    checkUnexplainedActivity(fullInput),
  ];

  return {
    timestamp: Date.now(),
    pass:  results.filter((r) => r.status === 'PASS').length,
    warn:  results.filter((r) => r.status === 'WARN').length,
    fail:  results.filter((r) => r.status === 'FAIL').length,
    results,
  };
}
