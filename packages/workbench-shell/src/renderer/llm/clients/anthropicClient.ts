/**
 * anthropicClient — fetch-based Anthropic Messages API client.
 *
 * Supports both streaming (SSE) and non-streaming responses.
 * Uses the /v1/messages endpoint with anthropic-version header.
 * Respects AbortSignal for stop-generation support.
 *
 * No new npm dependencies — uses native fetch + ReadableStream.
 */

import type { LLMClient, LLMGenerateParams, LLMStreamChunk, LLMMessage } from '../../types/llm';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  stream?: boolean;
}

const DATA_PREFIX = 'data: ';

/** Separate system prompt from conversational messages for Anthropic API. */
function splitSystemAndMessages(messages: LLMMessage[]): {
  system: string | undefined;
  convoMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n') || undefined;

  const convoMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  return { system, convoMessages };
}

async function* streamSSE(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<LLMStreamChunk> {
  if (!response.body) {
    throw new Error('[anthropicClient] Response body is null');
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
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith(DATA_PREFIX)) continue;
        const jsonStr = trimmed.slice(DATA_PREFIX.length).trim();
        try {
          const parsed = JSON.parse(jsonStr) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield { delta: parsed.delta.text, done: false };
          } else if (parsed.type === 'message_stop') {
            yield { delta: '', done: true };
            return;
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

export function makeAnthropicClient(apiKey: string): LLMClient {
  return {
    async *generate(params: LLMGenerateParams): AsyncGenerator<LLMStreamChunk> {
      const { system, convoMessages } = splitSystemAndMessages(params.messages);

      const body: AnthropicRequest = {
        model: params.model,
        max_tokens: params.maxTokens ?? 2048,
        messages: convoMessages,
        temperature: params.temperature,
        stream: params.stream ?? false,
      };
      if (system) {
        body.system = system;
      }

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: params.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`[anthropicClient] HTTP ${response.status}: ${errText}`);
      }

      if (params.stream) {
        yield* streamSSE(response, params.signal);
      } else {
        const data = await response.json() as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const textBlock = data.content?.find((b) => b.type === 'text');
        const content = textBlock?.text ?? '';
        yield { delta: content, done: false };
        yield { delta: '', done: true };
      }
    },
  };
}
