/**
 * @workbench-apps/maestro
 *
 * Re-exports the canonical MaestroApp component so that the /apps/ root
 * acts as the authoritative entry-point for dynamic loading.
 *
 * The implementation lives in the Shell package during the v0.x era; once
 * apps are loaded from disk at runtime this file will be the full module.
 */
export { MaestroApp as default } from '../../packages/workbench-shell/src/renderer/apps/maestro';
