/**
 * Workspace Store — persistence of workspaces to disk.
 *
 * Phase C: Hydrates asynchronously from storageGet('workspaces', []).
 * In Electron, data is stored in ~/.workbench/workspaces.v1.json.
 * In Vite renderer-only dev mode, falls back to localStorage.
 *
 * Migration: on first load, if disk is empty, promotes data from the
 * old localStorage key ('workbench:workspaces') to disk.
 *
 * Separate from shellStore intentionally:
 * - shellStore = ephemeral UI state (open tabs, active view)
 * - workspaceStore = durable data (all known workspaces)
 */

import { create } from 'zustand';
import type { PersistedWorkspace } from '../../types';
import { storageGet, storageSet } from '../storage/storageClient';

// Old localStorage key (migration only)
const OLD_STORAGE_KEY = 'workbench:workspaces';

// ============================================================================
// HYDRATION PROMISE
// ============================================================================

const _ws = { resolve: null as (() => void) | null };
const _wsReady = new Promise<void>((resolve) => {
  _ws.resolve = resolve;
});

/** Resolves once workspaceStore has been hydrated from disk. */
export function waitForHydration(): Promise<void> {
  return _wsReady;
}

// ============================================================================
// STORE
// ============================================================================

interface WorkspaceStoreState {
  workspaces: PersistedWorkspace[];

  upsertWorkspace(ws: PersistedWorkspace): void;
  deleteWorkspace(id: string): void;
  touchWorkspace(id: string): void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  workspaces: [],

  upsertWorkspace: (ws) => {
    const existing = get().workspaces;
    const idx = existing.findIndex((w) => w.id === ws.id);
    const next = idx === -1
      ? [...existing, ws]
      : existing.map((w, i) => (i === idx ? ws : w));
    set({ workspaces: next });
    storageSet('workspaces', next);
  },

  deleteWorkspace: (id) => {
    const next = get().workspaces.filter((w) => w.id !== id);
    set({ workspaces: next });
    storageSet('workspaces', next);
  },

  touchWorkspace: (id) => {
    const next = get().workspaces.map((w) =>
      w.id === id ? { ...w, lastOpened: new Date().toISOString() } : w
    );
    set({ workspaces: next });
    storageSet('workspaces', next);
  },
}));

// ============================================================================
// ASYNC HYDRATION (runs once at module load)
// ============================================================================

(async () => {
  const fromDisk = await storageGet<PersistedWorkspace[] | null>('workspaces', null);

  if (fromDisk != null) {
    useWorkspaceStore.setState({ workspaces: fromDisk });
  } else {
    // No disk data — migrate from old localStorage key
    try {
      const raw = localStorage.getItem(OLD_STORAGE_KEY);
      if (raw) {
        const migrated = JSON.parse(raw) as PersistedWorkspace[];
        useWorkspaceStore.setState({ workspaces: migrated });
        await storageSet('workspaces', migrated);
      }
    } catch {
      // localStorage unavailable or unparseable — start fresh
    }
  }

  _ws.resolve?.();
})();
