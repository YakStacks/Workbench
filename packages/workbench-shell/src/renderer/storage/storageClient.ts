/**
 * Renderer-side storage adapter.
 *
 * Provides a uniform async API for persisting Shell data.
 *
 * When running inside Electron:
 *   Uses window.workbenchStorage (exposed via contextBridge) → IPC → disk.
 *
 * When running in Vite renderer-only dev mode (no Electron):
 *   Falls back to localStorage under keys: workbench.diskFallback.<key>.v1
 *
 * Never import electron or Node modules here.
 */

export type StorageKey = 'workspaces' | 'chat' | 'artifacts' | 'settings';

const FALLBACK_PREFIX = 'workbench.diskFallback';

// ── localStorage fallback helpers ────────────────────────────────────────────

function fallbackGet<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${FALLBACK_PREFIX}.${key}.v1`);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function fallbackSet(key: StorageKey, value: unknown): void {
  try {
    localStorage.setItem(`${FALLBACK_PREFIX}.${key}.v1`, JSON.stringify(value));
  } catch {
    // Storage unavailable — fail silently
  }
}

function fallbackDel(key: StorageKey): void {
  try {
    localStorage.removeItem(`${FALLBACK_PREFIX}.${key}.v1`);
  } catch {
    // fail silently
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read persisted data for `key`.
 * Returns `fallback` if no data exists or an error occurs.
 */
export async function storageGet<T>(key: StorageKey, fallback: T): Promise<T> {
  if (typeof window !== 'undefined' && window.workbenchStorage) {
    try {
      const result = await window.workbenchStorage.get(key);
      if (result.ok && result.value != null) {
        return result.value as T;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }
  return fallbackGet(key, fallback);
}

/**
 * Persist data for `key`.
 * Fire-and-forget safe — errors are swallowed.
 */
export async function storageSet<T>(key: StorageKey, value: T): Promise<void> {
  if (typeof window !== 'undefined' && window.workbenchStorage) {
    try {
      await window.workbenchStorage.set(key, value);
    } catch {
      // Fail silently — disk write errors should not crash the UI
    }
    return;
  }
  fallbackSet(key, value);
}

/**
 * Delete persisted data for `key`.
 */
export async function storageDel(key: StorageKey): Promise<void> {
  if (typeof window !== 'undefined' && window.workbenchStorage) {
    try {
      await window.workbenchStorage.del(key);
    } catch {
      // Fail silently
    }
    return;
  }
  fallbackDel(key);
}
