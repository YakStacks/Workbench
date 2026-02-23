/**
 * WorkbenchRuntime — the interface between Shell/Apps and the execution layer.
 *
 * Rules:
 * - No Core types leak through this interface (all unknown)
 * - Apps depend ONLY on this interface, never on @workbench/core
 * - This interface can be satisfied by a local, remote, or mock runtime
 */

export interface WorkbenchRuntime {
  /**
   * Execute a tool by name with arbitrary input.
   * Resolves with raw output or rejects with a structured error.
   */
  runTool(input: unknown): Promise<unknown>;

  /**
   * Subscribe to all runtime events.
   * Returns an unsubscribe function — callers MUST call it on cleanup.
   */
  subscribeToEvents(handler: (event: unknown) => void): () => void;

  /**
   * Run the diagnostic suite and return a summary report.
   */
  runDoctor(): Promise<unknown>;
}
