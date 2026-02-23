/**
 * Workspace Store — persistence of workspaces to disk.
 *
 * Persists to localStorage in browser context.
 * In Electron, this is backed by a file via the preload bridge (future).
 *
 * Phase 1: localStorage persistence (sufficient for dev/renderer).
 * Phase 6: Bridge to ~/.workbench/workspaces.json via IPC.
 *
 * Separate from shellStore intentionally:
 * - shellStore = ephemeral UI state (open tabs, active view)
 * - workspaceStore = durable data (all known workspaces)
 */

import { create } from 'zustand';
import type { PersistedWorkspace } from '../../types';

const STORAGE_KEY = 'workbench:workspaces';

// ============================================================================
// HELPERS
// ============================================================================

function load(): PersistedWorkspace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PersistedWorkspace[];
  } catch {
    return [];
  }
}

function save(workspaces: PersistedWorkspace[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  } catch {
    // Storage unavailable — fail silently in Phase 1
  }
}

// ============================================================================
// STORE
// ============================================================================

interface WorkspaceStoreState {
  workspaces: PersistedWorkspace[];

  upsertWorkspace(ws: PersistedWorkspace): void;
  deleteWorkspace(id: string): void;
  touchWorkspace(id: string): void; // updates lastOpened to now
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  workspaces: load(),

  upsertWorkspace: (ws) => {
    const existing = get().workspaces;
    const idx = existing.findIndex((w) => w.id === ws.id);
    const next = idx === -1
      ? [...existing, ws]
      : existing.map((w, i) => (i === idx ? ws : w));
    save(next);
    set({ workspaces: next });
  },

  deleteWorkspace: (id) => {
    const next = get().workspaces.filter((w) => w.id !== id);
    save(next);
    set({ workspaces: next });
  },

  touchWorkspace: (id) => {
    const next = get().workspaces.map((w) =>
      w.id === id ? { ...w, lastOpened: new Date().toISOString() } : w
    );
    save(next);
    set({ workspaces: next });
  },
}));
