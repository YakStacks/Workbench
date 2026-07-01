/**
 * appLoader — Static and (future) dynamic app loading.
 *
 * Architecture intent
 * ───────────────────
 * v0.x: Apps ship inside the renderer bundle. loadAppsStatic() imports them
 *       via compile-time aliases and returns a flat list of WorkbenchApp objects.
 *       This is safe for bundling because the imports are resolved by Vite at
 *       build time.
 *
 * v1.x: Apps will live on disk as separate packages (plugins/<id>/). The main
 *       process will enumerate them, validate manifests, and pass the list to
 *       the renderer over contextBridge. loadAppsDynamic() scaffolds that
 *       contract — it deliberately throws until IPC is wired up.
 *
 * Consumers should call loadAppsStatic() in the renderer bootstrap
 * (renderer/index.tsx) and register each result via appRegistry.registerApp().
 *
 * NOTE: Do NOT add a direct import of Core here. Go through the WorkbenchRuntime
 *       context instead.
 */

import type { WorkbenchApp } from './types';

// Compile-time imports — resolved by Vite at build time via path aliases.
// When apps move to disk, remove these imports and wire up loadAppsDynamic().
import MaestroApp from '@workbench-apps/maestro';
import ButlerApp from '@workbench-apps/butler';
import PipewrenchApp from '@workbench-apps/pipewrench';

// ============================================================================
// STATIC LOADER  (v0.x)
// ============================================================================

/**
 * Returns all apps bundled into the renderer. Order determines the default
 * display order in the Shell home screen grid.
 */
export function loadAppsStatic(): WorkbenchApp[] {
  return [MaestroApp, ButlerApp, PipewrenchApp];
}

// ============================================================================
// DYNAMIC LOADER SCAFFOLD  (v1.x — not yet implemented)
// ============================================================================

/**
 * IPC contract that the main process will fulfil when disk-based app loading
 * is implemented. The renderer calls this; the main process responds with a
 * serialised manifest list; the renderer deserialises, validates, and resolves
 * the actual React components via a dynamic import.
 *
 * @throws {Error} until IPC bridge is wired (see main.ts: handle('apps:list'))
 */
export async function loadAppsDynamic(): Promise<WorkbenchApp[]> {
  throw new Error(
    '[appLoader] loadAppsDynamic() is not implemented yet. ' +
    'Wire up contextBridge.exposeInMainWorld("apps", { list }) ' +
    'in preload.ts and handle("apps:list") in main.ts first.',
  );
}
