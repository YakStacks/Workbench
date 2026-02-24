/**
 * Tool Manifest — declarative metadata for every Workbench tool.
 *
 * Rules:
 *   - Manifest is loadable without importing the tool module itself.
 *     COLD state means: manifest parsed, module NOT imported.
 *   - No `any`. Use `unknown` for flexible schemas.
 *   - All timing values are in milliseconds.
 *
 * Pegboard Lifecycle:
 *   COLD  — installed, manifest known, code NOT loaded, zero resources.
 *   WARM  — code loaded, health-checked, idle. No active execution.
 *   HOT   — actively executing. Bounded by timeouts and concurrency budget.
 *
 * Tool Kinds:
 *   "oneshot"  — runs and exits. Default auto-cools after completion.
 *   "session"  — can stay WARM/HOT if pinned (e.g. interactive shell).
 *   "daemon"   — long-running. DISALLOWED unless allowDaemon=true + user opt-in.
 */

// ============================================================================
// PERMISSION PROFILE
// ============================================================================

export interface ToolPermissions {
  /** Read/write filesystem access. Absent = no filesystem access. */
  filesystem?: 'read' | 'readwrite';
  /** Network access. Absent = no network access. */
  network?: boolean;
  /** Shell/subprocess execution. Absent = no shell access. */
  shell?: boolean;
}

// ============================================================================
// RESOURCE HINTS
// ============================================================================

export interface ToolResourceHints {
  /** Developer estimate of peak memory during HOT execution. */
  expectedMemoryMB: number;
  /** Rough CPU characterization. */
  expectedCPU: 'low' | 'med' | 'high';
  /** Whether this tool supports a WARM (loaded-not-running) state. */
  supportsWarm: boolean;
}

// ============================================================================
// LIFECYCLE TIMEOUTS
// ============================================================================

export interface ToolLifecycle {
  /** Max ms to go COLD → WARM (module load + health check). Default 1500. */
  mountTimeoutMs: number;
  /** Max ms a HOT run may take before TIMEOUT. Default 60000 (1 min). */
  runTimeoutMs: number;
  /** Max ms allowed for teardown after completion. Default 2000. */
  teardownTimeoutMs: number;
  /** Idle ms before WARM → COLD auto-unmount (if not pinned). Default 120000. */
  warmTtlMs: number;
}

// ============================================================================
// POLICY
// ============================================================================

export interface ToolPolicy {
  /**
   * When true, the user must explicitly approve before each HOT invocation.
   * Default true for tools with shell or network permissions.
   */
  requiresUserApproval: boolean;
  /**
   * When false (default), tool may NOT run as a daemon.
   * Setting true AND user opting in allows daemon mode.
   */
  allowDaemon: boolean;
}

// ============================================================================
// TOOL MANIFEST
// ============================================================================

export interface ToolManifest {
  /** Stable unique identifier. Never change after shipping. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Semver version string. */
  version: string;
  /** Short description shown in BenchPanel and command palette. */
  description: string;
  /**
   * oneshot — completes and exits (default).
   * session — can be pinned to stay WARM.
   * daemon  — long-running; blocked unless allowDaemon=true + user opt-in.
   */
  kind: 'oneshot' | 'session' | 'daemon';
  /** Module path or command string used at HOT execution time. */
  entry: string;
  /** JSON Schema for accepted input (unknown = no constraint). */
  inputSchema?: unknown;
  /** JSON Schema for produced output (unknown = no constraint). */
  outputSchema?: unknown;
  /** Explicit capability declarations. */
  permissions: ToolPermissions;
  /** Resource usage hints for budget enforcement. */
  resources: ToolResourceHints;
  /** Timing constraints. */
  lifecycle: ToolLifecycle;
  /** Approval and daemon policy. */
  policy: ToolPolicy;
  /** Searchable tags (e.g. ['diagnostics', 'network']). */
  tags: string[];
}

// ============================================================================
// DEFAULT LIFECYCLE
// ============================================================================

export const DEFAULT_LIFECYCLE: ToolLifecycle = {
  mountTimeoutMs:    1_500,
  runTimeoutMs:     60_000,
  teardownTimeoutMs: 2_000,
  warmTtlMs:       120_000,
};

// ============================================================================
// BUILT-IN TOOL MANIFESTS
// ============================================================================

/**
 * The minimal set of manifests known at shell boot time.
 * Registering here does NOT load the tool module (stays COLD).
 */
export const BUILT_IN_MANIFESTS: ToolManifest[] = [
  {
    id: 'doctor',
    name: 'Doctor',
    version: '1.0.0',
    description: 'Diagnose workspace environment: paths, MCP connections, tool health.',
    kind: 'oneshot',
    entry: 'internal:doctor',
    permissions: { filesystem: 'read', network: true },
    resources: { expectedMemoryMB: 32, expectedCPU: 'low', supportsWarm: false },
    lifecycle: { ...DEFAULT_LIFECYCLE, runTimeoutMs: 30_000 },
    policy: { requiresUserApproval: false, allowDaemon: false },
    tags: ['diagnostics', 'health', 'built-in'],
  },
  {
    id: 'echo',
    name: 'Echo',
    version: '1.0.0',
    description: 'Echo input back as output. Useful for testing pipelines.',
    kind: 'oneshot',
    entry: 'internal:echo',
    permissions: {},
    resources: { expectedMemoryMB: 4, expectedCPU: 'low', supportsWarm: false },
    lifecycle: { ...DEFAULT_LIFECYCLE, runTimeoutMs: 5_000 },
    policy: { requiresUserApproval: false, allowDaemon: false },
    tags: ['utility', 'built-in'],
  },
  {
    id: 'pipewrench',
    name: 'Pipewrench',
    version: '1.0.0',
    description: 'Probe network connectivity and MCP endpoint reachability.',
    kind: 'oneshot',
    entry: 'internal:pipewrench',
    permissions: { network: true },
    resources: { expectedMemoryMB: 16, expectedCPU: 'low', supportsWarm: false },
    lifecycle: { ...DEFAULT_LIFECYCLE, runTimeoutMs: 20_000 },
    policy: { requiresUserApproval: false, allowDaemon: false },
    tags: ['diagnostics', 'network', 'built-in'],
  },
  {
    id: 'shell',
    name: 'Shell',
    version: '1.0.0',
    description: 'Interactive shell session. Can be pinned as a session tool.',
    kind: 'session',
    entry: 'internal:shell',
    permissions: { filesystem: 'readwrite', shell: true },
    resources: { expectedMemoryMB: 64, expectedCPU: 'med', supportsWarm: true },
    lifecycle: { ...DEFAULT_LIFECYCLE, runTimeoutMs: 600_000, warmTtlMs: 300_000 },
    policy: { requiresUserApproval: true, allowDaemon: false },
    tags: ['shell', 'interactive', 'session'],
  },
];
