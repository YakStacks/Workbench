/**
 * TabBar — top workspace tab strip.
 *
 * Renders open workspace tabs. Clicking activates. X closes.
 * Does NOT know about apps or runtime. Pure tab UI.
 */

import React from 'react';
import type { OpenTab } from '../state/shellStore';

// ============================================================================
// TYPES
// ============================================================================

interface TabBarProps {
  tabs: OpenTab[];
  activeTabId: string | null;
  onActivate(workspaceId: string): void;
  onClose(workspaceId: string): void;
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 36,
    background: '#0d0d0d',
    borderBottom: '1px solid #1e1e1e',
    display: 'flex',
    alignItems: 'stretch',
    overflowX: 'auto',
    flexShrink: 0,
    scrollbarWidth: 'none',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 12px',
    fontSize: 12,
    color: '#666',
    cursor: 'pointer',
    borderRight: '1px solid #1a1a1a',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    userSelect: 'none',
    background: 'transparent',
    border: 'none',
    transition: 'color 0.1s, background 0.1s',
  },
  tabActive: {
    color: '#e0e0e0',
    background: '#1a1a1a',
    borderBottom: '1px solid #4d9fff',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: 3,
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    padding: 0,
    opacity: 0.5,
    fontSize: 12,
    lineHeight: 1,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    fontSize: 11,
    color: '#333',
    fontStyle: 'italic',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function TabBar({ tabs, activeTabId, onActivate, onClose }: TabBarProps): React.ReactElement {
  if (tabs.length === 0) {
    return (
      <div style={styles.bar}>
        <span style={styles.empty}>No open workspaces</span>
      </div>
    );
  }

  return (
    <div style={styles.bar} role="tablist" aria-label="Open workspaces">
      {tabs.map((tab) => {
        const isActive = tab.workspace.id === activeTabId;
        return (
          <div
            key={tab.workspace.id}
            role="tab"
            aria-selected={isActive}
            style={{
              ...styles.tab,
              ...(isActive ? styles.tabActive : {}),
            }}
          >
            {/* Activate on label click */}
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: 12,
                padding: 0,
              }}
              onClick={() => onActivate(tab.workspace.id)}
            >
              {tab.workspace.title}
            </button>

            {/* Close button */}
            <button
              style={styles.closeBtn}
              title={`Close ${tab.workspace.title}`}
              aria-label={`Close ${tab.workspace.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.workspace.id);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
