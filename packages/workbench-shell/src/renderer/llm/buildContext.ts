/**
 * buildContext — Build the LLM message array for a Butler workspace request.
 *
 * Phase M6: replaces the simple buildLLMMessages() helper in ButlerChatView.
 *
 * Algorithm:
 *   1. System primer message (always included).
 *   2. If settings.includeSummary and summary is non-empty → summary as a
 *      system message prefixed with "Conversation summary:\n".
 *   3. If settings.includePinned → pinned messages (in chronological order,
 *      deduped, regardless of age).
 *   4. Recent messages that fit within the remaining token budget,
 *      working backwards from the newest.  User messages whose id is in
 *      includeMessageIds are also always included (within budget check).
 *
 * Token estimation: Math.ceil(text.length / 4)  (chars → rough tokens).
 *
 * Returns { messages: LLMMessage[], approxTokens: number }
 * where approxTokens is the total estimated cost of the returned messages
 * (excluding the primer since it's always fixed).
 *
 * No `any`.
 */

import type { LLMMessage } from '../types/llm';
import type { ChatMessage } from '../types/chat';
import { useChatStore } from '../state/chatStore';
import { useContextStore } from '../state/contextStore';

// ============================================================================
// TOKEN HELPERS
// ============================================================================

/** Rough token estimate: 1 token ≈ 4 characters. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================================
// PUBLIC API
// ============================================================================

export interface BuildContextResult {
  messages: LLMMessage[];
  approxTokens: number;
}

export interface BuildContextArgs {
  workspaceId: string;
  /** The Butler system primer (injected as the first system message). */
  systemPrimer: string;
}

export function buildLLMContext(args: BuildContextArgs): BuildContextResult {
  const { workspaceId, systemPrimer } = args;

  const allMessages: ChatMessage[] = useChatStore.getState().getMessages(workspaceId);
  const ctx = useContextStore.getState().getContext(workspaceId);
  const { summary, pinnedMessageIds, includeMessageIds, settings } = ctx;
  const { includeSummary, includePinned, maxContextTokens } = settings;

  const result: LLMMessage[] = [];
  let tokenCount = 0;

  // ── Helper: convert ChatMessage to LLMMessage ────────────────────────────
  function toLL(msg: ChatMessage): LLMMessage | null {
    if (msg.role === 'user' || msg.role === 'assistant') {
      return { role: msg.role, content: msg.content };
    }
    if (msg.role === 'system') {
      return { role: 'system', content: msg.content };
    }
    // tool messages → not sent to LLM directly
    return null;
  }

  // ── 1. System primer (always, not counted against budget) ────────────────
  result.push({ role: 'system', content: systemPrimer });
  // Primer tokens are not counted in approxTokens (they're fixed overhead).

  // ── 2. Summary (if enabled and non-empty) ────────────────────────────────
  if (includeSummary && summary.trim().length > 0) {
    const summaryContent = `Conversation summary:\n${summary.trim()}`;
    const toks = estimateTokens(summaryContent);
    if (tokenCount + toks <= maxContextTokens) {
      result.push({ role: 'system', content: summaryContent });
      tokenCount += toks;
    }
  }

  // ── 3. Pinned messages (in chronological order) ───────────────────────────
  if (includePinned && pinnedMessageIds.length > 0) {
    const pinnedSet = new Set(pinnedMessageIds);
    const pinnedMessages = allMessages
      .filter((m) => pinnedSet.has(m.id))
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const msg of pinnedMessages) {
      const ll = toLL(msg);
      if (!ll) continue;
      const toks = estimateTokens(ll.content);
      if (tokenCount + toks <= maxContextTokens) {
        result.push(ll);
        tokenCount += toks;
      }
    }
  }

  // ── 4. Recent messages (working backwards, fitting within budget) ─────────
  // We also always include messages in includeMessageIds if they fit.
  const alreadyIncluded = new Set(result.map((_, i) => i)); // by position — we'll track by id
  const includedMsgIds = new Set(includeMessageIds);

  // Collect only user/assistant/system messages (no tool) in chronological order
  const sendable = allMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .filter((m) => !pinnedMessageIds.includes(m.id)); // don't double-add pinned

  // Build a set we've already committed (pinned ids)
  const committedIds = new Set(
    allMessages
      .filter((m) => pinnedMessageIds.includes(m.id))
      .map((m) => m.id)
  );

  // Walk from newest → oldest, collect what fits
  const recent: LLMMessage[] = [];
  for (let i = sendable.length - 1; i >= 0; i--) {
    const msg = sendable[i];
    if (committedIds.has(msg.id)) continue; // already pinned
    const ll = toLL(msg);
    if (!ll) continue;
    const toks = estimateTokens(ll.content);

    // Always include explicitly-included messages if they fit
    const mustInclude = includedMsgIds.has(msg.id);

    if (mustInclude || tokenCount + toks <= maxContextTokens) {
      recent.unshift(ll); // prepend to maintain chronological order
      if (!mustInclude) tokenCount += toks; // don't double-count mustInclude
      else if (tokenCount + toks <= maxContextTokens) tokenCount += toks;
    }
  }

  result.push(...recent);

  return {
    messages: result,
    approxTokens: tokenCount,
  };
}
