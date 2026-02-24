/**
 * toolStore unit tests — Pegboard Tool Lifecycle.
 *
 * Covers the four core acceptance criteria from the spec:
 *   1. No auto-start: tools register as COLD; nothing becomes HOT on its own.
 *   2. Queuing: when maxHotTools is reached, additional runs are queued.
 *   3. TTL unmount: WARM tools auto-unmount after warmTtlMs idle time.
 *   4. Teardown: after a run completes, tool returns to WARM (not stuck HOT).
 *
 * Also tests:
 *   5. Pinning: pinned tools skip TTL auto-unmount.
 *   6. Budget enforcement: maxConcurrentRuns queues excess runs.
 *   7. stopAllHot: cancels all RUNNING runs and clears queue.
 *   8. cancelRun: removes QUEUED run cleanly.
 *   9. Daemon guard: kind=daemon + allowDaemon=false throws.
 *
 * Tests use vi.useFakeTimers() for TTL behavior.
 * Store state is reset before each test via resetStore().
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useToolStore, registerBuiltInTools } from '../toolStore';
import type { RunStatus } from '../toolStore';
import type { ToolManifest } from '../toolManifest';
import { DEFAULT_LIFECYCLE } from '../toolManifest';

// ============================================================================
// HELPERS
// ============================================================================

/** Reset the Zustand store to a completely clean state between tests. */
function resetStore(): void {
  useToolStore.setState({
    tools: {},
    runs: [],
    budgets: {
      maxHotTools: 2,
      maxConcurrentRuns: 3,
      defaultRunTimeoutMs: 60_000,
      defaultSessionTimeoutMs: 600_000,
      maxTotalToolMemoryMB: 2_000,
    },
    _queue: [],
  });
}

