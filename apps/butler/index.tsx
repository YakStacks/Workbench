/**
 * @workbench-apps/butler
 *
 * Re-exports the canonical ButlerApp component so that the /apps/ root
 * acts as the authoritative entry-point for dynamic loading.
 *
 * The implementation lives in the Shell package during the v0.x era; once
 * apps are loaded from disk at runtime this file will be the full module.
 */
export { ButlerApp as default } from '../../packages/workbench-shell/src/renderer/apps/butler';
