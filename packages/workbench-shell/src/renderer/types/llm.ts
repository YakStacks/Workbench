/**
 * LLM type definitions — shared across provider clients.
 *
 * All clients implement LLMClient. No external dependencies.
 * Streaming yields LLMStreamChunk objects; the final chunk has done=true.
 */

// ============================================================================
// PROVIDER
// ============================================================================

export type LLMProviderId = 'mock' | 'openai' | 'anthropic';

// ============================================================================
// MESSAGES
// ============================================================================

export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

// ============================================================================
// REQUEST / RESPONSE
// ============================================================================

export interface LLMGenerateParams {
  messages: LLMMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface LLMStreamChunk {
  /** Incremental text delta (may be empty on final chunk) */
  delta: string;
  /** True on the last chunk */
  done: boolean;
}

// ============================================================================
// CLIENT INTERFACE
// ============================================================================

export interface LLMClient {
  /**
   * Generate a response.
   * - If params.stream=true, yields incremental chunks via async generator.
   * - If params.stream=false (or omitted), yields a single chunk with the full
   *   response and done=true.
   */
  generate(params: LLMGenerateParams): AsyncGenerator<LLMStreamChunk>;
}
