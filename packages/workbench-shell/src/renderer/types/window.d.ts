/**
 * Global Window augmentation for Workbench Shell IPC APIs.
 *
 * workbenchStorage is exposed by the Electron preload script via contextBridge.
 * It is absent in Vite renderer-only dev mode — always check for presence.
 */

type WorkbenchStorageKey = 'workspaces' | 'chat' | 'artifacts' | 'settings' | 'context';

interface WorkbenchStorageAPI {
  get(
    key: WorkbenchStorageKey
  ): Promise<{ ok: true; value: unknown } | { ok: false; error: string }>;
  set(
    key: WorkbenchStorageKey,
    value: unknown
  ): Promise<{ ok: true } | { ok: false; error: string }>;
  del(
    key: WorkbenchStorageKey
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}

declare interface Window {
  workbenchStorage?: WorkbenchStorageAPI;
}
