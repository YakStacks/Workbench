/**
 * agent.critic — Mailman role for LLM-driven answer review.
 *
 * Packet flow:
 *   agent.critique → agent.critic  (receives question + answer from agent.planner)
 *   agent.review   ← agent.critic  (returns critique + approved flag)
 */

import axios from "axios";
import { Runtime, createReply } from "@junkyard22/mailman";
import type { MailmanPacket } from "@junkyard22/mailman";
import type { AgentConfigFn } from "./agent-planner";

export interface AgentCritiquePayload {
  question: string;
  answer: string;
}

export interface AgentReviewPayload {
  critique: string;
  approved: boolean;
  model: string;
}

export function registerAgentCritic(
  runtime: Runtime,
  getConfig: AgentConfigFn,
  criticModel: string
): void {
  runtime.registerRole(
    { name: "agent.critic", accepts: ["agent.critique"] },
    async (packet: MailmanPacket): Promise<MailmanPacket> => {
      console.log("[agent.critic] invoked, model:", criticModel);

      const { question, answer } = packet.payload as unknown as AgentCritiquePayload;

      let apiKey: string | undefined;
      let apiEndpoint: string;

      try {
        const cfg = getConfig();
        apiKey = cfg.apiKey;
        apiEndpoint = cfg.apiEndpoint;
      } catch (err: any) {
        console.error("[agent.critic] getConfig error:", err?.message);
        return createReply(packet, "agent.review", "agent.critic", {
          critique: `Config error: ${err?.message}`,
          approved: false,
          model: criticModel,
        } as unknown as Record<string, unknown>);
      }

      if (!apiKey) {
        return createReply(packet, "agent.review", "agent.critic", {
          critique: "No API key configured",
          approved: false,
          model: criticModel,
        } as unknown as Record<string, unknown>);
      }

      try {
        const res = await axios.post(
          `${apiEndpoint}/chat/completions`,
          {
            model: criticModel,
            messages: [
              {
                role: "system",
                content:
                  "You are a concise answer reviewer. Given a question and an answer, evaluate accuracy and completeness in 1-2 sentences. End with 'Approved.' or 'Not approved.'",
              },
              {
                role: "user",
                content: `Question: ${question}\n\nAnswer: ${answer}`,
              },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        const critique: string = res.data.choices?.[0]?.message?.content || "No critique produced";
        const approved = critique.toLowerCase().includes("approved") && !critique.toLowerCase().includes("not approved");

        console.log("[agent.critic] critique:", critique.slice(0, 100));

        return createReply(packet, "agent.review", "agent.critic", {
          critique,
          approved,
          model: criticModel,
        } as unknown as Record<string, unknown>);
      } catch (err: any) {
        const fullData = err?.response?.data;
        const msg = err?.response?.data?.error?.message || err?.message || String(err);
        console.error("[agent.critic] axios error:", msg, "| full:", JSON.stringify(fullData));
        return createReply(packet, "agent.review", "agent.critic", {
          critique: `LLM error: ${msg}`,
          approved: false,
          model: criticModel,
        } as unknown as Record<string, unknown>);
      }
    }
  );
}
