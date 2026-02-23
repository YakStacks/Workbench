/**
 * Settings Store — lightweight app-wide flags persisted to disk.
 *
 * Replaces direct localStorage reads for:
 *   - workbench.hasBootstrapped
 *   - workbench.autoArtifacts
 *
 * Hydrates asynchronously from storageGet('settings', defaults).
 * Writes back on each setter.
 *
 * Migration: on first load, if disk is empty, reads the old localStorage keys
 * and promotes them to disk.
 */

import { create } from 'zustand';
import { storageGet, storageSet } from '../storage/storageClient';

// ============================================================================
// TYPES
// ============================================================================

interface SettingsData {
  hasBootstrapped: boolean;
  autoArtifacts: boolean;
}

const DEFAULTS: SettingsData = {
  hasBootstrapped: false,
  autoArtifacts: true,
};

// Old localStorage keys (for one-time migration)
const OLD_BOOTSTRAP_KEY = 'workbench.hasBootstrapped';
const OLD_AUTO_ARTIFACTS_KEY = 'workbench.autoArtifacts';

interface SettingsStoreState extends SettingsData {
  _hydrated: boolean;

  setHasBootstrapped(value: boolean): void;
  setAutoArtifacts(value: boolean): void;
}

// ============================================================================
// STORE
// ============================================================================

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  ...DEFAULTS,
  _hydrated: false,

  setHasBootstrapped: (value) => {
    set({ hasBootstrapped: value });
    const next: SettingsData = { ...get(), hasBootstrapped: value };
    storageSet('settings', next);
  },

  setAutoArtifacts: (value) => {
    set({ autoArtifacts: value });
    const next: SettingsData = { ...get(), autoArtifacts: value };
    storageSet('settings', next);
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
    // Disk data exists — hydrate directly
    useSettingsStore.setState({
      hasBootstrapped: fromDisk.hasBootstrapped ?? DEFAULTS.hasBootstrapped,
      autoArtifacts: fromDisk.autoArtifacts ?? DEFAULTS.autoArtifacts,
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

    const data: SettingsData = { hasBootstrapped, autoArtifacts };
    useSettingsStore.setState({ ...data, _hydrated: true });

    if (migrated) {
      // Promote to disk
      await storageSet('settings', data);
    }
  }

  _settings.resolve?.();
})();
