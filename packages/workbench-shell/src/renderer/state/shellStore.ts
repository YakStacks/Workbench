/**
 * Workbench Shell — State Store (Zustand)
 *
 * Single store for all Shell-level state:
 * - Open tabs (workspaces)
 * - Active tab
 * - Sidebar navigation
 * - Log drawer visibility
 *
 * Rules:
 * - No app-specific state here
 * - No Core internals here
 * - Workspace content state lives inside the workspace itself
 */

import { create } from 'zustand';
import type { WorkbenchWorkspace } from '../../types';

// ============================================================================
// NAVIGATION
// ============================================================================

export type SidebarSection = 'home' | 'workspaces' | 'apps' | 'doctor' | 'bench' | 'settings';

// ============================================================================
// TAB
// ============================================================================

export interface OpenTab {
  /** Workspace instance that owns this tab. */
  workspace: WorkbenchWorkspace;
  /** ISO string of when the tab was opened. */
  openedAt: string;
}

// ============================================================================
// LOG EVENT
// ============================================================================

export interface LogEntry {
  type: string;
  timestamp: number;
  label: string;
  /** Optional: workspace that generated this event (for Runs filtered view). */
  workspaceId?: string;
}

// ============================================================================
// STORE SHAPE
// ============================================================================

type InnerPane = 'chat' | 'artifacts' | 'runs';

interface ShellState {
  // ── Sidebar
  activeSection: SidebarSection;
  setActiveSection(section: SidebarSection): void;

  // ── Tabs
  tabs: OpenTab[];
  activeTabId: string | null;

  openTab(workspace: WorkbenchWorkspace): void;
  closeTab(workspaceId: string): void;
  activateTab(workspaceId: string): void;

  // ── Default pane per workspace (set by templates)
  workspacePaneById: Record<string, InnerPane>;
  setWorkspacePane(workspaceId: string, pane: InnerPane): void;
  getWorkspacePane(workspaceId: string): InnerPane | undefined;

  // ── Log drawer
  logDrawerOpen: boolean;
  toggleLogDrawer(): void;
  setLogDrawerOpen(open: boolean): void;

  // ── Log events (populated by LogDrawer via EventBus subscription)
  logEvents: LogEntry[];
  addLogEvent(entry: LogEntry): void;
  clearLogEvents(): void;
}

// ============================================================================
// STORE
// ============================================================================

export const useShellStore = create<ShellState>((set, get) => ({
  // ── Sidebar
  activeSection: 'home',
  setActiveSection: (section) => set({ activeSection: section }),

  // ── Tabs
  tabs: [],
  activeTabId: null,

  openTab: (workspace) => {
    const existing = get().tabs.find((t) => t.workspace.id === workspace.id);
    if (existing) {
      // Tab already open — just activate it
      set({ activeTabId: workspace.id, activeSection: 'workspaces' });
      return;
    }
    const tab: OpenTab = { workspace, openedAt: new Date().toISOString() };
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: workspace.id,
      activeSection: 'workspaces',
    }));
    workspace.onMount?.();
  },

  closeTab: (workspaceId) => {
    const { tabs, activeTabId } = get();
    const index = tabs.findIndex((t) => t.workspace.id === workspaceId);
    if (index === -1) return;

    // Dispose the workspace
    tabs[index].workspace.onDispose?.();

    const next = tabs.filter((t) => t.workspace.id !== workspaceId);

    // Determine new active tab
    let nextActiveId: string | null = null;
    if (activeTabId === workspaceId) {
      // Activate adjacent tab: prefer right, fall back to left
      const adjacent = next[index] ?? next[index - 1] ?? null;
      nextActiveId = adjacent?.workspace.id ?? null;
    } else {
      nextActiveId = activeTabId;
    }

    set({ tabs: next, activeTabId: nextActiveId });
  },

  activateTab: (workspaceId) => {
    const tab = get().tabs.find((t) => t.workspace.id === workspaceId);
    if (!tab) return;
    set({ activeTabId: workspaceId, activeSection: 'workspaces' });
    tab.workspace.onMount?.();
  },

  // ── Default pane per workspace
  workspacePaneById: {},
  setWorkspacePane: (workspaceId, pane) => {
    set((s) => ({
      workspacePaneById: { ...s.workspacePaneById, [workspaceId]: pane },
    }));
  },
  getWorkspacePane: (workspaceId) => {
    return get().workspacePaneById[workspaceId];
  },

  // ── Log drawer
  logDrawerOpen: false,
  toggleLogDrawer: () => set((s) => ({ logDrawerOpen: !s.logDrawerOpen })),
  setLogDrawerOpen: (open) => set({ logDrawerOpen: open }),

  // ── Log events
  logEvents: [],
  addLogEvent: (entry) =>
    set((s) => ({ logEvents: [...s.logEvents, entry].slice(-200) })), // cap at 200
  clearLogEvents: () => set({ logEvents: [] }),
}));