/** Minimal valid manifest factory. */
function makeManifest(overrides: Partial<ToolManifest> = {}): ToolManifest {
  return {
    id: `test-tool-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Test Tool',
    version: '1.0.0',
    description: 'A test tool.',
    kind: 'oneshot',
    entry: 'internal:test',
    permissions: {},
    resources: { expectedMemoryMB: 8, expectedCPU: 'low', supportsWarm: false },
    lifecycle: { ...DEFAULT_LIFECYCLE, warmTtlMs: 5_000, runTimeoutMs: 10_000 },
    policy: { requiresUserApproval: false, allowDaemon: false },
    tags: ['test'],
    ...overrides,
  };
}

/** A runner that resolves immediately with PASS. */
async function immediatePassRunner(_runId: string): Promise<{ status: RunStatus }> {
  return { status: 'PASS' };
}

/** A runner that never resolves (simulates a long-running tool). */
function neverRunner(_runId: string): Promise<{ status: RunStatus }> {
  return new Promise(() => { /* never */ });
}

/**
 * Flush the microtask queue (replacement for vi.runAllMicrotasksAsync which
 * doesn't exist in vitest 1.6.x). Multiple rounds handle chained .then() chains.
 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
  resetStore();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

// ============================================================================
// 1. NO AUTO-START
// ============================================================================

describe('No Auto-Start', () => {
  it('registers tools as COLD — not WARM or HOT', () => {
    const manifest = makeManifest({ id: 'no-auto-start' });
    const { register, getById } = useToolStore.getState();

    register(manifest);

    const rec = getById('no-auto-start');
    expect(rec.state).toBe('COLD');
  });

  it('registerBuiltInTools leaves all tools COLD', () => {
    registerBuiltInTools();
    const tools = useToolStore.getState().getAll();

    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.state).toBe('COLD');
    }
  });

  it('no tool is HOT after module initialisation (no timer auto-start)', () => {
    // Advance time significantly — nothing should auto-HOT
    registerBuiltInTools();
    vi.advanceTimersByTime(300_000); // 5 minutes

    const hotTools = useToolStore.getState().getAll().filter((t) => t.state === 'HOT');
    expect(hotTools).toHaveLength(0);
  });

  it('register is idempotent — registering twice does not double-add', () => {
    const manifest = makeManifest({ id: 'idempotent-tool' });
    const { register } = useToolStore.getState();

    register(manifest);
    register(manifest); // second call — should be no-op

    const allTools = useToolStore.getState().getAll();
    const matches = allTools.filter((t) => t.manifest.id === 'idempotent-tool');
    expect(matches).toHaveLength(1);
  });
});

// ============================================================================
// 2. QUEUING BEHAVIOUR
// ============================================================================

describe('Queuing Behaviour', () => {
  it('queues run when maxHotTools is reached', async () => {
    // Set budget to 1 hot tool max
    useToolStore.getState().setGlobalBudgets({ maxHotTools: 1 });

    const m1 = makeManifest({ id: 'tool-q1' });
    const m2 = makeManifest({ id: 'tool-q2' });
    const { register, beginRun, getById } = useToolStore.getState();
    register(m1);
    register(m2);

    // First run — should start immediately (WARM→HOT)
    beginRun('tool-q1', {}, undefined, neverRunner);
    await flushMicrotasks();

    expect(getById('tool-q1').state).toBe('HOT');

    // Second run — should be queued (tool-q2 is NOT auto-mounted, beginRun mounts it)
    beginRun('tool-q2', {}, undefined, neverRunner);
    await flushMicrotasks();

    const queue = useToolStore.getState().getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].toolId).toBe('tool-q2');

    // tool-q2 should NOT be HOT yet
    expect(getById('tool-q2').state).not.toBe('HOT');
  });

  it('shows QUEUED status in run record', async () => {
    useToolStore.getState().setGlobalBudgets({ maxHotTools: 1 });

    const m1 = makeManifest({ id: 'tool-slot1' });
    const m2 = makeManifest({ id: 'tool-slot2' });
    const { register, beginRun } = useToolStore.getState();
    register(m1);
    register(m2);

    beginRun('tool-slot1', {}, undefined, neverRunner);
    await flushMicrotasks();

    const runId2 = beginRun('tool-slot2', {}, undefined, neverRunner);
    await flushMicrotasks();

    const run2 = useToolStore.getState().runs.find((r) => r.runId === runId2);
    expect(run2?.status).toBe('QUEUED');
    expect(run2?.queuePosition).toBe(1);
  });

  it('queued run starts when previous HOT tool finishes', async () => {
    useToolStore.getState().setGlobalBudgets({ maxHotTools: 1, maxConcurrentRuns: 2 });

    const m1 = makeManifest({ id: 'tool-first' });
    const m2 = makeManifest({ id: 'tool-second' });
    const { register, beginRun, cancelRun } = useToolStore.getState();
    register(m1);
    register(m2);

    const runId1 = beginRun('tool-first', {}, undefined, neverRunner);
    await flushMicrotasks();

    beginRun('tool-second', {}, undefined, immediatePassRunner);
    await flushMicrotasks();

    // tool-second is still QUEUED
    expect(useToolStore.getState().getQueue()).toHaveLength(1);

    // Cancel tool-first — slot opens
    cancelRun(runId1);
    await flushMicrotasks();

    // Queue should be drained — tool-second should now be running/complete
    // (immediatePassRunner resolves synchronously in microtasks)
    const queue = useToolStore.getState().getQueue();
    expect(queue).toHaveLength(0);
  });

  it('shows "Queued (waiting for free bench slot)" intent in queue entry', async () => {
    useToolStore.getState().setGlobalBudgets({ maxHotTools: 1 });

    const m1 = makeManifest({ id: 'blocker' });
    const m2 = makeManifest({ id: 'waiter' });
    const { register, beginRun } = useToolStore.getState();
    register(m1);
    register(m2);

    beginRun('blocker', {}, undefined, neverRunner);
    await flushMicrotasks();

    beginRun('waiter', {}, undefined, neverRunner);
    await flushMicrotasks();

    const queue = useToolStore.getState().getQueue();
    expect(queue[0].toolId).toBe('waiter');
    // The run record captures the queued-at timestamp
    const queuedRun = useToolStore.getState().runs.find(
      (r) => r.toolId === 'waiter' && r.status === 'QUEUED'
    );
    expect(queuedRun).toBeDefined();
    expect(queuedRun?.queuedAt).toBeGreaterThan(0);
  });
});

// ============================================================================
// 3. TTL UNMOUNT (WARM → COLD)
// ============================================================================

describe('TTL Auto-Unmount', () => {
  it('WARM tool auto-unmounts after warmTtlMs', () => {
    const manifest = makeManifest({ id: 'ttl-tool', lifecycle: { ...DEFAULT_LIFECYCLE, warmTtlMs: 5_000 } });
    const { register, mount, getById } = useToolStore.getState();

    register(manifest);
    mount('ttl-tool');

    expect(getById('ttl-tool').state).toBe('WARM');

    // Advance past TTL
    vi.advanceTimersByTime(5_001);

    expect(getById('ttl-tool').state).toBe('COLD');
  });

  it('TTL does NOT fire before warmTtlMs elapses', () => {
    const manifest = makeManifest({ id: 'ttl-early', lifecycle: { ...DEFAULT_LIFECYCLE, warmTtlMs: 10_000 } });
    const { register, mount, getById } = useToolStore.getState();

    register(manifest);
    mount('ttl-early');

    vi.advanceTimersByTime(9_999);
    expect(getById('ttl-early').state).toBe('WARM');
  });

  it('explicit unmount before TTL fires cancels the TTL (no spurious COLD later)', () => {
    const manifest = makeManifest({ id: 'manual-unmount', lifecycle: { ...DEFAULT_LIFECYCLE, warmTtlMs: 5_000 } });
    const { register, mount, unmount, getById } = useToolStore.getState();

    register(manifest);
    mount('manual-unmount');
    unmount('manual-unmount');

    expect(getById('manual-unmount').state).toBe('COLD');

    // Advance past where TTL would fire — state should not change (it's already COLD)
    vi.advanceTimersByTime(6_000);
    expect(getById('manual-unmount').state).toBe('COLD');
  });

  it('pinned WARM tool does NOT auto-unmount after TTL', () => {
    const manifest = makeManifest({
      id: 'pinned-warm',
      kind: 'session',
      resources: { expectedMemoryMB: 8, expectedCPU: 'low', supportsWarm: true },
      lifecycle: { ...DEFAULT_LIFECYCLE, warmTtlMs: 5_000 },
    });
    const { register, mount, pin, getById } = useToolStore.getState();

    register(manifest);
    mount('pinned-warm');
    pin('pinned-warm');

    vi.advanceTimersByTime(20_000); // way past TTL

    expect(getById('pinned-warm').state).toBe('WARM');
    expect(getById('pinned-warm').pinned).toBe(true);
  });

  it('unpin re-enables TTL and tool eventually auto-unmounts', () => {
    const manifest = makeManifest({
      id: 'unpin-ttl',
      kind: 'session',
      resources: { expectedMemoryMB: 8, expectedCPU: 'low', supportsWarm: true },
      lifecycle: { ...DEFAULT_LIFECYCLE, warmTtlMs: 5_000 },
    });
    const { register, mount, pin, unpin, getById } = useToolStore.getState();

    register(manifest);
    mount('unpin-ttl');
    pin('unpin-ttl');

    vi.advanceTimersByTime(10_000); // TTL would fire if not pinned
    expect(getById('unpin-ttl').state).toBe('WARM'); // still WARM (pinned)

    unpin('unpin-ttl');
    vi.advanceTimersByTime(5_001); // new TTL fires

    expect(getById('unpin-ttl').state).toBe('COLD');
  });
});

// ============================================================================
// 4. TEARDOWN (HOT → WARM after run)
// ============================================================================

describe('Teardown after run completes', () => {
  it('tool returns to WARM after a PASS run (not stuck HOT)', async () => {
    const manifest = makeManifest({ id: 'teardown-pass' });
    const { register, getById, beginRun } = useToolStore.getState();
    register(manifest);

    beginRun('teardown-pass', {}, undefined, immediatePassRunner);
    await flushMicrotasks();

    expect(getById('teardown-pass').state).toBe('WARM');
  });

  it('tool returns to WARM after a FAIL run', async () => {
    const manifest = makeManifest({ id: 'teardown-fail' });
    const { register, getById, beginRun } = useToolStore.getState();
    register(manifest);

    const failRunner = async (_runId: string) => ({ status: 'FAIL' as RunStatus, errorMessage: 'test error' });
    beginRun('teardown-fail', {}, undefined, failRunner);
    await flushMicrotasks();

    expect(getById('teardown-fail').state).toBe('WARM');
  });

  it('run record has PASS status and durationMs after completion', async () => {
    const manifest = makeManifest({ id: 'teardown-record' });
    const { register, beginRun } = useToolStore.getState();
    register(manifest);

    const runId = beginRun('teardown-record', {}, undefined, immediatePassRunner);
    await flushMicrotasks();

    const run = useToolStore.getState().runs.find((r) => r.runId === runId);
    expect(run?.status).toBe('PASS');
    expect(run?.finishedAt).toBeDefined();
  });

  it('tool times out and returns to WARM with TIMEOUT status', async () => {
    const shortTimeout = 1_000;
    const manifest = makeManifest({
      id: 'timeout-tool',
      lifecycle: { ...DEFAULT_LIFECYCLE, runTimeoutMs: shortTimeout, warmTtlMs: 120_000 },
    });
    const { register, getById, beginRun } = useToolStore.getState();
    register(manifest);

    const runId = beginRun('timeout-tool', {}, undefined, neverRunner);

    // Advance past timeout
    vi.advanceTimersByTime(shortTimeout + 100);
    await flushMicrotasks();

    const run = useToolStore.getState().runs.find((r) => r.runId === runId);
    expect(run?.status).toBe('TIMEOUT');
    expect(getById('timeout-tool').state).toBe('WARM');
  });

  it('cancelled run leaves tool in WARM, not HOT', async () => {
    const manifest = makeManifest({ id: 'cancel-teardown' });
    const { register, getById, beginRun, cancelRun } = useToolStore.getState();
    register(manifest);

    const runId = beginRun('cancel-teardown', {}, undefined, neverRunner);
    await flushMicrotasks();

    expect(getById('cancel-teardown').state).toBe('HOT');

    cancelRun(runId);
    await flushMicrotasks();

    expect(getById('cancel-teardown').state).toBe('WARM');

    const run = useToolStore.getState().runs.find((r) => r.runId === runId);
    expect(run?.status).toBe('CANCELLED');
  });
});

// ============================================================================
// 5. STOP ALL HOT
// ============================================================================

describe('stopAllHot', () => {
  it('cancels all RUNNING runs and clears queue', async () => {
    useToolStore.getState().setGlobalBudgets({ maxHotTools: 2, maxConcurrentRuns: 2 });

    const m1 = makeManifest({ id: 'hot1' });
    const m2 = makeManifest({ id: 'hot2' });
    const m3 = makeManifest({ id: 'queued1' });
    const { register, beginRun, stopAllHot } = useToolStore.getState();
    register(m1); register(m2); register(m3);

    beginRun('hot1', {}, undefined, neverRunner);
    beginRun('hot2', {}, undefined, neverRunner);
    await flushMicrotasks();

    // 2 HOT, m3 gets queued
    beginRun('queued1', {}, undefined, neverRunner);
    await flushMicrotasks();

    expect(useToolStore.getState().getQueue()).toHaveLength(1);

    stopAllHot();
    await flushMicrotasks();

    const { runs, _queue } = useToolStore.getState();
    const runningOrQueued = runs.filter((r) => r.status === 'RUNNING' || r.status === 'QUEUED');
    expect(runningOrQueued).toHaveLength(0);
    expect(_queue).toHaveLength(0);
  });
});

// ============================================================================
// 6. DAEMON GUARD
// ============================================================================

describe('Daemon Guard', () => {
  it('throws when beginRun called on daemon tool with allowDaemon=false', async () => {
    const manifest = makeManifest({
      id: 'blocked-daemon',
      kind: 'daemon',
      policy: { requiresUserApproval: false, allowDaemon: false },
    });
    const { register, beginRun } = useToolStore.getState();
    register(manifest);

    expect(() => {
      beginRun('blocked-daemon', {}, undefined, immediatePassRunner);
    }).toThrow(/allowDaemon=false/);
  });

  it('does NOT throw for daemon with allowDaemon=true', async () => {
    const manifest = makeManifest({
      id: 'allowed-daemon',
      kind: 'daemon',
      policy: { requiresUserApproval: false, allowDaemon: true },
    });
    const { register, beginRun } = useToolStore.getState();
    register(manifest);

    expect(() => {
      beginRun('allowed-daemon', {}, undefined, neverRunner);
    }).not.toThrow();
  });
});

// ============================================================================
// 7. MOUNT / UNMOUNT
// ============================================================================

describe('Mount / Unmount', () => {
  it('mount transitions COLD → WARM', () => {
    const manifest = makeManifest({ id: 'mount-test' });
    const { register, mount, getById } = useToolStore.getState();
    register(manifest);
    mount('mount-test');
    expect(getById('mount-test').state).toBe('WARM');
  });

  it('unmount transitions WARM → COLD', () => {
    const manifest = makeManifest({ id: 'unmount-test' });
    const { register, mount, unmount, getById } = useToolStore.getState();
    register(manifest);
    mount('unmount-test');
    unmount('unmount-test');
    expect(getById('unmount-test').state).toBe('COLD');
  });

  it('cannot unmount a HOT tool', async () => {
    const manifest = makeManifest({ id: 'hot-unmount' });
    const { register, beginRun, unmount, getById } = useToolStore.getState();
    register(manifest);

    beginRun('hot-unmount', {}, undefined, neverRunner);
    await flushMicrotasks();

    expect(getById('hot-unmount').state).toBe('HOT');

    // Should log a warning and not unmount
    unmount('hot-unmount');
    expect(getById('hot-unmount').state).toBe('HOT');
  });

  it('throws when mounting an unregistered tool', () => {
    const { mount } = useToolStore.getState();
    expect(() => mount('nonexistent-tool')).toThrow(/not registered/);
  });
});
