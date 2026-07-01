/**
 * WorkbenchRuntime — the interface between Shell/Apps and the execution layer.
 *
 * Rules:
 * - No Core types leak through this interface
 * - Apps depend ONLY on this interface, never on @workbench/core
 * - This interface can be satisfied by a local, remote, or mock runtime
 *
 * Phase A: runTool and runDoctor now accept workspaceId so the adapter can
 * route resulting events back into the correct chat timeline.
 * subscribeToEvents is now typed to Shell's RuntimeEvent (not unknown).
 */

import type { RuntimeEvent } from '../renderer/types/runtimeEvents';

export interface WorkbenchRuntime {
  /**
   * Execute a tool by name with arbitrary input.
   * workspaceId is used to route resulting events into the correct chat timeline.
   * Resolves with raw output; never throws — errors are returned as values.
   */
  runTool(input: {
    toolName: string;
    input?: unknown;
    workspaceId?: string;
  }): Promise<unknown>;

  /**
   * Run the diagnostic suite and return a summary report.
   * workspaceId routes the resulting doctor:run event into the correct chat timeline.
   */
  runDoctor(workspaceId?: string): Promise<unknown>;

  /**
   * Subscribe to all Shell-level runtime events.
   * Returns an unsubscribe function — callers MUST call it on cleanup.
   * Handler receives typed Shell RuntimeEvent (Core types never leak through).
   */
  subscribeToEvents(handler: (event: RuntimeEvent) => void): () => void;
}
