/**
 * Workbench Shell — Renderer Entry Point
 *
 * Responsibilities:
 * 1. Register all apps with the AppRegistry
 * 2. Mount the ShellLayout with page components
 *
 * Nothing else belongs here.
 * No business logic. No state initialization.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerApp } from '../appRegistry';
import { MaestroApp } from './apps/maestro';
import { ButlerApp } from './apps/butler';
import { ShellLayout } from './layout/ShellLayout';
import { HomePage } from './pages/HomePage';
import { createRuntime } from '../runtime/createRuntime';
import { RuntimeContext } from '../runtime/runtimeContext';

// ============================================================================
// REGISTER APPS
// ============================================================================

registerApp(MaestroApp);
registerApp(ButlerApp);

// ============================================================================
// RUNTIME SINGLETON
// ============================================================================

// Created once at app launch. Never re-created. Never stored in Zustand.
// All components access it via useRuntime() through RuntimeContext.
const runtime = createRuntime();

// ============================================================================
// PAGE MAP
// ============================================================================

const pages = {
  home: <HomePage />,
};

// ============================================================================
// MOUNT
// ============================================================================

const container = document.getElementById('root');
if (!container) {
  throw new Error('[Shell] Mount failed: #root element not found.');
}

createRoot(container).render(
  <React.StrictMode>
    <RuntimeContext.Provider value={runtime}>
      <ShellLayout pages={pages} />
    </RuntimeContext.Provider>
  </React.StrictMode>
);
