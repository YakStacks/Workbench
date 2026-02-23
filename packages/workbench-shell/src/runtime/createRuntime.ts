/**
 * Runtime Factory — the ONLY file in Shell that imports from Workbench Core.
 *
 * Why sub-path imports instead of the Core barrel (@workbench/core)?
 * The barrel re-exports doctor.ts, which imports child_process / fs / os / net.
 * Those are Node-only built-ins that Vite cannot bundle for the renderer.
 * events.ts and runner.ts are pure JS — safe in both browser and Electron.
 *
 * Doctor integration requires Electron IPC (Phase 8+). Stub provided here.
 *
 * Architecture contract:
 * - Only this file touches Core symbols
 * - Core types (RuntimeEvent, ToolSpec, etc.) never escape this file
 * - The returned WorkbenchRuntime uses only `unknown` at its boundary
 */

import { eventBus } from '@workbench/core/events';
import { runnerRegistry } from '@workbench/core/runner';
import type { WorkbenchRuntime } from './types';

export function createRuntime(): WorkbenchRuntime {
  return {
    // ── Tool execution ──────────────────────────────────────────────────────
    async runTool(input: unknown): Promise<unknown> {
      const raw = input as {
        name?: string;
        command?: string;
        payload?: unknown;
        cwd?: string;
        timeout?: number;
      };

      const toolSpec = {
        name: raw.name ?? 'unknown',
        command: raw.command,
        input: raw.payload,
        cwd: raw.cwd,
        timeout: raw.timeout,
      };

      const runner = runnerRegistry.findRunner(toolSpec);
      if (!runner) {
        return { error: 'No runner found for tool spec.' };
      }

      try {
        const plan = runner.prepare(toolSpec, raw.payload);
        const result = await runner.execute(plan);
        // Emit success event so LogDrawer can observe
        eventBus.emit({
          type: 'tool:verified',
          toolName: toolSpec.name,
          runId: `run-${Date.now()}`,
          status: 'PASS',
          timestamp: Date.now(),
        });
        return result;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        // Emit failure event so LogDrawer can observe
        eventBus.emit({
          type: 'tool:failed',
          toolName: toolSpec.name,
          runId: `run-${Date.now()}`,
          reason,
          timestamp: Date.now(),
        });
        // Return structured error — do not throw; apps get a value they can inspect
        return { error: reason };
      }
    },

    // ── Event subscription ──────────────────────────────────────────────────
    subscribeToEvents(handler: (event: unknown) => void): () => void {
      // Bridge: Core EventHandler expects RuntimeEvent; our interface uses unknown.
      // Wrapping lambda avoids any unsafe cast.
      return eventBus.onAll((event) => handler(event));
    },

    // ── Doctor ──────────────────────────────────────────────────────────────
    async runDoctor(): Promise<unknown> {
      // Doctor (runDiagnostics) imports child_process / fs / os / net.
      // Those are Node-only and cannot run in the Vite renderer bundle.
      // Phase 8 will bridge this via Electron IPC (ipcRenderer.invoke).
      return {
        timestamp: new Date().toISOString(),
        pass: 0,
        warn: 1,
        fail: 0,
        results: [],
        note: 'Doctor diagnostics require Electron IPC context. Bridge arrives in Phase 8.',
      };
    },
  };
}
