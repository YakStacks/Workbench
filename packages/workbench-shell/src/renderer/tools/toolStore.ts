/**
 * Tool Store — Pegboard Tool Lifecycle State Machine.
 *
 * Implements the COLD / WARM / HOT state machine with:
 *   - TTL-based auto-unmount (WARM → COLD after idle)
 *   - Concurrency budget enforcement with a run queue
 *   - Session pinning (pinned WARM sessions skip TTL)
 *   - Hard no-auto-start guarantee: nothing becomes HOT on its own
 *   - Teardown on completion (HOT → WARM → COLD)
 *
 * Architecture:
 *   - ToolManifest is loaded at COLD (registry knows about the tool)
 *   - WARM transition loads/validates the manifest in full + marks ready
 *   - HOT transition runs the tool via WorkbenchRuntime.runTool()
 *   - All state is in this Zustand store; components subscribe reactively
 *
 * Budget defaults (configurable via setGlobalBudgets):
 *   maxHotTools:       2
 *   maxConcurrentRuns: 3
 *
 * No auto-start: store initializes all tools as COLD.
 *   Proof: no setTimeout/setInterval at module level.
 *   Proof: no tool transitions in the hydration path.
 *
 * No `any` types throughout.
 */

import { create } from 'zustand';
import type { ToolManifest } from './toolManifest';
import { BUILT_IN_MANIFESTS } from './toolManifest';

// ============================================================================
// TOOL STATE TYPES
// ============================================================================

export type ToolState = 'COLD' | 'WARM' | 'HOT';

export type RunStatus = 'QUEUED' | 'RUNNING' | 'PASS' | 'WARN' | 'FAIL' | 'TIMEOUT' | 'CANCELLED';

// ============================================================================
// TOOL RECORD
// ============================================================================

export interface ToolRecord {
  /** Tool manifest (always present — even in COLD state). */
  manifest: ToolManifest;
  /** Current lifecycle state. */
  state: ToolState;
  /**
   * Whether this session tool is pinned.
   * Pinned tools skip TTL auto-unmount.
   * Only meaningful for kind='session'.
   */
  pinned: boolean;
  /**
   * Timestamp (epoch ms) when this tool last became WARM.
   * Used to compute idle time for TTL enforcement.
   */
  warmSince: number | null;
  /**
   * Handle for the TTL setTimeout. Stored so we can cancel it when
   * the tool is invoked again before TTL fires.
   * Internal — not used by components.
   */
  _ttlHandle: ReturnType<typeof setTimeout> | null;
}

// ============================================================================
// RUN RECORD
// ============================================================================

export interface RunRecord {
  runId: string;
  toolId: string;
  /** Workspace that triggered this run (for routing). */
  workspaceId?: string;
  input?: unknown;
  status: RunStatus;
  /** Queued waiting for a bench slot. */
  queuePosition?: number;
  queuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  /** Stdout/stderr captured (bounded to last 256 KB equivalent chars). */
  log: string[];
  /** Peak memory estimate in MB. */
  peakMemoryMB?: number;
  /** Duration in ms (finishedAt - startedAt). */
  durationMs?: number;
  /** Error message if status=FAIL|TIMEOUT|CANCELLED. */
  errorMessage?: string;
}

// ============================================================================
// GLOBAL BUDGETS
// ============================================================================

export interface ToolBudgets {
  /** Max tools that can be HOT simultaneously. */
  maxHotTools: number;
  /** Max concurrent runs (beyond this, queued). */
  maxConcurrentRuns: number;
  /** Default run timeout in ms (oneshot). */
  defaultRunTimeoutMs: number;
  /** Default session timeout in ms. */
  defaultSessionTimeoutMs: number;
  /** Soft cap on total tool memory. Doctor warns if exceeded. */
  maxTotalToolMemoryMB: number;
}

const DEFAULT_BUDGETS: ToolBudgets = {
  maxHotTools:            2,
  maxConcurrentRuns:      3,
  defaultRunTimeoutMs:   60_000,
  defaultSessionTimeoutMs: 600_000,
  maxTotalToolMemoryMB:  2_000,
};

// ============================================================================
// QUEUED INVOCATION
// ============================================================================

interface QueuedInvocation {
  toolId: string;
  runId: string;
  workspaceId?: string;
  input?: unknown;
  resolve: (runId: string) => void;
  reject: (err: Error) => void;
}

// ============================================================================
// STORE SHAPE
// ============================================================================

