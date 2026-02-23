/**
 * Settings Store — lightweight app-wide flags persisted to disk.
 *
 * Replaces direct localStorage reads for:
 *   - workbench.hasBootstrapped
 *   - workbench.autoArtifacts
 *
 * Also stores LLM provider settings (provider, API keys, model, etc.).
 *
 * Hydrates asynchronously from storageGet('settings', defaults).
 * Writes back on each setter.
 *
 * Migration: on first load, if disk is empty, reads the old localStorage keys
 * and promotes them to disk.
 *
 * SECURITY: API keys are stored only in ~/.workbench/settings.v1.json on disk.
 * They are never logged or included in any console output.
 */

import { create } from 'zustand';
import { storageGet, storageSet } from '../storage/storageClient';
import type { LLMProviderId } from '../types/llm';

// ============================================================================
// TYPES
// ============================================================================

export interface SettingsData {
  hasBootstrapped: boolean;
  autoArtifacts: boolean;

  // LLM settings
  llmProvider: LLMProviderId;
  openaiApiKey: string;
  anthropicApiKey: string;
  openaiModel: string;
  anthropicModel: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
}

const DEFAULTS: SettingsData = {
  hasBootstrapped: false,
  autoArtifacts: true,

  llmProvider: 'mock',
  openaiApiKey: '',
  anthropicApiKey: '',
  openaiModel: 'gpt-4o',
  anthropicModel: 'claude-opus-4-5',
  temperature: 0.7,
  maxTokens: 2048,
  stream: true,
};

// Old localStorage keys (for one-time migration)
const OLD_BOOTSTRAP_KEY = 'workbench.hasBootstrapped';
const OLD_AUTO_ARTIFACTS_KEY = 'workbench.autoArtifacts';

interface SettingsStoreState extends SettingsData {
  _hydrated: boolean;

  setHasBootstrapped(value: boolean): void;
  setAutoArtifacts(value: boolean): void;
  setLlmProvider(value: LLMProviderId): void;
  setOpenaiApiKey(value: string): void;
  setAnthropicApiKey(value: string): void;
  setOpenaiModel(value: string): void;
  setAnthropicModel(value: string): void;
  setTemperature(value: number): void;
  setMaxTokens(value: number): void;
  setStream(value: boolean): void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Extracts only the SettingsData fields (excludes store internals). */
function toSettingsData(state: SettingsStoreState): SettingsData {
  return {
    hasBootstrapped: state.hasBootstrapped,
    autoArtifacts: state.autoArtifacts,
    llmProvider: state.llmProvider,
    openaiApiKey: state.openaiApiKey,
    anthropicApiKey: state.anthropicApiKey,
    openaiModel: state.openaiModel,
    anthropicModel: state.anthropicModel,
    temperature: state.temperature,
    maxTokens: state.maxTokens,
    stream: state.stream,
  };
}

// ============================================================================
// STORE
// ============================================================================

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  ...DEFAULTS,
  _hydrated: false,

  setHasBootstrapped: (value) => {
    set({ hasBootstrapped: value });
    storageSet('settings', toSettingsData(get()));
  },

  setAutoArtifacts: (value) => {
    set({ autoArtifacts: value });
    storageSet('settings', toSettingsData(get()));
  },

  setLlmProvider: (value) => {
    set({ llmProvider: value });
    storageSet('settings', toSettingsData(get()));
  },

  setOpenaiApiKey: (value) => {
    set({ openaiApiKey: value });
    storageSet('settings', toSettingsData(get()));
  },

  setAnthropicApiKey: (value) => {
    set({ anthropicApiKey: value });
    storageSet('settings', toSettingsData(get()));
  },

  setOpenaiModel: (value) => {
    set({ openaiModel: value });
    storageSet('settings', toSettingsData(get()));
  },

  setAnthropicModel: (value) => {
    set({ anthropicModel: value });
    storageSet('settings', toSettingsData(get()));
  },

  setTemperature: (value) => {
    set({ temperature: value });
    storageSet('settings', toSettingsData(get()));
  },

  setMaxTokens: (value) => {
    set({ maxTokens: value });
    storageSet('settings', toSettingsData(get()));
  },

  setStream: (value) => {
    set({ stream: value });
    storageSet('settings', toSettingsData(get()));
  },
}));

// ============================================================================
// ASYNC HYDRATION
// ============================================================================

const _settings = { resolve: null as (() => void) | null };
const _settingsReady = new Promise<void>((resolve) => {
  _settings.resolve = resolve;
});

/** Resolves once the settings store has been hydrated from disk. */
export function waitForSettings(): Promise<void> {
  return _settingsReady;
}

(async () => {
  const fromDisk = await storageGet<SettingsData | null>('settings', null);

  if (fromDisk != null) {
    // Disk data exists — hydrate directly, filling in any missing LLM fields
    // (handles upgrades where existing settings.v1.json predates LLM fields)
    useSettingsStore.setState({
      hasBootstrapped: fromDisk.hasBootstrapped ?? DEFAULTS.hasBootstrapped,
      autoArtifacts: fromDisk.autoArtifacts ?? DEFAULTS.autoArtifacts,
      llmProvider: fromDisk.llmProvider ?? DEFAULTS.llmProvider,
      openaiApiKey: fromDisk.openaiApiKey ?? DEFAULTS.openaiApiKey,
      anthropicApiKey: fromDisk.anthropicApiKey ?? DEFAULTS.anthropicApiKey,
      openaiModel: fromDisk.openaiModel ?? DEFAULTS.openaiModel,
      anthropicModel: fromDisk.anthropicModel ?? DEFAULTS.anthropicModel,
      temperature: fromDisk.temperature ?? DEFAULTS.temperature,
      maxTokens: fromDisk.maxTokens ?? DEFAULTS.maxTokens,
      stream: fromDisk.stream ?? DEFAULTS.stream,
      _hydrated: true,
    });
  } else {
    // No disk data — check old localStorage keys (migration)
    let hasBootstrapped = DEFAULTS.hasBootstrapped;
    let autoArtifacts = DEFAULTS.autoArtifacts;
    let migrated = false;

    try {
      const oldBootstrap = localStorage.getItem(OLD_BOOTSTRAP_KEY);
      if (oldBootstrap != null) {
        hasBootstrapped = oldBootstrap === 'true';
        migrated = true;
      }
      const oldAutoArtifacts = localStorage.getItem(OLD_AUTO_ARTIFACTS_KEY);
      if (oldAutoArtifacts != null) {
        autoArtifacts = oldAutoArtifacts !== 'false';
        migrated = true;
      }
    } catch {
      // localStorage unavailable — use defaults
    }

    const data: SettingsData = { ...DEFAULTS, hasBootstrapped, autoArtifacts };
    useSettingsStore.setState({ ...data, _hydrated: true });

    if (migrated) {
      // Promote to disk
      await storageSet('settings', data);
    }
  }

  _settings.resolve?.();
})();
