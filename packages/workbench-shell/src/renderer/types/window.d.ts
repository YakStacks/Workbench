/**
 * Global Window augmentation for Workbench Shell IPC APIs.
 *
 * workbenchStorage and workbenchCrash are exposed by the Electron preload
 * script via contextBridge. Both are absent in Vite renderer-only dev mode
 * — always check for presence before calling.
 */

type WorkbenchStorageKey = 'workspaces' | 'chat' | 'artifacts' | 'settings' | 'context';

interface WorkbenchStorageAPI {
  get(
    key: WorkbenchStorageKey
  ): Promise<{ ok: true; value: unknown; corrupted?: string } | { ok: false; error: string }>;
  set(
    key: WorkbenchStorageKey,
    value: unknown
  ): Promise<{ ok: true } | { ok: false; error: string }>;
  del(
    key: WorkbenchStorageKey
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}

/** Crash log API — forwards renderer errors to main process (Electron only). */
interface WorkbenchCrashAPI {
  append(entry: {
    process: string;
    message: string;
    stack?: string;
    ts: number;
  }): Promise<{ ok: boolean }>;
  lastTs(): Promise<number | null>;
}

declare interface Window {
  workbenchStorage?: WorkbenchStorageAPI;
  workbenchCrash?: WorkbenchCrashAPI;
}
