/**
 * ShellLayout — root layout composition.
 *
 * Owns the overall viewport split:
 *   [Sidebar] | [Column: [TabBar] [MainPanel] [LogDrawer]]
 *
 * Does NOT contain any page/app logic.
 * Receives page components via props (dependency injection).
 * Reads Shell state from Zustand store.
 */

import React from 'react';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { MainPanel } from './MainPanel';
import { LogDrawer } from './LogDrawer';
import { RuntimeBridge } from './RuntimeBridge';
import { SupervisorBridge } from './SupervisorBridge';
import { HotkeyBridge } from './HotkeyBridge';
import { CommandPalette } from '../components/CommandPalette';
import { useShellStore } from '../state/shellStore';
import type { SidebarSection } from '../state/shellStore';

// ============================================================================
// TYPES
// ============================================================================

interface ShellLayoutProps {
  /** Page components, keyed by sidebar section */
  pages: Partial<Record<SidebarSection, React.ReactNode>>;
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: '#0d0d0d',
    color: '#e0e0e0',
  },
  mainColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ShellLayout({ pages }: ShellLayoutProps): React.ReactElement {
  const {
    activeSection,
    setActiveSection,
    tabs,
    activeTabId,
    closeTab,
    activateTab,
    logDrawerOpen,
    toggleLogDrawer,
  } = useShellStore();

  const activeWorkspace = tabs.find((t) => t.workspace.id === activeTabId)?.workspace ?? null;

  return (
    <div style={styles.root}>
      {/* Single runtime subscription — feeds LogDrawer + ChatTimeline */}
      <RuntimeBridge />
      {/* Pappy supervisor — reacts to failures/warnings */}
      <SupervisorBridge />
      {/* Global Ctrl+K hotkey listener */}
      <HotkeyBridge />

      {/* Left sidebar */}
      <Sidebar active={activeSection} onSelect={setActiveSection} />

      {/* Right: tabs + content + log */}
      <div style={styles.mainColumn}>
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onActivate={activateTab}
          onClose={closeTab}
        />

        <MainPanel
          activeSection={activeSection}
          activeWorkspace={activeWorkspace}
          pages={pages}
        />

        {/* LogDrawer reads from store only — no direct runtime subscription */}
        <LogDrawer
          open={logDrawerOpen}
          onToggle={toggleLogDrawer}
        />
      </div>
      {/* Command Palette overlay — position:fixed, overlays everything */}
      <CommandPalette />
    </div>
  );
}
