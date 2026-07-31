/**
 * noKeyClient — fallback LLM client used when an API key is required but absent.
 *
 * Instead of logging a console.warn and silently falling back to the mock,
 * this client surfaces a concise, actionable guidance message directly in the
 * Butler chat timeline so the user knows exactly what to do.
 *
 * ButlerChatView renders the stream as normal assistant text — no special
 * handling required.
 */

import type { LLMClient, LLMGenerateParams, LLMStreamChunk } from '../../types/llm';

const NO_KEY_MESSAGE =
  "⚠️ No API key configured. Press Ctrl+K and search 'Set key' to add one.";

export const noKeyClient: LLMClient = {
  async *generate(_params: LLMGenerateParams): AsyncGenerator<LLMStreamChunk> {
    yield { delta: NO_KEY_MESSAGE, done: false };
    yield { delta: '', done: true };
  },
};
