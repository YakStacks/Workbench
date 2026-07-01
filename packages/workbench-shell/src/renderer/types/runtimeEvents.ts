/**
 * Shell-level Runtime Event Types
 *
 * These are the ONLY event types used by Shell UI (stores, components, drawers).
 * Core's RuntimeEvent types never escape the runtime adapter (createRuntime.ts).
 *
 * The adapter maps Core events → these Shell events, adding:
 *   - ts: number  (epoch ms, normalised from Core's `timestamp`)
 *   - workspaceId: string | undefined  (injected via runId→workspaceId lookup)
 *
 * No `any`. Flexible payloads typed as `unknown`.
 */

export type RuntimeEventType =
  | 'tool:requested'
  | 'tool:started'
  | 'tool:verified'
  | 'tool:failed'
  | 'doctor:run'
  | 'log';

// ── Base ─────────────────────────────────────────────────────────────────────

export interface RuntimeEventBase {
  type: RuntimeEventType;
  /** Epoch ms — normalised from Core's `timestamp` field. */
  ts: number;
  /** Correlates started/verified/failed events to the same call. */
  runId?: string;
  /**
   * Workspace that triggered the tool run.
   * Injected by the adapter; used to route events into the correct ChatStore bucket.
   */
  workspaceId?: string;
}

// ── Tool lifecycle ────────────────────────────────────────────────────────────

export interface ToolRequestedEvent extends RuntimeEventBase {
  type: 'tool:requested';
  toolName: string;
  input?: unknown;
}

export interface ToolStartedEvent extends RuntimeEventBase {
  type: 'tool:started';
  toolName: string;
  input?: unknown;
}

export interface ToolVerifiedEvent extends RuntimeEventBase {
  type: 'tool:verified';
  toolName: string;
  /** true = PASS, false = FAIL */
  ok: boolean;
  output?: unknown;
}

export interface ToolFailedEvent extends RuntimeEventBase {
  type: 'tool:failed';
  toolName: string;
  error: string;
}

// ── Doctor ───────────────────────────────────────────────────────────────────

export interface DoctorRunEvent extends RuntimeEventBase {
  type: 'doctor:run';
  report?: unknown;
}

// ── Union ─────────────────────────────────────────────────────────────────────

export type RuntimeEvent =
  | ToolRequestedEvent
  | ToolStartedEvent
  | ToolVerifiedEvent
  | ToolFailedEvent
  | DoctorRunEvent;
