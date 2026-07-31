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
 * Write debounce (150ms per key):
 *   storageSet buffers writes per key. The last value within a 150ms window
 *   wins. Call flushAll() to force pending writes immediately (e.g. on unload).
 *
 * Corruption recovery:
 *   storageGet returns { corrupted?: string } in the Electron IPC response.
 *   The path of the renamed corrupt file is exposed via lastCorruptedStorageFile
 *   so store hydration can show a recovery note to the user.
 *
 * Never import electron or Node modules here.
 */

export type StorageKey = 'workspaces' | 'chat' | 'artifacts' | 'settings' | 'context';

const FALLBACK_PREFIX = 'workbench.diskFallback';
const DEBOUNCE_MS = 150;

// ============================================================================
// CORRUPTION SIGNAL
// ============================================================================

/**
 * Set to the path of the most recently detected corrupt file (as reported
 * by the Electron main process). Store hydration checks this after storageGet.
 * Use consumeCorruptedFile() to read and reset atomically.
 */
let _lastCorruptedStorageFile: string | null = null;

/**
 * Read and reset the corrupted-file sentinel.
 * Returns the path of the corrupt file (or null if none), and clears the
 * sentinel so subsequent callers don't see a stale value.
 */
export function consumeCorruptedFile(): string | null {
  const val = _lastCorruptedStorageFile;
  _lastCorruptedStorageFile = null;
  return val;
}

// ============================================================================
// WRITE DEBOUNCE STATE
// ============================================================================

interface PendingWrite {
  value: unknown;
  timer: ReturnType<typeof setTimeout>;
}

const _pending = new Map<StorageKey, PendingWrite>();

// ============================================================================
// localStorage fallback helpers
// ============================================================================

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

// ============================================================================
// INTERNAL: actual write (IPC or localStorage)
// ============================================================================

async function _doWrite<T>(key: StorageKey, value: T): Promise<void> {
  if (typeof window !== 'undefined' && window.workbenchStorage) {
    try {
      await window.workbenchStorage.set(key, value);
    } catch {
      // Disk write errors should not crash the UI
    }
    return;
  }
  fallbackSet(key, value);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Read persisted data for `key`.
 * Returns `fallback` if no data exists or an error occurs.
 * Populates lastCorruptedStorageFile if the Electron process detected corruption.
 */
export async function storageGet<T>(key: StorageKey, fallback: T): Promise<T> {
  if (typeof window !== 'undefined' && window.workbenchStorage) {
    try {
      const result = await window.workbenchStorage.get(key);
      // Capture corruption signal from main process
      if (result.ok && (result as { ok: true; value: unknown; corrupted?: string }).corrupted) {
        _lastCorruptedStorageFile =
          (result as { ok: true; value: unknown; corrupted: string }).corrupted;
      }
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
 * Persist data for `key` with a 150ms debounce.
 * Multiple rapid writes to the same key coalesce — last value wins.
 * Fire-and-forget safe — errors are swallowed.
 */
export function storageSet<T>(key: StorageKey, value: T): void {
  // Cancel any pending write for this key
  const existing = _pending.get(key);
  if (existing) clearTimeout(existing.timer);

  // Schedule a new write after the debounce window
  const timer = setTimeout(() => {
    _pending.delete(key);
    _doWrite(key, value).catch(() => { /* fail silently */ });
  }, DEBOUNCE_MS);

  _pending.set(key, { value, timer });
}

/**
 * Flush all pending debounced writes immediately (best effort).
 * Call on beforeunload or app quit to ensure the last write is not lost.
 */
export async function flushAll(): Promise<void> {
  const entries = [..._pending.entries()];
  _pending.clear();
  await Promise.all(
    entries.map(([key, { value, timer }]) => {
      clearTimeout(timer);
      return _doWrite(key, value).catch(() => { /* best effort */ });
    })
  );
}

/**
 * Delete persisted data for `key`.
 */
export async function storageDel(key: StorageKey): Promise<void> {
  // Cancel any pending write for this key before deleting
  const existing = _pending.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    _pending.delete(key);
  }

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
