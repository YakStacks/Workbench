/**
 * Artifact Store — per-workspace persistent outputs.
 *
 * Persisted to localStorage under workbench.artifacts.v1.
 * On workspace deletion, call clearWorkspace() to remove all artifacts.
 */

import { create } from 'zustand';
import type { Artifact } from '../types/artifacts';

const STORAGE_KEY = 'workbench.artifacts.v1';

// ============================================================================
// HELPERS
// ============================================================================

function loadFromStorage(): Record<string, Artifact[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Artifact[]>;
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<string, Artifact[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable — fail silently
  }
}

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
  artifactsByWorkspaceId: loadFromStorage(),

  getArtifacts: (workspaceId) => {
    return get().artifactsByWorkspaceId[workspaceId] ?? [];
  },

  addArtifact: (artifact) => {
    const current = get().artifactsByWorkspaceId;
    const existing = current[artifact.workspaceId] ?? [];
    // Deduplicate by id
    if (existing.some((a) => a.id === artifact.id)) return;
    const next = { ...current, [artifact.workspaceId]: [...existing, artifact] };
    saveToStorage(next);
    set({ artifactsByWorkspaceId: next });
  },

  removeArtifact: (workspaceId, artifactId) => {
    const current = get().artifactsByWorkspaceId;
    const existing = current[workspaceId] ?? [];
    const next = { ...current, [workspaceId]: existing.filter((a) => a.id !== artifactId) };
    saveToStorage(next);
    set({ artifactsByWorkspaceId: next });
  },

  clearWorkspace: (workspaceId) => {
    const current = get().artifactsByWorkspaceId;
    const next = { ...current };
    delete next[workspaceId];
    saveToStorage(next);
    set({ artifactsByWorkspaceId: next });
  },
}));
