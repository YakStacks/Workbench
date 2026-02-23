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
// READ
// ============================================================================

/**
 * Read and parse a JSON file.
 * Returns `defaultValue` if the file is absent, unreadable, or unparseable.
 */
export async function readJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
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
export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  const json = JSON.stringify(data, null, 2);

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
