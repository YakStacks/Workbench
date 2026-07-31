/**
 * agent.planner — Mailman role for LLM-driven tool orchestration.
 *
 * Packet flow:
 *   agent.task  → agent.planner  (receives high-level instruction + tool list)
 *     ↓ (per tool call)
 *   task.assign → workbench.runner → task.result
 *     ↓ (loop until done or maxSteps)
 *   agent.result ← agent.planner  (final answer + tool call log)
 */

import axios from "axios";
import {
  Runtime,
  createPacket,
  createReply,
} from "@junkyard22/mailman";
import type { MailmanPacket } from "@junkyard22/mailman";

// ─────────────────────────────────────────────────────────────────────────────
//  Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AgentTaskPayload {
  instruction: string;
  tools: AgentToolDef[];
  maxSteps?: number;
  model?: string;
}

export interface AgentToolCall {
  tool: string;
  input: unknown;
  output: unknown;
  status: "success" | "error";
}

export interface AgentResultPayload {
  answer: string;
  stepsUsed: number;
  toolCalls: AgentToolCall[];
  status: "success" | "error";
  error?: string;
  critique?: string;
  criticApproved?: boolean;
  criticModel?: string;
}

export type AgentConfigFn = () => {
  apiKey: string | undefined;
  apiEndpoint: string;
  model: string | undefined;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** OpenAI function names cannot contain dots — encode/decode with __ */
const encodeName = (n: string) => n.replace(/\./g, "__");
const decodeName = (n: string) => n.replace(/__/g, ".");

function errorReply(packet: MailmanPacket, msg: string): MailmanPacket {
  return createReply(packet, "agent.result", "agent.planner", {
    status: "error",
    error: msg,
    answer: "",
    stepsUsed: 0,
    toolCalls: [],
  } as unknown as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Role registration
// ─────────────────────────────────────────────────────────────────────────────

export function registerAgentPlanner(
  runtime: Runtime,
  getConfig: AgentConfigFn,
  options?: { enableCritic?: boolean }
): void {
  runtime.registerRole(
    { name: "agent.planner", accepts: ["agent.task"] },
    async (packet: MailmanPacket): Promise<MailmanPacket> => {
      console.log("[agent.planner] invoked");

      let instruction: string;
      let tools: AgentToolDef[];
      let maxSteps: number;
      let modelOverride: string | undefined;

      try {
        const p = packet.payload as unknown as AgentTaskPayload;
        instruction = p.instruction;
        tools = p.tools ?? [];
        maxSteps = p.maxSteps ?? 8;
        modelOverride = p.model;
      } catch (err: any) {
        console.error("[agent.planner] payload parse error:", err?.message);
        return errorReply(packet, `Payload parse error: ${err?.message}`);
      }

      let apiKey: string | undefined;
      let apiEndpoint: string;
      let defaultModel: string | undefined;

      try {
        const cfg = getConfig();
        apiKey = cfg.apiKey;
        apiEndpoint = cfg.apiEndpoint;
        defaultModel = cfg.model;
      } catch (err: any) {
        console.error("[agent.planner] getConfig error:", err?.message);
        return errorReply(packet, `Config error: ${err?.message}`);
      }

      const model = modelOverride || defaultModel;
      console.log("[agent.planner] apiKey present:", !!apiKey, "model:", model);

      if (!apiKey) return errorReply(packet, "No OpenRouter API key configured (openrouterApiKey)");
      if (!model) return errorReply(packet, "No model configured for agent role");

      // Convert tool definitions to OpenAI function-calling format.
      const functions = tools.map((t) => ({
        type: "function",
        function: {
          name: encodeName(t.name),
          description: t.description || t.name,
          parameters: t.inputSchema || { type: "object", properties: {} },
        },
      }));

      const messages: any[] = [
        {
          role: "system",
          content:
            "You are an AI agent with access to tools. Use them to fulfil the user's request step by step. When you have gathered all the information needed, return a final plain-text answer without calling any more tools.",
        },
        { role: "user", content: instruction },
      ];

      const toolCallLog: AgentToolCall[] = [];
      let stepsUsed = 0;

      while (stepsUsed < maxSteps) {
        let res: any;
        try {
          res = await axios.post(
            `${apiEndpoint}/chat/completions`,
            { model, messages, tools: functions, tool_choice: "auto" },
            { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } }
          );
        } catch (err: any) {
          const fullData = err?.response?.data;
          const msg = err?.response?.data?.error?.message || err?.message || String(err);
          console.error("[agent.planner] axios error:", msg, "| full:", JSON.stringify(fullData));
          return errorReply(packet, `LLM request failed: ${msg}`);
        }

        const choice = res.data.choices?.[0];
        const message = choice?.message;
        console.log("[agent.planner] finish_reason:", choice?.finish_reason, "has_tool_calls:", !!message?.tool_calls?.length, "content:", String(message?.content).slice(0, 80));

        if (!message) break;
        messages.push(message);

        // No tool calls → LLM finished, optionally route through critic then return.
        if (!message.tool_calls?.length) {
          const answer = message.content || "";

          if (options?.enableCritic) {
            console.log("[agent.planner] forwarding to agent.critic");
            try {
              const critiquePacket = createPacket({
                type: "agent.critique",
                sender: "agent.planner",
                target: "agent.critic",
                taskId: packet.taskId,
                payload: { question: instruction, answer } as unknown as Record<string, unknown>,
              });
              const reviewReply = await runtime.send(critiquePacket);
              const review = reviewReply.payload as { critique: string; approved: boolean; model: string };
              console.log("[agent.planner] critic approved:", review.approved);
              return createReply(packet, "agent.result", "agent.planner", {
                status: "success",
                answer,
                stepsUsed,
                toolCalls: toolCallLog,
                critique: review.critique,
                criticApproved: review.approved,
                criticModel: review.model,
              } as unknown as Record<string, unknown>);
            } catch (err: any) {
              console.error("[agent.planner] critic error:", err?.message);
              // Critic failed — still return the answer without critique
            }
          }

          return createReply(packet, "agent.result", "agent.planner", {
            status: "success",
            answer,
            stepsUsed,
            toolCalls: toolCallLog,
          } as unknown as Record<string, unknown>);
        }

        // Execute each tool call through workbench.runner via Mailman.
        for (const call of message.tool_calls) {
          const toolName = decodeName(call.function.name);
          let input: unknown;
          try {
            input = JSON.parse(call.function.arguments);
          } catch {
            input = {};
          }

          const assignPacket = createPacket({
            type: "task.assign",
            sender: "agent.planner",
            target: "workbench.runner",
            taskId: packet.taskId,
            payload: { toolName, input },
          });

          const reply = await runtime.send(assignPacket);
          const { output, status, error } = reply.payload as {
            output: unknown;
            status: "success" | "error";
            error?: string;
          };

          toolCallLog.push({ tool: toolName, input, output, status });

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(output ?? error ?? "no output"),
          });
        }

        stepsUsed++;
      }

      return createReply(packet, "agent.result", "agent.planner", {
        status: "error",
        error: `Agent stopped after ${maxSteps} steps without a final answer`,
        answer: "",
        stepsUsed,
        toolCalls: toolCallLog,
      } as unknown as Record<string, unknown>);
    }
  );
}
