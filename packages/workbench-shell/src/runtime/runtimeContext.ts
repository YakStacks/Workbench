/**
 * RuntimeContext — React context that surfaces WorkbenchRuntime to apps.
 *
 * Apps call useRuntime() to get access to the runtime API.
 * They never import createRuntime() or @workbench/core directly.
 *
 * Singleton: createRuntime() is called once in renderer/index.tsx,
 * the result is placed in this provider and never recreated.
 */

import React from 'react';
import type { WorkbenchRuntime } from './types';

export const RuntimeContext = React.createContext<WorkbenchRuntime | null>(null);

/**
 * useRuntime — access the runtime inside any app or layout component.
 *
 * Throws if called outside a RuntimeContext.Provider, which is a programming
 * error and should be caught early during development.
 */
export function useRuntime(): WorkbenchRuntime {
  const ctx = React.useContext(RuntimeContext);
  if (!ctx) {
    throw new Error(
      '[Shell] useRuntime() called outside of <RuntimeContext.Provider>. ' +
      'Ensure your component tree is wrapped in ShellLayout or a RuntimeContext.Provider.'
    );
  }
  return ctx;
}
