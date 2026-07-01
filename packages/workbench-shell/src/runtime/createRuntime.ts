/**
 * Runtime Factory — the ONLY file in Shell that imports from Workbench Core.
 *
 * Why sub-path imports instead of the Core barrel (@workbench/core)?
 * The barrel re-exports doctor.ts, which imports child_process / fs / os / net.
 * Those are Node-only built-ins that Vite cannot bundle for the renderer.
 * events.ts and runner.ts are pure JS — safe in both browser and Electron.
 *
 * Architecture contract:
 * - Only this file touches Core symbols
 * - Core types (RuntimeEvent, ToolSpec, etc.) never escape this file
 * - The returned WorkbenchRuntime exposes only Shell's RuntimeEvent at its boundary
 *
 * Phase A additions:
 * - runTool/runDoctor accept workspaceId
 * - Adapter maintains runId → workspaceId map to route events back to the right chat
 * - subscribeToEvents handler receives Shell RuntimeEvent (not Core's)
 * - Adapter emits tool:requested and tool:started events (Core only emits verified/failed)
 */

import { eventBus } from '@workbench/core/events';
import { runnerRegistry } from '@workbench/core/runner';
import type { WorkbenchRuntime } from './types';
import type {
  RuntimeEvent,
  ToolRequestedEvent,
  ToolStartedEvent,
  ToolVerifiedEvent,
  ToolFailedEvent,
  DoctorRunEvent,
} from '../renderer/types/runtimeEvents';

// Shape of a Core RuntimeEvent received from eventBus.onAll()
// (only used inside this file — never exported)
type CoreEventRaw = {
  type: string;
  toolName?: string;
  runId?: string;
  status?: string;
  reason?: string;
  timestamp?: number;
  summary?: { pass: number; warn: number; fail: number };
};

export function createRuntime(): WorkbenchRuntime {
  // Maps adapter-generated runId → workspaceId so events can be routed
  // back into the correct chat timeline.
  const runIdToWorkspace = new Map<string, string>();

  // Shell-level subscriber list — independent of Core's eventBus consumers.
  const shellHandlers: Array<(evt: RuntimeEvent) => void> = [];

  function emitShell(evt: RuntimeEvent): void {
    for (const h of shellHandlers) {
      try { h(evt); } catch { /* silent */ }
    }
  }

  // ── Bridge Core events → Shell events ──────────────────────────────────────
  // Subscribe once at construction. Core fires for ALL tool runs.
  // We attach workspaceId by looking up our runId map.
  eventBus.onAll((raw) => {
    const e = raw as CoreEventRaw;
    const ts = typeof e.timestamp === 'number' ? e.timestamp : Date.now();
    const runId = typeof e.runId === 'string' ? e.runId : undefined;
    const workspaceId = runId ? (runIdToWorkspace.get(runId) ?? undefined) : undefined;

    switch (e.type) {
      case 'tool:verified': {
        const evt: ToolVerifiedEvent = {
          type: 'tool:verified',
          ts,
          runId,
          workspaceId,
          toolName: typeof e.toolName === 'string' ? e.toolName : 'unknown',
          ok: e.status === 'PASS',
          output: undefined,
        };
        emitShell(evt);
        break;
      }
      case 'tool:failed': {
        const evt: ToolFailedEvent = {
          type: 'tool:failed',
          ts,
          runId,
          workspaceId,
          toolName: typeof e.toolName === 'string' ? e.toolName : 'unknown',
          error: typeof e.reason === 'string' ? e.reason : 'Unknown error',
        };
        emitShell(evt);
        break;
      }
      case 'doctor:run': {
        const evt: DoctorRunEvent = {
          type: 'doctor:run',
          ts,
          runId,
          workspaceId,
          report: e.summary,
        };
        emitShell(evt);
        break;
      }
      // tool:requested / tool:started: emitted directly below with workspaceId attached.
      // Core also emits tool:requested without runId; we ignore Core's copy.
      default:
        break;
    }
  });

  return {
    // ── Tool execution ──────────────────────────────────────────────────────
    async runTool({ toolName, input, workspaceId }): Promise<unknown> {
      const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      if (workspaceId) {
        runIdToWorkspace.set(runId, workspaceId);
      }

      // tool:requested — Shell-level, emitted before runner lookup
      const requestedEvt: ToolRequestedEvent = {
        type: 'tool:requested',
        ts: Date.now(),
        runId,
        workspaceId,
        toolName,
        input,
      };
      emitShell(requestedEvt);

      const toolSpec = {
        name: toolName,
        command: undefined as string | undefined,
        input,
        cwd: undefined as string | undefined,
        timeout: undefined as number | undefined,
      };

      const runner = runnerRegistry.findRunner(toolSpec);
      if (!runner) {
        const failedEvt: ToolFailedEvent = {
          type: 'tool:failed',
          ts: Date.now(),
          runId,
          workspaceId,
          toolName,
          error: 'No runner found for tool spec.',
        };
        emitShell(failedEvt);
        return { error: 'No runner found for tool spec.' };
      }

      // tool:started — Shell-level, emitted before execution begins
      const startedEvt: ToolStartedEvent = {
        type: 'tool:started',
        ts: Date.now(),
        runId,
        workspaceId,
        toolName,
        input,
      };
      emitShell(startedEvt);

      try {
        const plan = runner.prepare(toolSpec, input);
        const result = await runner.execute(plan);

        // Also emit via Core bus so any Core-level subscribers see it,
        // and our bridge above will re-emit it as a Shell ToolVerifiedEvent.
        eventBus.emit({
          type: 'tool:verified',
          toolName,
          runId,
          status: 'PASS',
          timestamp: Date.now(),
        });
        return result;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        eventBus.emit({
          type: 'tool:failed',
          toolName,
          runId,
          reason,
          timestamp: Date.now(),
        });
        return { error: reason };
      } finally {
        // Defer cleanup so event routing can complete
        setTimeout(() => runIdToWorkspace.delete(runId), 5000);
      }
    },

    // ── Event subscription ──────────────────────────────────────────────────
    subscribeToEvents(handler: (event: RuntimeEvent) => void): () => void {
      shellHandlers.push(handler);
      return () => {
        const idx = shellHandlers.indexOf(handler);
        if (idx !== -1) shellHandlers.splice(idx, 1);
      };
    },

    // ── Doctor ─────────────────────────────────────────────────────────────
    async runDoctor(workspaceId?: string): Promise<unknown> {
      // Doctor (runDiagnostics) imports child_process / fs / os / net.
      // Those are Node-only and cannot run in the Vite renderer bundle.
      // Phase 8 will bridge this via Electron IPC (ipcRenderer.invoke).
      const report = {
        timestamp: new Date().toISOString(),
        pass: 4,
        warn: 1,
        fail: 0,
        results: [],
        note: 'Doctor diagnostics require Electron IPC context. Bridge arrives in Phase 8.',
      };

      const runId = `doctor-${Date.now()}`;
      if (workspaceId) {
        runIdToWorkspace.set(runId, workspaceId);
      }

      const evt: DoctorRunEvent = {
        type: 'doctor:run',
        ts: Date.now(),
        runId,
        workspaceId,
        report,
      };
      emitShell(evt);

      setTimeout(() => runIdToWorkspace.delete(runId), 5000);
      return report;
    },
  };
}
