/**
 * Workbench Shell — Renderer Entry Point
 *
 * Responsibilities:
 * 1. Register all apps with the AppRegistry
 * 2. Bootstrap a default Butler workspace on first clean launch
 * 3. Mount the ShellLayout with page components
 *
 * Nothing else belongs here.
 * No heavy business logic. No ongoing state management.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerApp } from '../appRegistry';
import { MaestroApp } from './apps/maestro';
import { ButlerApp } from './apps/butler';
import PipewrenchApp from '@workbench-apps/pipewrench';
import { ShellLayout } from './layout/ShellLayout';
import { HomePage } from './pages/HomePage';
import { createRuntime } from '../runtime/createRuntime';
import { RuntimeContext } from '../runtime/runtimeContext';
import { useWorkspaceStore } from './state/workspaceStore';
import { useShellStore } from './state/shellStore';

// ============================================================================
// REGISTER APPS
// ============================================================================

registerApp(MaestroApp);
registerApp(ButlerApp);
registerApp(PipewrenchApp);

// ============================================================================
// RUNTIME SINGLETON
// ============================================================================

// Created once at app launch. Never re-created. Never stored in Zustand.
// All components access it via useRuntime() through RuntimeContext.
const runtime = createRuntime();

// ============================================================================
// BOOTSTRAP — auto-create Butler workspace on first clean launch
// ============================================================================

const BOOTSTRAP_FLAG = 'workbench.hasBootstrapped';

async function maybeBootstrap(): Promise<void> {
  // Only run once per installation. Never re-create if user cleared all workspaces.
  if (localStorage.getItem(BOOTSTRAP_FLAG)) return;

  const workspaces = useWorkspaceStore.getState().workspaces;
  if (workspaces.length > 0) {
    // Existing data — mark bootstrapped and leave state alone
    localStorage.setItem(BOOTSTRAP_FLAG, 'true');
    return;
  }

  // Fresh install: create default Butler workspace
  localStorage.setItem(BOOTSTRAP_FLAG, 'true');

  const ws = await ButlerApp.createWorkspace();
  useWorkspaceStore.getState().upsertWorkspace({
    id: ws.id,
    appId: ws.appId,
    title: ws.title,
    state: ws.state,
    lastOpened: new Date().toISOString(),
  });
  useShellStore.getState().openTab(ws);
}

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

// Run bootstrap before first paint (stores are synchronous; createWorkspace is async).
// We render immediately and let bootstrap update store state (Zustand subscribers re-render).
maybeBootstrap().catch((err) => {
  console.warn('[Shell] Bootstrap failed:', err);
});

createRoot(container).render(
  <React.StrictMode>
    <RuntimeContext.Provider value={runtime}>
      <ShellLayout pages={pages} />
    </RuntimeContext.Provider>
  </React.StrictMode>
);
