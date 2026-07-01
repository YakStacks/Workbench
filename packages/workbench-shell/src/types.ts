/**
 * Workbench Shell — Core Type Contracts
 *
 * These interfaces define the boundary between Shell and Apps.
 * Apps implement these contracts. Shell consumes them.
 * Neither side reaches through the boundary.
 */

import type React from 'react';

// ============================================================================
// APP ROUTE / COMMAND
// ============================================================================

export interface AppRoute {
  path: string;
  /** Component to render when this route is active */
  component: React.ComponentType;
}

export interface AppCommand {
  id: string;
  label: string;
  execute(context: WorkbenchRuntimeContext): Promise<void>;
}

// ============================================================================
// APP
// ============================================================================

/**
 * WorkbenchApp — the installable unit.
 *
 * An App knows how to create Workspaces. That is its primary responsibility.
 * It may optionally declare routes, commands, and settings.
 *
 * Apps must NOT import from each other.
 * Apps must NOT access Shell internals directly.
 */
export interface WorkbenchApp {
  /** Stable unique identifier. Never change after shipping. */
  id: string;

  /** Display name shown in UI. */
  name: string;

  /** Lucide icon name or inline SVG string. Optional. */
  icon?: string;

  /**
   * Factory: create a new workspace instance for this app.
   * Called when the user opens a new workspace from this app.
   */
  createWorkspace(): Promise<WorkbenchWorkspace>;

  /** Optional sub-routes registered within this app's namespace. */
  routes?: AppRoute[];

  /** Commands this app contributes to the command palette. */
  commands?: AppCommand[];

  /** JSON Schema for this app's settings. Future-ready. */
  settingsSchema?: unknown;

  /**
   * Declares what runtime capabilities this app requires.
   * Shell checks capabilities before loading the app.
   * e.g. ['runTool', 'subscribeToEvents']
   */
  capabilities?: string[];
}

// ============================================================================
// WORKSPACE
// ============================================================================

/**
 * WorkbenchWorkspace — a single instance of an App.
 *
 * Each workspace is a stable entity with its own state,
 * persisted to disk and restored on restart.
 *
 * The workspace's render() is called by the Shell MainPanel.
 * The workspace is given a RuntimeContext via context prop.
 */
export interface WorkbenchWorkspace {
  /** Stable ID generated at creation time (uuid). */
  id: string;

  /** ID of the app that owns this workspace. */
  appId: string;

  /** Displayed in the tab bar and workspace card. */
  title: string;

  /**
   * Serializable state persisted to disk.
   * Must be JSON-serializable. No functions, no class instances.
   */
  state: WorkspaceState;

  /**
   * Returns the React node to render in the main panel.
   * Called by Shell. Must be pure given the current state.
   */
  render(): React.ReactNode;

  /** Called when the workspace tab becomes active. */
  onMount?(): void;

  /** Called when the workspace tab is closed or app shuts down. */
  onDispose?(): void;
}

/**
 * Serializable workspace state.
 * All values must survive JSON round-trip.
 * Uses interface (not type alias) to allow safe self-reference.
 */
export interface WorkspaceState {
  [key: string]: string | number | boolean | null | undefined | WorkspaceState | WorkspaceState[];
}

// ============================================================================
// RUNTIME CONTEXT
// ============================================================================

/**
 * WorkbenchRuntimeContext — the API surface exposed to Apps.
 *
 * Apps receive this via React context (useRuntimeContext hook).
 * Apps must NOT reach outside this context.
 *
 * Phase 1: Minimal surface. Expanded in Phase 6.
 */
export interface WorkbenchRuntimeContext {
  /** Run a named tool with input. Routed through Core runner. */
  runTool(toolName: string, input: unknown): Promise<unknown>;

  /** Subscribe to Core runtime events. Returns unsubscribe function. */
  subscribeToEvents(handler: (event: RuntimeEventSummary) => void): () => void;

  /** Get the latest Doctor diagnostic report. */
  getDoctorReport(): Promise<DoctorReportSummary>;
}

/**
 * Lightweight event summary passed to apps.
 * Does not expose Core internals.
 */
export interface RuntimeEventSummary {
  type: string;
  timestamp: number;
  label: string;
}

/**
 * Lightweight doctor summary passed to apps.
 */
export interface DoctorReportSummary {
  pass: number;
  warn: number;
  fail: number;
  timestamp: string;
}

// ============================================================================
// PERSISTED WORKSPACE RECORD
// ============================================================================

/**
 * The shape stored in ~/.workbench/workspaces.json.
 * Contains only serializable data; no render functions.
 */
export interface PersistedWorkspace {
  id: string;
  appId: string;
  title: string;
  state: WorkspaceState;
  lastOpened: string; // ISO timestamp
}
