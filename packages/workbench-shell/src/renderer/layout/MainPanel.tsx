/**
 * MainPanel — renders the active workspace or a section page.
 *
 * Owns the central content area. Does NOT import specific pages;
 * those are passed via render props / slots to keep this component decoupled.
 */

import React from 'react';
import type { WorkbenchWorkspace } from '../../types';
import type { SidebarSection } from '../state/shellStore';

// ============================================================================
// TYPES
// ============================================================================

interface MainPanelProps {
  activeSection: SidebarSection;
  activeWorkspace: WorkbenchWorkspace | null;
  /** Rendered page components injected by ShellLayout */
  pages: Partial<Record<SidebarSection, React.ReactNode>>;
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  panel: {
    flex: 1,
    overflow: 'auto',
    background: '#111',
    position: 'relative',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#333',
    fontSize: 13,
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function MainPanel({ activeSection, activeWorkspace, pages }: MainPanelProps): React.ReactElement {
  // If we're in 'workspaces' section and have an active workspace, render it
  if (activeSection === 'workspaces' && activeWorkspace) {
    return (
      <main style={styles.panel} role="main">
        {activeWorkspace.render()}
      </main>
    );
  }

  // Render the injected page for this section
  const page = pages[activeSection];
  if (page) {
    return (
      <main style={styles.panel} role="main">
        {page}
      </main>
    );
  }

  // Fallback placeholder
  return (
    <main style={styles.panel} role="main">
      <div style={styles.placeholder}>
        {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} — coming soon
      </div>
    </main>
  );
}
