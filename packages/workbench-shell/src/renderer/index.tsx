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
import { BenchPanel } from './components/BenchPanel';
import { createRuntime } from '../runtime/createRuntime';
import { RuntimeContext } from '../runtime/runtimeContext';
import { setRuntime } from './runtime/runtimeSingleton';
import { useWorkspaceStore, waitForHydration } from './state/workspaceStore';
import { useShellStore } from './state/shellStore';
import { useSettingsStore, waitForSettings } from './state/settingsStore';
import { registerBuiltInTools } from './tools/toolStore';
import { flushAll } from './storage/storageClient';
import { useChatStore } from './state/chatStore';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// BEFORE-UNLOAD — flush any pending debounced writes before the window closes
// ============================================================================

window.addEventListener('beforeunload', () => {
  flushAll().catch(() => { /* best effort */ });
});

// ============================================================================
// CRASH CAPTURE — forward unhandled errors to crash.log
// ============================================================================

const CRASH_RING_KEY = 'workbench.crashlog.v1';
const CRASH_RING_MAX = 50;

function appendLocalCrashLog(entry: { ts: number; process: string; message: string; stack?: string }): void {
  try {
    const raw = localStorage.getItem(CRASH_RING_KEY);
    const ring: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : [];
    ring.push(entry);
    if (ring.length > CRASH_RING_MAX) ring.splice(0, ring.length - CRASH_RING_MAX);
    localStorage.setItem(CRASH_RING_KEY, JSON.stringify(ring));
  } catch { /* fail silently */ }
}

function getLocalCrashLastTs(): number | null {
  try {
    const raw = localStorage.getItem(CRASH_RING_KEY);
    if (!raw) return null;
    const ring = JSON.parse(raw) as Array<{ ts?: number }>;
    return ring.length ? (ring[ring.length - 1].ts ?? null) : null;
  } catch { return null; }
}

window.addEventListener('error', (e) => {
  const entry = {
    ts: Date.now(),
    process: 'renderer',
    message: e.message ?? 'Unknown error',
    stack: (e.error as Error | undefined)?.stack,
  };
  if (window.workbenchCrash) {
    window.workbenchCrash.append(entry).catch(() => { /* best effort */ });
  } else {
    appendLocalCrashLog(entry);
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  const err = reason instanceof Error ? reason : new Error(String(reason));
  const entry = {
    ts: Date.now(),
    process: 'renderer',
    message: err.message,
    stack: err.stack,
  };
  if (window.workbenchCrash) {
    window.workbenchCrash.append(entry).catch(() => { /* best effort */ });
  } else {
    appendLocalCrashLog(entry);
  }
});

// Check for a crash in the previous session; if found, show a recovery note
// in the Butler workspace after hydration settles (1500ms delay).
async function checkPreviousCrash(): Promise<void> {
  const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;
  let lastTs: number | null = null;
  try {
    if (window.workbenchCrash) {
      lastTs = await window.workbenchCrash.lastTs();
    } else {
      lastTs = getLocalCrashLastTs();
    }
  } catch { return; }

  if (!lastTs || Date.now() - lastTs > TWENTY_FOUR_H) return;

  setTimeout(() => {
    const { activeTabId } = useShellStore.getState();
    const messages = useChatStore.getState().messagesByWorkspaceId;
    const workspaceId = activeTabId ?? Object.keys(messages)[0] ?? null;
    if (!workspaceId) return;
    useChatStore.getState().appendMessage({
      id: uuidv4(),
      workspaceId,
      role: 'system',
      content: "⚠️ Workbench recovered from a crash. Open Command Palette → 'Copy Diagnostics' to report.",
      createdAt: Date.now(),
    });
  }, 1500);
}

checkPreviousCrash().catch(() => { /* best effort */ });

// ============================================================================
// REGISTER APPS
// ============================================================================

registerApp(MaestroApp);
registerApp(ButlerApp);
registerApp(PipewrenchApp);

// ============================================================================
// REGISTER BUILT-IN TOOLS (COLD state — no auto-start)
// ============================================================================
// This populates the ToolRegistry with manifests only.
// No tool modules are loaded, no processes started.
// Tools become WARM only when explicitly mounted by user/agent action.

registerBuiltInTools();

// ============================================================================
// RUNTIME SINGLETON
// ============================================================================

// Created once at app launch. Never re-created. Never stored in Zustand.
// All components access it via useRuntime() through RuntimeContext.
// Non-React code (e.g. applyTemplate) accesses it via runtimeSingleton.
const runtime = createRuntime();
setRuntime(runtime);

// ============================================================================
// BOOTSTRAP — auto-create Butler workspace on first clean launch
// ============================================================================

async function maybeBootstrap(): Promise<void> {
  // Wait for disk hydration before checking state
  await Promise.all([waitForHydration(), waitForSettings()]);

  const settings = useSettingsStore.getState();

  // Only run once per installation.
  if (settings.hasBootstrapped) return;

  const workspaces = useWorkspaceStore.getState().workspaces;
  if (workspaces.length > 0) {
    // Existing data — mark bootstrapped and leave state alone
    settings.setHasBootstrapped(true);
    return;
  }

  // Fresh install: create default Butler workspace
  settings.setHasBootstrapped(true);

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
  bench: <BenchPanel />,
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
