/**
 * Workbench Shell — Main-process disk storage helpers.
 *
 * Used by IPC handlers in main.ts to read/write JSON files under
 * ~/.workbench/ with best-effort atomic writes.
 *
 * Node-only module. Never imported by renderer code.
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// DIRECTORY
// ============================================================================

/** Ensure a directory exists (mkdir -p, ignores EEXIST). */
export async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

// ============================================================================
// CORRUPTION SENTINEL
// ============================================================================

/**
 * Set to the path of the most recently renamed corrupt file, or null.
 * The IPC get handler reads and resets this so the renderer can surface a
 * recovery note to the user. Resets to null after each read.
 */
export let lastCorruptedFile: string | null = null;

export function resetLastCorruptedFile(): string | null {
  const val = lastCorruptedFile;
  lastCorruptedFile = null;
  return val;
}

// ============================================================================
// READ
// ============================================================================

/**
 * Read and parse a JSON file.
 *
 * Handles two disk formats transparently:
 *   - Legacy (raw): the stored value itself (e.g. a plain object or array)
 *   - Versioned wrapper: { version: number, data: <payload> }
 *     Unwraps and returns `data`. Forward-compatible with future migrations.
 *
 * If the file is absent (ENOENT) → returns `defaultValue` silently.
 * If the file exists but is corrupt (parse error, etc.) → renames it to
 *   <filePath>.corrupt.<timestamp>.json (best effort), sets lastCorruptedFile,
 *   and returns `defaultValue`. Never throws.
 */
export async function readJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Forward-compat: unwrap versioned storage format { version, data }
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as Record<string, unknown>).version === 'number' &&
      'data' in (parsed as Record<string, unknown>)
    ) {
      return (parsed as { version: number; data: T }).data;
    }

    return parsed as T;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      // File exists but is corrupt or unreadable — back it up
      const corruptPath = `${filePath}.corrupt.${Date.now()}.json`;
      try {
        await fs.promises.rename(filePath, corruptPath);
        lastCorruptedFile = corruptPath;
      } catch {
        // Best effort — ignore rename failure (e.g. permission issue)
        lastCorruptedFile = filePath; // still signal that corruption occurred
      }
    }
    return defaultValue;
  }
}

// ============================================================================
// WRITE (ATOMIC)
// ============================================================================

/**
 * Write data as JSON to filePath using an atomic tmp-then-rename pattern.
 *
 * Steps:
 *   1. Write JSON to <filePath>.tmp in the same directory.
 *   2. fsync the tmp file (best effort — skipped if unsupported).
 *   3. Rename tmp over target (atomic on POSIX; near-atomic on Windows).
 *   4. Clean up tmp on error.
 */
/** Version stamp applied to all files written by this process. */
const STORAGE_VERSION = 1;

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  // Wrap payload in versioned envelope for forward-compatible migrations.
  // readJson() transparently unwraps this format — existing files are safe.
  const wrapped = { version: STORAGE_VERSION, data };
  const json = JSON.stringify(wrapped, null, 2);

  let fh: fs.promises.FileHandle | null = null;
  try {
    fh = await fs.promises.open(tmpPath, 'w');
    await fh.writeFile(json, 'utf-8');
    try {
      await fh.sync();
    } catch {
      // fsync may not be available on all platforms — proceed anyway
    }
    await fh.close();
    fh = null;
    await fs.promises.rename(tmpPath, filePath);
  } catch (err) {
    if (fh) {
      try { await fh.close(); } catch { /* ignore */ }
    }
    // Clean up tmp file on failure
    try { await fs.promises.unlink(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}
