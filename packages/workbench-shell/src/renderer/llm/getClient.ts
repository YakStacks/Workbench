/**
 * getClient — factory that returns the active LLMClient based on settings.
 *
 * Reads provider + API keys from settingsStore at call time (not at import
 * time), so stale closures are not a concern.
 *
 * Returns mockClient when provider='mock' or when no API key is configured.
 */

import { useSettingsStore } from '../state/settingsStore';
import type { LLMClient } from '../types/llm';
import { mockClient } from './clients/mockClient';
import { makeOpenAIClient } from './clients/openaiClient';
import { makeAnthropicClient } from './clients/anthropicClient';

export function getClient(): LLMClient {
  const {
    llmProvider,
    openaiApiKey,
    anthropicApiKey,
  } = useSettingsStore.getState();

  switch (llmProvider) {
    case 'openai':
      if (!openaiApiKey) {
        console.warn('[getClient] OpenAI provider selected but no API key set — using mock');
        return mockClient;
      }
      return makeOpenAIClient(openaiApiKey);

    case 'anthropic':
      if (!anthropicApiKey) {
        console.warn('[getClient] Anthropic provider selected but no API key set — using mock');
        return mockClient;
      }
      return makeAnthropicClient(anthropicApiKey);

    case 'mock':
    default:
      return mockClient;
  }
}

/**
 * Returns the model string for the currently active provider.
 */
export function getActiveModel(): string {
  const {
    llmProvider,
    openaiModel,
    anthropicModel,
  } = useSettingsStore.getState();

  switch (llmProvider) {
    case 'openai':
      return openaiModel;
    case 'anthropic':
      return anthropicModel;
    case 'mock':
    default:
      return 'mock-1.0';
  }
}
