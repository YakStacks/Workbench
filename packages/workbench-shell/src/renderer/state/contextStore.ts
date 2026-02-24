/**
 * Context Store — per-workspace context settings and state.
 *
 * Phase M: Workspace Context Controls.
 *
 * Persisted to disk via storageGet/storageSet('context').
 * Falls back to localStorage in Vite dev mode.
 *
 * Shape on disk: Record<string, WorkspaceContextState>  (keyed by workspaceId)
 *
 * Actions:
 *   ensure(workspaceId)             — ensure state entry exists (idempotent)
 *   setSummary(workspaceId, text)   — set the workspace summary text
 *   togglePin(workspaceId, msgId)   — toggle a message in pinnedMessageIds
 *   setIncludeMessage(ws, id, bool) — add/remove from includeMessageIds
 *   resetContext(workspaceId)       — clear summary + pins + includes + reset settings
 *   setSettings(workspaceId, patch) — partial-update WorkspaceContextSettings
 *   clearWorkspace(workspaceId)     — delete state on workspace delete
 */

import { create } from 'zustand';
import type { WorkspaceContextState, WorkspaceContextSettings } from '../types/context';
import { DEFAULT_CONTEXT_SETTINGS } from '../types/context';
import { storageGet, storageSet } from '../storage/storageClient';

// ============================================================================
// HELPERS
// ============================================================================

function makeDefault(workspaceId: string): WorkspaceContextState {
  return {
    workspaceId,
    summary: '',
    pinnedMessageIds: [],
    includeMessageIds: [],
    settings: { ...DEFAULT_CONTEXT_SETTINGS },
  };
}

// ============================================================================
// STORE SHAPE
// ============================================================================

type ContextMap = Record<string, WorkspaceContextState>;

interface ContextStoreState {
  /** All workspace context states, keyed by workspaceId. */
  contextByWorkspaceId: ContextMap;

  /** Get context for a workspace (creates default if absent). */
  getContext(workspaceId: string): WorkspaceContextState;

  /** Ensure a context entry exists for the workspace (idempotent, persists). */
  ensure(workspaceId: string): void;

  /** Set or update the summary text for a workspace. */
  setSummary(workspaceId: string, summary: string): void;

  /**
   * Toggle a messageId in pinnedMessageIds.
   * If present → remove; if absent → add.
   */
  togglePin(workspaceId: string, messageId: string): void;

  /**
   * Add or remove a messageId from includeMessageIds.
   * @param include true → add, false → remove
   */
  setIncludeMessage(workspaceId: string, messageId: string, include: boolean): void;

  /**
   * Reset a workspace's context to defaults:
   * clears summary, pinnedMessageIds, includeMessageIds, resets settings.
   */
  resetContext(workspaceId: string): void;

  /** Partial-update the settings for a workspace. */
  setSettings(workspaceId: string, patch: Partial<WorkspaceContextSettings>): void;

  /** Remove context state entirely (call on workspace delete). */
  clearWorkspace(workspaceId: string): void;
}

// ============================================================================
// STORE
// ============================================================================

export const useContextStore = create<ContextStoreState>((set, get) => {

  /** Persist current state to disk. */
  function persist(map: ContextMap): void {
    storageSet('context', map);
  }

  function getOrDefault(map: ContextMap, workspaceId: string): WorkspaceContextState {
    return map[workspaceId] ?? makeDefault(workspaceId);
  }

  return {
    contextByWorkspaceId: {},

    getContext: (workspaceId) => {
      return get().contextByWorkspaceId[workspaceId] ?? makeDefault(workspaceId);
    },

    ensure: (workspaceId) => {
      const current = get().contextByWorkspaceId;
      if (current[workspaceId]) return; // already exists
      const next: ContextMap = { ...current, [workspaceId]: makeDefault(workspaceId) };
      set({ contextByWorkspaceId: next });
      persist(next);
    },

    setSummary: (workspaceId, summary) => {
      const current = get().contextByWorkspaceId;
      const existing = getOrDefault(current, workspaceId);
      const next: ContextMap = {
        ...current,
        [workspaceId]: { ...existing, summary },
      };
      set({ contextByWorkspaceId: next });
      persist(next);
    },

    togglePin: (workspaceId, messageId) => {
      const current = get().contextByWorkspaceId;
      const existing = getOrDefault(current, workspaceId);
      const isPinned = existing.pinnedMessageIds.includes(messageId);
      const pinnedMessageIds = isPinned
        ? existing.pinnedMessageIds.filter((id) => id !== messageId)
        : [...existing.pinnedMessageIds, messageId];
      const next: ContextMap = {
        ...current,
        [workspaceId]: { ...existing, pinnedMessageIds },
      };
      set({ contextByWorkspaceId: next });
      persist(next);
    },

    setIncludeMessage: (workspaceId, messageId, include) => {
      const current = get().contextByWorkspaceId;
      const existing = getOrDefault(current, workspaceId);
      const alreadyIncluded = existing.includeMessageIds.includes(messageId);
      if (include && alreadyIncluded) return;
      if (!include && !alreadyIncluded) return;
      const includeMessageIds = include
        ? [...existing.includeMessageIds, messageId]
        : existing.includeMessageIds.filter((id) => id !== messageId);
      const next: ContextMap = {
        ...current,
        [workspaceId]: { ...existing, includeMessageIds },
      };
      set({ contextByWorkspaceId: next });
      persist(next);
    },

    resetContext: (workspaceId) => {
      const current = get().contextByWorkspaceId;
      const next: ContextMap = {
        ...current,
        [workspaceId]: makeDefault(workspaceId),
      };
      set({ contextByWorkspaceId: next });
      persist(next);
    },

    setSettings: (workspaceId, patch) => {
      const current = get().contextByWorkspaceId;
      const existing = getOrDefault(current, workspaceId);
      const next: ContextMap = {
        ...current,
        [workspaceId]: {
          ...existing,
          settings: { ...existing.settings, ...patch },
        },
      };
      set({ contextByWorkspaceId: next });
      persist(next);
    },

    clearWorkspace: (workspaceId) => {
      const current = get().contextByWorkspaceId;
      const next = { ...current };
      delete next[workspaceId];
      set({ contextByWorkspaceId: next });
      persist(next);
    },
  };
});

// ============================================================================
// ASYNC HYDRATION
// ============================================================================

(async () => {
  const fromDisk = await storageGet<ContextMap | null>('context', null);
  if (fromDisk != null) {
    useContextStore.setState({ contextByWorkspaceId: fromDisk });
  }
})();
