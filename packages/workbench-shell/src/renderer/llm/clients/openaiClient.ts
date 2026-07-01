/**
 * openaiClient — fetch-based OpenAI chat completions client.
 *
 * Supports both streaming (SSE) and non-streaming responses.
 * Uses the standard /v1/chat/completions endpoint.
 * Respects AbortSignal for stop-generation support.
 *
 * No new npm dependencies — uses native fetch + ReadableStream.
 */

import type { LLMClient, LLMGenerateParams, LLMStreamChunk } from '../../types/llm';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAIMessage {
  role: string;
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// SSE data line prefix
const DATA_PREFIX = 'data: ';
const DONE_SIGNAL = '[DONE]';

async function* streamSSE(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<LLMStreamChunk> {
  if (!response.body) {
    throw new Error('[openaiClient] Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (potentially incomplete) line in buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(DATA_PREFIX)) continue;
        const jsonStr = trimmed.slice(DATA_PREFIX.length).trim();
        if (jsonStr === DONE_SIGNAL) {
          yield { delta: '', done: true };
          return;
        }
        try {
          const parsed = JSON.parse(jsonStr) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            yield { delta, done: false };
          }
        } catch {
          // Malformed SSE line — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { delta: '', done: true };
}

export function makeOpenAIClient(apiKey: string): LLMClient {
  return {
    async *generate(params: LLMGenerateParams): AsyncGenerator<LLMStreamChunk> {
      const body: OpenAIRequest = {
        model: params.model,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: params.stream ?? false,
      };

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: params.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`[openaiClient] HTTP ${response.status}: ${errText}`);
      }

      if (params.stream) {
        yield* streamSSE(response, params.signal);
      } else {
        const data = await response.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content ?? '';
        yield { delta: content, done: false };
        yield { delta: '', done: true };
      }
    },
  };
}