interface ToolStoreState {
  /** All known tools, keyed by toolId. Populated from manifests at boot. */
  tools: Record<string, ToolRecord>;

  /** All run records (current + recent history). Capped at 200. */
  runs: RunRecord[];

  /** Global resource budgets. */
  budgets: ToolBudgets;

  /** Pending invocations waiting for a bench slot. */
  _queue: QueuedInvocation[];

  // ── READ ──────────────────────────────────────────────────────────────────

  /** List all tool records. */
  getAll(): ToolRecord[];

  /** Get a single tool record by id. Throws if not found. */
  getById(toolId: string): ToolRecord;

  /** Count tools currently HOT. */
  hotCount(): number;

  /** Count actively RUNNING runs. */
  runningCount(): number;

  /** Get all queued invocations. */
  getQueue(): QueuedInvocation[];

  // ── LIFECYCLE TRANSITIONS ─────────────────────────────────────────────────

  /**
   * Register a tool manifest (COLD). Idempotent.
   * No module loading happens here.
   */
  register(manifest: ToolManifest): void;

  /**
   * COLD → WARM: "mount" the tool.
   * Sets state=WARM, records warmSince, starts TTL timer.
   * Does NOT start execution.
   */
  mount(toolId: string): void;

  /**
   * WARM → COLD: explicitly unmount.
   * Cancels TTL timer. Clears warmSince.
   * No-op if already COLD.
   */
  unmount(toolId: string): void;

  /**
   * WARM → HOT: begin a run.
   * Enforces budget. Queues if over maxHotTools/maxConcurrentRuns.
   * Returns a runId immediately (even if queued).
   * Actual execution is driven by the runtime passed in.
   *
   * @param toolId   Tool to run.
   * @param input    Arbitrary input (JSON-serializable).
   * @param workspaceId  Optional routing for event bus.
   * @param runner   Async function that performs the actual tool execution.
   *                 Receives runId; resolves when done.
   *                 This indirection keeps the store free of runtime imports.
   */
  beginRun(
    toolId: string,
    input: unknown,
    workspaceId: string | undefined,
    runner: (runId: string) => Promise<{ status: RunStatus; output?: unknown; errorMessage?: string }>,
  ): string; // returns runId

  /**
   * Mark a run as CANCELLED and stop it.
   * If QUEUED → remove from queue.
   * If RUNNING → signal cancellation (sets status=CANCELLED, HOT→WARM).
   */
  cancelRun(runId: string): void;

  /**
   * Stop all currently HOT tools.
   * Cancels all RUNNING runs.
   */
  stopAllHot(): void;

  // ── PINNING ───────────────────────────────────────────────────────────────

  /** Pin a session tool (skip TTL auto-unmount). */
  pin(toolId: string): void;

  /** Unpin a session tool (re-enables TTL from now). */
  unpin(toolId: string): void;

  // ── BUDGETS ───────────────────────────────────────────────────────────────

  /** Update global budget settings. */
  setGlobalBudgets(patch: Partial<ToolBudgets>): void;

  // ── INTERNAL (only used by store logic) ───────────────────────────────────

  _updateRun(runId: string, patch: Partial<RunRecord>): void;
  _transitionHot(toolId: string): void;
  _transitionWarm(toolId: string): void;
  _scheduleWarmTtl(toolId: string): void;
  _cancelWarmTtl(toolId: string): void;
  _drainQueue(): void;
}

// ============================================================================
// STORE
// ============================================================================

const LOG_MAX_CHARS = 256 * 1024; // 256 KB equivalent
const RUN_HISTORY_CAP = 200;

