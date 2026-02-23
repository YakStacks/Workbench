/**
 * Workbench Shell — App Registry
 *
 * The single source of truth for installed apps.
 *
 * Rules:
 * - Apps self-register at startup via registerApp()
 * - Shell never hardcodes app IDs into layout
 * - Registry is synchronous; async loading handled by the caller
 * - Duplicate IDs throw at registration time (fail fast)
 */

import type { WorkbenchApp } from './types';

// ============================================================================
// REGISTRY STATE
// ============================================================================

const _registry = new Map<string, WorkbenchApp>();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Register an app with the Shell.
 * Throws if an app with the same ID is already registered.
 * Call this at module load time inside each app's index.ts.
 */
export function registerApp(app: WorkbenchApp): void {
  if (_registry.has(app.id)) {
    throw new Error(
      `[AppRegistry] Duplicate app registration: "${app.id}". ` +
      `App IDs must be unique and stable.`
    );
  }
  _registry.set(app.id, app);
}

/**
 * Retrieve a registered app by ID.
 * Returns undefined if not found — callers must handle missing gracefully.
 */
export function getApp(id: string): WorkbenchApp | undefined {
  return _registry.get(id);
}

/**
 * Returns all registered apps in registration order.
 */
export function getAllApps(): WorkbenchApp[] {
  return Array.from(_registry.values());
}

/**
 * Remove an app at runtime (for future dynamic uninstall support).
 * Returns true if the app was registered, false otherwise.
 */
export function unregisterApp(id: string): boolean {
  return _registry.delete(id);
}

/**
 * Returns the count of registered apps.
 * Useful for diagnostics.
 */
export function getAppCount(): number {
  return _registry.size;
}
