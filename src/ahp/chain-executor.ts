/**
 * AHP Chain Executor
 *
 * Executes a tool chain by routing every step through the Mailman runtime as
 * a task.assign → task.result packet exchange.  The chain-executor itself
 * has no knowledge of tools, permissions, or normalisation — all of that
 * lives in the workbench.runner role registered in src/mailman/index.ts.
 *
 * Backward compatibility:
 *   - {{key}} interpolation is preserved via resolveInput().
 *   - context.lastResult is still set after every step.
 *   - The returned object shape is unchanged (success, results, executionLog,
 *     context, ahpTrace, rootPacketId).
 */

import { createPacket } from "@junkyard22/mailman";
import type { Runtime, MailmanPacket, MailmanTraceEntry } from "@junkyard22/mailman";
import {
  registerTraceCallback,
  unregisterTraceCallback,
} from "../mailman";

// ─────────────────────────────────────────────────────────────────────────────
//  Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface AHPChainStep {
  tool: string;
  input: unknown;
  outputKey?: string;
  description?: string;
  dependsOn?: string[];
}

export interface AHPChainResult {
  success: boolean;
  failedAt?: number;
  error?: string;
  results: Array<{ tool: string; result: unknown }>;
  context: Record<string, unknown>;
  executionLog: Array<{
    step: number;
    tool: string;
    status: "success" | "failed";
    error?: string;
    output?: unknown;
  }>;
  ahpTrace?: MailmanTraceEntry[];
  rootPacketId?: string;
}

export interface AHPChainOptions {
  /** Unique identifier for this chain run — used as the packet taskId. */
  runId: string;
  /** Identity of the calling component. Defaults to "chain:run". */
  source?: string;
  /**
   * Called with a pre-formatted trace line for every Mailman telemetry event
   * scoped to this run.  Wire to mainWindow?.webContents.send('chain:trace').
   */
  onTrace?: (line: string) => void;
  /** Mailman runtime — obtained from getMailmanRuntime() in main.ts. */
  runtime: Runtime;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Input interpolation  ({{key}} → context value)
// ─────────────────────────────────────────────────────────────────────────────

export function resolveInput(
  input: unknown,
  context: Record<string, unknown>
): unknown {
  if (typeof input === "string") {
    return input.replace(/\{\{([^}]+)\}\}/g, (_: string, key: string) => {
      const value = (key as string)
        .split(".")
        .reduce((obj: unknown, k: string) => (obj as any)?.[k], context);
      return value !== undefined
        ? typeof value === "string"
          ? value
          : JSON.stringify(value)
        : `{{${key}}}`;
    });
  }
  if (Array.isArray(input)) {
    return input.map((item) => resolveInput(item, context));
  }
  if (typeof input === "object" && input !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = resolveInput(value, context);
    }
    return result;
  }
  return input;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Early-return helper to clean up trace callback + build result
// ─────────────────────────────────────────────────────────────────────────────

function earlyFail(
  runId: string,
  onTrace: ((line: string) => void) | undefined,
  runtime: Runtime,
  partial: Omit<AHPChainResult, "ahpTrace">
): AHPChainResult {
  if (onTrace) unregisterTraceCallback(runId);
  return { ...partial, ahpTrace: runtime.getTaskTrace(runId) };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main executor
// ─────────────────────────────────────────────────────────────────────────────

export async function executeChainWithAHP(
  steps: AHPChainStep[],
  options: AHPChainOptions
): Promise<AHPChainResult> {
  const { runId, source = "chain:run", onTrace, runtime } = options;

  if (onTrace) registerTraceCallback(runId, onTrace);

  const results: AHPChainResult["results"] = [];
  const executionLog: AHPChainResult["executionLog"] = [];
  const context: Record<string, unknown> = {};

  // The first packet's ID becomes the rootPacketId for callers that want to
  // anchor the trace (e.g. a debug panel showing the tree).
  let rootPacketId: string | undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const resolvedInput = resolveInput(step.input, context);

    const assignPacket = createPacket({
      type: "task.assign",
      sender: source,
      target: "workbench.runner",
      taskId: runId,
      ...(rootPacketId ? { parentPacketId: rootPacketId } : {}),
      payload: {
        toolName: step.tool,
        input: resolvedInput,
        stepIndex: i,
      },
      intent: step.description ?? `Execute ${step.tool} (step ${i + 1} of ${steps.length})`,
    });

    if (i === 0) rootPacketId = assignPacket.packetId;

    // ── Send to workbench.runner ───────────────────────────────────────────
    let reply: MailmanPacket;
    try {
      reply = await runtime.send(assignPacket);
    } catch (err: any) {
      // Runtime-level failure (handler threw or role not found)
      executionLog.push({
        step: i + 1,
        tool: step.tool,
        status: "failed",
        error: err.message,
      });
      return earlyFail(runId, onTrace, runtime, {
        success: false,
        failedAt: i + 1,
        error: `Step ${i + 1} (${step.tool}) dispatch error: ${err.message}`,
        results,
        context,
        executionLog,
        rootPacketId,
      });
    }

    const { output, status, error } = reply.payload as {
      output: any;
      status: "success" | "error";
      error?: string;
    };

    if (status === "error") {
      const errMsg = error ?? String(output?.error ?? "unknown error");
      executionLog.push({
        step: i + 1,
        tool: step.tool,
        status: "failed",
        error: errMsg,
        output,
      });
      return earlyFail(runId, onTrace, runtime, {
        success: false,
        failedAt: i + 1,
        error: `Tool "${step.tool}" failed: ${errMsg}`,
        results,
        context,
        executionLog,
        rootPacketId,
      });
    }

    // ── Context handoff ────────────────────────────────────────────────────
    if (step.outputKey) context[step.outputKey] = output;
    context[`step${i}`] = output;
    context.lastResult = output;

    results.push({ tool: step.tool, result: output });
    executionLog.push({ step: i + 1, tool: step.tool, status: "success", output });
  }

  if (onTrace) unregisterTraceCallback(runId);

  return {
    success: true,
    results,
    context,
    executionLog,
    ahpTrace: runtime.getTaskTrace(runId),
    rootPacketId,
  };
}