export const useToolStore = create<ToolStoreState>((set, get) => {

  // ── Internal helpers ────────────────────────────────────────────────────────

  function _updateRun(runId: string, patch: Partial<RunRecord>): void {
    set((s) => ({
      runs: s.runs.map((r) => (r.runId === runId ? { ...r, ...patch } : r)),
    }));
  }

  function _transitionHot(toolId: string): void {
    set((s) => ({
      tools: {
        ...s.tools,
        [toolId]: { ...s.tools[toolId], state: 'HOT' },
      },
    }));
  }

  function _transitionWarm(toolId: string): void {
    const { tools } = get();
    const rec = tools[toolId];
    if (!rec) return;
    // Cancel any running TTL before resetting
    if (rec._ttlHandle !== null) clearTimeout(rec._ttlHandle);
    set((s) => ({
      tools: {
        ...s.tools,
        [toolId]: {
          ...s.tools[toolId],
          state: 'WARM',
          warmSince: s.tools[toolId].warmSince ?? Date.now(),
          _ttlHandle: null,
        },
      },
    }));
    // Schedule new TTL (unless pinned)
    get()._scheduleWarmTtl(toolId);
  }

  function _scheduleWarmTtl(toolId: string): void {
    const rec = get().tools[toolId];
    if (!rec) return;
    if (rec.pinned) return; // pinned tools never auto-unmount
    if (rec.state !== 'WARM') return;

    const ttlMs = rec.manifest.lifecycle.warmTtlMs;
    const handle = setTimeout(() => {
      // Double-check still WARM and not pinned at fire time
      const current = get().tools[toolId];
      if (current && current.state === 'WARM' && !current.pinned) {
        get().unmount(toolId);
      }
    }, ttlMs);

    set((s) => ({
      tools: {
        ...s.tools,
        [toolId]: { ...s.tools[toolId], _ttlHandle: handle },
      },
    }));
  }

  function _cancelWarmTtl(toolId: string): void {
    const rec = get().tools[toolId];
    if (!rec || rec._ttlHandle === null) return;
    clearTimeout(rec._ttlHandle);
    set((s) => ({
      tools: {
        ...s.tools,
        [toolId]: { ...s.tools[toolId], _ttlHandle: null },
      },
    }));
  }

  function _drainQueue(): void {
    const { _queue, budgets } = get();
    if (_queue.length === 0) return;

    const runningNow = get().runningCount();
    const hotNow = get().hotCount();

    if (runningNow >= budgets.maxConcurrentRuns) return;
    if (hotNow >= budgets.maxHotTools) return;

    // Take the first queued item
    const [next, ...rest] = _queue;
    set({ _queue: rest });

    // Update queue positions for remaining items
    rest.forEach((item, idx) => {
      _updateRun(item.runId, { queuePosition: idx + 1 });
    });

    // Remove QUEUED status from this run
    _updateRun(next.runId, { queuePosition: undefined, status: 'RUNNING', startedAt: Date.now() });

    // Resolve the promise (the caller's runner will fire)
    next.resolve(next.runId);
  }

  // ── Store actions ───────────────────────────────────────────────────────────

  return {
    tools: {},
    runs: [],
    budgets: { ...DEFAULT_BUDGETS },
    _queue: [],

    // ── READ ──────────────────────────────────────────────────────────────────

    getAll: () => Object.values(get().tools),

    getById: (toolId) => {
      const rec = get().tools[toolId];
      if (!rec) throw new Error(`Tool not found: ${toolId}`);
      return rec;
    },

    hotCount: () => {
      return Object.values(get().tools).filter((t) => t.state === 'HOT').length;
    },

    runningCount: () => {
      return get().runs.filter((r) => r.status === 'RUNNING').length;
    },

    getQueue: () => get()._queue,

    // ── REGISTER ──────────────────────────────────────────────────────────────

    register: (manifest) => {
      const existing = get().tools[manifest.id];
      if (existing) return; // idempotent
      const rec: ToolRecord = {
        manifest,
        state: 'COLD',
        pinned: false,
        warmSince: null,
        _ttlHandle: null,
      };
      set((s) => ({
        tools: { ...s.tools, [manifest.id]: rec },
      }));
    },

    // ── MOUNT (COLD → WARM) ───────────────────────────────────────────────────

    mount: (toolId) => {
      const rec = get().tools[toolId];
      if (!rec) throw new Error(`Tool not registered: ${toolId}`);
      if (rec.state !== 'COLD') return; // already WARM or HOT

      set((s) => ({
        tools: {
          ...s.tools,
          [toolId]: {
            ...s.tools[toolId],
            state: 'WARM',
            warmSince: Date.now(),
            _ttlHandle: null,
          },
        },
      }));
      get()._scheduleWarmTtl(toolId);
    },

    // ── UNMOUNT (WARM → COLD) ─────────────────────────────────────────────────

    unmount: (toolId) => {
      const rec = get().tools[toolId];
      if (!rec || rec.state === 'COLD') return;
      if (rec.state === 'HOT') {
        // Cannot unmount a HOT tool — must stop it first
        console.warn(`[toolStore] Cannot unmount HOT tool ${toolId}; cancel runs first.`);
        return;
      }
      get()._cancelWarmTtl(toolId);
      set((s) => ({
        tools: {
          ...s.tools,
          [toolId]: {
            ...s.tools[toolId],
            state: 'COLD',
            warmSince: null,
            _ttlHandle: null,
          },
        },
      }));
    },

    // ── BEGIN RUN (WARM → HOT) ────────────────────────────────────────────────

    beginRun: (toolId, input, workspaceId, runner) => {
      const rec = get().tools[toolId];
      if (!rec) throw new Error(`Tool not registered: ${toolId}`);

      // Daemon guard
      if (rec.manifest.kind === 'daemon' && !rec.manifest.policy.allowDaemon) {
        throw new Error(
          `Tool ${toolId} is kind=daemon but allowDaemon=false. ` +
          `Enable daemon mode explicitly in the tool policy.`
        );
      }

      const runId = `run-${toolId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = Date.now();

      const { budgets } = get();
      const hotNow = get().hotCount();
      const runningNow = get().runningCount();

      const isOverBudget =
        hotNow >= budgets.maxHotTools ||
        runningNow >= budgets.maxConcurrentRuns;

      if (isOverBudget) {
        // Queue the invocation
        const queuePos = get()._queue.length + 1;
        const runRecord: RunRecord = {
          runId,
          toolId,
          workspaceId,
          input,
          status: 'QUEUED',
          queuePosition: queuePos,
          queuedAt: now,
          log: [],
        };
        set((s) => ({
          runs: [...s.runs, runRecord].slice(-RUN_HISTORY_CAP),
        }));

        // Wrap runner in a promise that will resolve when drained
        const pending: QueuedInvocation = {
          toolId,
          runId,
          workspaceId,
          input,
          resolve: () => {
            // When drained, transition and execute
            _executeRun(toolId, runId, workspaceId, runner);
          },
          reject: (err) => {
            _updateRun(runId, {
              status: 'CANCELLED',
              finishedAt: Date.now(),
              errorMessage: err.message,
            });
          },
        };
        set((s) => ({ _queue: [...s._queue, pending] }));

        return runId;
      }

      // Not over budget — start immediately
      const runRecord: RunRecord = {
        runId,
        toolId,
        workspaceId,
        input,
        status: 'RUNNING',
        queuedAt: now,
        startedAt: now,
        log: [],
      };
      set((s) => ({
        runs: [...s.runs, runRecord].slice(-RUN_HISTORY_CAP),
      }));

      _executeRun(toolId, runId, workspaceId, runner);

      return runId;
    },

    // ── CANCEL RUN ────────────────────────────────────────────────────────────

    cancelRun: (runId) => {
      const run = get().runs.find((r) => r.runId === runId);
      if (!run) return;

      if (run.status === 'QUEUED') {
        // Remove from queue
        set((s) => ({
          _queue: s._queue.filter((q) => q.runId !== runId),
          runs: s.runs.map((r) =>
            r.runId === runId
              ? { ...r, status: 'CANCELLED', finishedAt: Date.now() }
              : r
          ),
        }));
        return;
      }

      if (run.status === 'RUNNING') {
        _updateRun(runId, {
          status: 'CANCELLED',
          finishedAt: Date.now(),
          errorMessage: 'Cancelled by user.',
        });
        // Transition HOT → WARM
        _transitionWarm(run.toolId);
        // Try to drain queue now that a slot opened
        get()._drainQueue();
      }
    },

    // ── STOP ALL HOT ─────────────────────────────────────────────────────────

    stopAllHot: () => {
      // Clear queue FIRST so that cancelRun's _drainQueue() calls below
      // don't immediately dequeue and re-start a queued item.
      const queued = get()._queue;
      queued.forEach((q) => {
        _updateRun(q.runId, {
          status: 'CANCELLED',
          finishedAt: Date.now(),
          errorMessage: 'Stopped by user (stop all hot tools).',
        });
      });
      set({ _queue: [] });

      // Now cancel all running items (won't re-drain since queue is empty)
      const runningIds = get().runs
        .filter((r) => r.status === 'RUNNING')
        .map((r) => r.runId);
      for (const runId of runningIds) {
        get().cancelRun(runId);
      }
    },

    // ── PINNING ───────────────────────────────────────────────────────────────

    pin: (toolId) => {
      const rec = get().tools[toolId];
      if (!rec) return;
      get()._cancelWarmTtl(toolId);
      set((s) => ({
        tools: {
          ...s.tools,
          [toolId]: { ...s.tools[toolId], pinned: true, _ttlHandle: null },
        },
      }));
    },

    unpin: (toolId) => {
      set((s) => ({
        tools: {
          ...s.tools,
          [toolId]: { ...s.tools[toolId], pinned: false },
        },
      }));
      // Re-enable TTL from now
      get()._scheduleWarmTtl(toolId);
    },

    // ── BUDGETS ───────────────────────────────────────────────────────────────

    setGlobalBudgets: (patch) => {
      set((s) => ({ budgets: { ...s.budgets, ...patch } }));
    },

    // ── INTERNAL ─────────────────────────────────────────────────────────────

    _updateRun,
    _transitionHot,
    _transitionWarm,
    _scheduleWarmTtl,
    _cancelWarmTtl,
    _drainQueue,
  };
});

// ============================================================================
// INTERNAL: EXECUTE RUN (not in store shape — plain function)
// ============================================================================

/**
 * Drive the actual tool execution outside the Zustand action to avoid
 * async Zustand anti-patterns (async actions that call set() after delays).
 *
 * Handles:
 *   - WARM → HOT transition
 *   - Timeout enforcement
 *   - run record updates (RUNNING → PASS/FAIL/TIMEOUT)
 *   - HOT → WARM teardown
 *   - Queue draining
 *
 * runner() is provided by the caller (ButlerChatView or a direct hook).
 * This keeps the store free of any runtime/LLM imports.
 */
async function _executeRun(
  toolId: string,
  runId: string,
  workspaceId: string | undefined,
  runner: (runId: string) => Promise<{ status: RunStatus; output?: unknown; errorMessage?: string }>,
): Promise<void> {
  const store = useToolStore.getState();
  const rec = store.tools[toolId];
  if (!rec) return;

  // Auto-mount if still COLD (e.g. direct invocation bypassing mount step)
  if (rec.state === 'COLD') {
    store.mount(toolId);
  }

  // Cancel TTL while running
  store._cancelWarmTtl(toolId);
  // WARM → HOT
  store._transitionHot(toolId);

  const timeoutMs = rec.manifest.lifecycle.runTimeoutMs;
  let timedOut = false;

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    useToolStore.getState()._updateRun(runId, {
      status: 'TIMEOUT',
      finishedAt: Date.now(),
      errorMessage: `Run exceeded timeout of ${timeoutMs}ms.`,
    });
    // HOT → WARM (teardown)
    useToolStore.getState()._transitionWarm(toolId);
    useToolStore.getState()._drainQueue();
  }, timeoutMs);

  try {
    const result = await runner(runId);

    if (timedOut) return; // already handled

    clearTimeout(timeoutHandle);

    const currentRun = useToolStore.getState().runs.find((r) => r.runId === runId);
    if (currentRun?.status === 'CANCELLED') return; // cancelled mid-run

    useToolStore.getState()._updateRun(runId, {
      status: result.status,
      finishedAt: Date.now(),
      durationMs: Date.now() - (currentRun?.startedAt ?? Date.now()),
      errorMessage: result.errorMessage,
    });
  } catch (err: unknown) {
    if (timedOut) return;
    clearTimeout(timeoutHandle);

    const errorMessage = err instanceof Error ? err.message : String(err);
    const currentRun = useToolStore.getState().runs.find((r) => r.runId === runId);
    if (currentRun?.status === 'CANCELLED') return;

    useToolStore.getState()._updateRun(runId, {
      status: 'FAIL',
      finishedAt: Date.now(),
      errorMessage,
    });
  } finally {
    if (!timedOut) {
      // HOT → WARM teardown (within teardownTimeoutMs — we trust the runner cleaned up)
      const currentRec = useToolStore.getState().tools[toolId];
      if (currentRec && currentRec.state === 'HOT') {
        useToolStore.getState()._transitionWarm(toolId);
      }
      useToolStore.getState()._drainQueue();
    }
  }
}

// ============================================================================
// BOOT REGISTRATION (no auto-start — only registers manifests as COLD)
// ============================================================================

/**
 * Called once at app startup to register all built-in tool manifests.
 * This does NOT mount or hot-start any tool.
 * Proof of no auto-start: only calls register() which sets state=COLD.
 */
export function registerBuiltInTools(): void {
  const { register } = useToolStore.getState();
  for (const manifest of BUILT_IN_MANIFESTS) {
    register(manifest);
  }
}
