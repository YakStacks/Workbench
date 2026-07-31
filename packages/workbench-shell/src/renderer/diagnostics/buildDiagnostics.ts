/**
 * buildDiagnostics — assembles a safe, shareable diagnostics snapshot.
 *
 * Rules:
 *   - NO secrets: API keys are reported only as booleans (configured / not)
 *   - NO file paths beyond a boolean presence flag
 *   - NO chat message content
 *   - NO environment variables
 *
 * Used by the "Copy Diagnostics" command palette action.
 * Call outside React (uses .getState(), not hooks).
 */

import { useSettingsStore } from '../state/settingsStore';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useChatStore } from '../state/chatStore';
import { useArtifactStore } from '../state/artifactStore';
import { useShellStore } from '../state/shellStore';

// ============================================================================
// VERSION
// ============================================================================

/** Canonical version string for this release candidate. */
export const APP_VERSION = '0.1.0-rc.1';

// ============================================================================
// SNAPSHOT TYPE
// ============================================================================

export interface DiagnosticsSnapshot {
  appVersion: string;
  platform: string;
  userAgent: string;
  timezone: string;
  /** 'electron' when running inside Electron; 'vite-fallback' in browser dev mode */
  persistenceMode: 'electron' | 'vite-fallback';

  // ── LLM settings (no keys) ─────────────────────────────────────────────
  provider: string;
  openaiModel: string;
  anthropicModel: string;
  openaiKeyConfigured: boolean;
  anthropicKeyConfigured: boolean;
  streamEnabled: boolean;

  // ── Data counts ────────────────────────────────────────────────────────
  workspacesCount: number;
  totalMessagesCount: number;
  artifactsCount: number;
  logEventsCount: number;

  // ── Environment ────────────────────────────────────────────────────────
  /** true when window.workbenchStorage is present (Electron IPC bridge) */
  workbenchDirPresent: boolean;
}

// ============================================================================
// BUILDER
// ============================================================================

/**
 * Build a diagnostics snapshot from current store state.
 * Pure function — no side effects. Safe to call at any time.
 */
export function buildDiagnostics(): DiagnosticsSnapshot {
  const settings = useSettingsStore.getState();
  const workspaces = useWorkspaceStore.getState().workspaces;
  const messages = useChatStore.getState().messagesByWorkspaceId;
  const artifacts = useArtifactStore.getState().artifactsByWorkspaceId;
  const logEvents = useShellStore.getState().logEvents;

  const totalMessagesCount = Object.values(messages).reduce(
    (acc, arr) => acc + arr.length,
    0,
  );
  const artifactsCount = Object.values(artifacts).reduce(
    (acc, arr) => acc + arr.length,
    0,
  );

  return {
    appVersion: APP_VERSION,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    persistenceMode:
      typeof window !== 'undefined' && 'workbenchStorage' in window
        ? 'electron'
        : 'vite-fallback',

    // LLM — no keys
    provider: settings.llmProvider,
    openaiModel: settings.openaiModel,
    anthropicModel: settings.anthropicModel,
    openaiKeyConfigured: Boolean(settings.openaiApiKey),
    anthropicKeyConfigured: Boolean(settings.anthropicApiKey),
    streamEnabled: settings.stream,

    // Counts
    workspacesCount: workspaces.length,
    totalMessagesCount,
    artifactsCount,
    logEventsCount: logEvents.length,

    // Environment
    workbenchDirPresent:
      typeof window !== 'undefined' && 'workbenchStorage' in window,
  };
}
