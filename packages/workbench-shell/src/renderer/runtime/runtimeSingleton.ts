/**
 * Runtime Singleton — allows non-React code (e.g. applyTemplate) to access
 * the WorkbenchRuntime without using a hook.
 *
 * setRuntime() is called once in renderer/index.tsx after createRuntime().
 * getRuntime() returns the runtime or null (Vite-only dev fallback).
 */

import type { WorkbenchRuntime } from '../../runtime/types';

let _runtime: WorkbenchRuntime | null = null;

/** Call once during renderer bootstrap. */
export function setRuntime(rt: WorkbenchRuntime): void {
  _runtime = rt;
}

/** Returns the runtime, or null if not yet set. */
export function getRuntime(): WorkbenchRuntime | null {
  return _runtime;
}
