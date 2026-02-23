/**
 * mockClient — deterministic LLM client for development / testing.
 *
 * Generates a canned response that echoes the last user message.
 * Supports optional streaming (yields word-by-word with a small delay).
 * Never makes network requests. No API key required.
 */

import type { LLMClient, LLMGenerateParams, LLMStreamChunk } from '../../types/llm';

const MOCK_DELAY_MS = 40; // delay between word chunks when streaming

function buildMockResponse(params: LLMGenerateParams): string {
  const lastUser = [...params.messages].reverse().find((m) => m.role === 'user');
  const echo = lastUser ? lastUser.content.slice(0, 120) : '(no input)';
  return `[Mock LLM] You said: "${echo}"\n\nThis is a simulated response. Configure a real provider in Settings (Ctrl+K → set LLM provider) to get actual AI responses.`;
}

async function* streamWords(text: string, signal?: AbortSignal): AsyncGenerator<LLMStreamChunk> {
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    if (signal?.aborted) {
      return;
    }
    const delta = (i === 0 ? '' : ' ') + words[i];
    yield { delta, done: false };
    // Small async pause to simulate streaming
    await new Promise<void>((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
  }
  yield { delta: '', done: true };
}

export const mockClient: LLMClient = {
  async *generate(params: LLMGenerateParams): AsyncGenerator<LLMStreamChunk> {
    const response = buildMockResponse(params);

    if (params.stream) {
      yield* streamWords(response, params.signal);
    } else {
      // Non-streaming: yield full response as single chunk
      yield { delta: response, done: false };
      yield { delta: '', done: true };
    }
  },
};
