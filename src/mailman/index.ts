/**
 * Mailman singleton for Workbench.
 *
 * Owns the single Runtime instance for the lifetime of the main process.
 * Uses in-memory backends (no SQLite) so it works in Electron 29 / Node 20.
 *
 * Roles registered here:
 *   workbench.runner — executes a named tool and returns its normalized output
 */

import {
  Runtime,
  MemoryTraceStore,
  MemoryDLQStore,
  createPacket,
  createReply,
} from "@junkyard22/mailman";
import type { MailmanPacket, TelemetryEvent } from "@junkyard22/mailman";
import {
  registerAgentPlanner,
  type AgentConfigFn,
} from "./agent-planner";
import { registerAgentCritic } from "./agent-critic";

export type {
  AgentTaskPayload,
  AgentResultPayload,
  AgentToolDef,
  AgentToolCall,
} from "./agent-planner";

// ─────────────────────────────────────────────────────────────────────────────
//  Per-run trace routing
//
//  The singleton runtime emits telemetry for ALL packets.  We route each line
//  to the right chain-run callback by matching event.taskId (= runId).
// ─────────────────────────────────────────────────────────────────────────────

const traceCallbacks = new Map<string, (line: string) => void>();

export function registerTraceCallback(
  runId: string,
  cb: (line: string) => void
): void {
  traceCallbacks.set(runId, cb);
}

export function unregisterTraceCallback(runId: string): void {
  traceCallbacks.delete(runId);
}

function formatTrace(event: TelemetryEvent): string {
  const time = event.timestamp.slice(11, 23); // HH:mm:ss.mmm
  const id = event.packetId.slice(0, 8);
  const d = event.details ?? {};

  switch (event.type) {
    case "packet.received":
      return `[MM ${time}] ▸ RECEIVED    ${id}  type=${d.type}  target=${d.target}`;
    case "packet.validated":
      return `[MM ${time}] ▸ VALIDATED   ${id}`;
    case "packet.routed":
      return `[MM ${time}] ▸ ROUTED      ${id}  → ${d.role ?? "?"}`;
    case "handler.started":
      return `[MM ${time}] ▸ EXECUTING   ${id}  role=${d.role ?? "?"}`;
    case "handler.finished":
      return `[MM ${time}] ▸ FINISHED    ${id}  role=${d.role ?? "?"}`;
    case "packet.completed":
      return `[MM ${time}] ▸ COMPLETED   ${id}`;
    case "packet.failed":
      return `[MM ${time}] ▸ FAILED      ${id}${d.error ? `  error=${String(d.error).slice(0, 60)}` : ""}`;
    default:
      return `[MM ${time}] ▸ ${event.type}  (${id})`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Runtime singleton
// ─────────────────────────────────────────────────────────────────────────────

let _runtime: Runtime | null = null;

export type ToolRunnerFn = (
  toolName: string,
  input: unknown
) => Promise<unknown>;
export type NormalizerFn = (output: unknown) => any;

/**
 * Create and start the Mailman runtime.  Call once from main.ts after the
 * tools map is populated.
 *
 * @param toolRunner  Executes a named tool (must include permission enforcement).
 * @param normalizer  Normalises raw tool output to a stable shape.
 * @param getAgentConfig  Returns LLM credentials for the agent.planner role.
 */
export function initMailman(
  toolRunner: ToolRunnerFn,
  normalizer: NormalizerFn,
  getAgentConfig?: AgentConfigFn,
  criticModel?: string
): Runtime {
  const runtime = new Runtime({
    traceStore: new MemoryTraceStore(),
    dlq: new MemoryDLQStore(),
    customTypes: ["agent.task", "agent.result", "agent.critique", "agent.review"],
    onTelemetry: (event) => {
      const cb = traceCallbacks.get(event.taskId);
      if (cb) cb(formatTrace(event));
    },
  });

  // ── workbench.runner ──────────────────────────────────────────────────────
  // Receives task.assign packets from chain-executor, runs the tool, and
  // replies with task.result carrying { output, status, error? }.
  runtime.registerRole(
    { name: "workbench.runner", accepts: ["task.assign"] },
    async (packet: MailmanPacket): Promise<MailmanPacket> => {
      const { toolName, input } = packet.payload as {
        toolName: string;
        input: unknown;
      };

      try {
        const rawResult = await toolRunner(toolName, input);
        const normalized = normalizer(rawResult);

        // Tool returned an error payload (no exception thrown)
        if (normalized?.error) {
          return createReply(packet, "task.result", "workbench.runner", {
            output: normalized,
            status: "error",
          });
        }

        return createReply(packet, "task.result", "workbench.runner", {
          output: normalized,
          status: "success",
        });
      } catch (err: any) {
        return createReply(packet, "task.result", "workbench.runner", {
          output: null,
          status: "error",
          error: err.message,
        });
      }
    }
  );

  // ── agent.planner ─────────────────────────────────────────────────────────
  // LLM-driven agent: receives agent.task, calls workbench.runner for each
  // tool call, returns agent.result with the final answer.
  if (getAgentConfig) {
    registerAgentPlanner(runtime, getAgentConfig, { enableCritic: !!criticModel });
    if (criticModel) {
      registerAgentCritic(runtime, getAgentConfig, criticModel);
    }
  }

  runtime.start();
  _runtime = runtime;
  return runtime;
}

export function getMailmanRuntime(): Runtime {
  if (!_runtime) {
    throw new Error(
      "[Mailman] Runtime not initialized — call initMailman() first"
    );
  }
  return _runtime;
}
