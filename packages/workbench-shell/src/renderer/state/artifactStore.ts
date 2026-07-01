/**
 * Artifact Store — per-workspace persistent outputs.
 *
 * Phase C: persisted to disk via storageGet/storageSet('artifacts').
 * Falls back to localStorage in Vite dev mode.
 *
 * Migration: on first load, if disk is empty, promotes data from the
 * old localStorage key ('workbench.artifacts.v1') to disk.
 *
 * On workspace deletion, call clearWorkspace() to remove all artifacts.
 */

import { create } from 'zustand';
import type { Artifact } from '../types/artifacts';
import { storageGet, storageSet } from '../storage/storageClient';

// Old localStorage key (migration only)
const OLD_STORAGE_KEY = 'workbench.artifacts.v1';

// ============================================================================
// STORE SHAPE
// ============================================================================

interface ArtifactStoreState {
  artifactsByWorkspaceId: Record<string, Artifact[]>;

  /** Return all artifacts for a workspace (empty array if none). */
  getArtifacts(workspaceId: string): Artifact[];

  /** Append a new artifact. */
  addArtifact(artifact: Artifact): void;

  /** Remove a single artifact by id. */
  removeArtifact(workspaceId: string, artifactId: string): void;

  /** Remove all artifacts for a workspace (call on workspace delete). */
  clearWorkspace(workspaceId: string): void;
}

// ============================================================================
// STORE
// ============================================================================

export const useArtifactStore = create<ArtifactStoreState>((set, get) => ({
  artifactsByWorkspaceId: {},

  getArtifacts: (workspaceId) => {
    return get().artifactsByWorkspaceId[workspaceId] ?? [];
  },

  addArtifact: (artifact) => {
    const current = get().artifactsByWorkspaceId;
    const existing = current[artifact.workspaceId] ?? [];
    // Deduplicate by id
    if (existing.some((a) => a.id === artifact.id)) return;
    const next = { ...current, [artifact.workspaceId]: [...existing, artifact] };
    set({ artifactsByWorkspaceId: next });
    storageSet('artifacts', next);
  },

  removeArtifact: (workspaceId, artifactId) => {
    const current = get().artifactsByWorkspaceId;
    const existing = current[workspaceId] ?? [];
    const next = { ...current, [workspaceId]: existing.filter((a) => a.id !== artifactId) };
    set({ artifactsByWorkspaceId: next });
    storageSet('artifacts', next);
  },

  clearWorkspace: (workspaceId) => {
    const current = get().artifactsByWorkspaceId;
    const next = { ...current };
    delete next[workspaceId];
    set({ artifactsByWorkspaceId: next });
    storageSet('artifacts', next);
  },
}));

// ============================================================================
// ASYNC HYDRATION (runs once at module load)
// ============================================================================

(async () => {
  const fromDisk = await storageGet<Record<string, Artifact[]> | null>('artifacts', null);

  if (fromDisk != null) {
    useArtifactStore.setState({ artifactsByWorkspaceId: fromDisk });
  } else {
    // No disk data — migrate from old localStorage key
    try {
      const raw = localStorage.getItem(OLD_STORAGE_KEY);
      if (raw) {
        const migrated = JSON.parse(raw) as Record<string, Artifact[]>;
        useArtifactStore.setState({ artifactsByWorkspaceId: migrated });
        await storageSet('artifacts', migrated);
      }
    } catch {
      // localStorage unavailable or unparseable — start fresh
    }
  }
})();
