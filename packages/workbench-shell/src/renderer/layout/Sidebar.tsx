/**
 * Sidebar — left navigation rail.
 *
 * Renders navigation icons + labels.
 * Does NOT know about apps, workspaces, or tabs.
 * Pure navigation UI.
 */

import React from 'react';
import type { SidebarSection } from '../state/shellStore';

// ============================================================================
// TYPES
// ============================================================================

interface SidebarItem {
  id: SidebarSection;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  active: SidebarSection;
  onSelect(section: SidebarSection): void;
}

// ============================================================================
// ICONS (minimal inline SVG — no icon lib dependency)
// ============================================================================

const IconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconWorkspaces = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="9" height="9" rx="1"/>
    <rect x="13" y="3" width="9" height="9" rx="1"/>
    <rect x="2" y="14" width="9" height="7" rx="1"/>
    <rect x="13" y="14" width="9" height="7" rx="1"/>
  </svg>
);

const IconApps = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="4"/>
    <circle cx="15" cy="15" r="4"/>
    <line x1="9" y1="13" x2="9" y2="20"/>
    <line x1="15" y1="4" x2="15" y2="11"/>
  </svg>
);

const IconDoctor = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// ============================================================================
// DATA
// ============================================================================

const ITEMS: SidebarItem[] = [
  { id: 'home',       label: 'Home',       icon: <IconHome /> },
  { id: 'workspaces', label: 'Workspaces', icon: <IconWorkspaces /> },
  { id: 'apps',       label: 'Apps',       icon: <IconApps /> },
  { id: 'doctor',     label: 'Doctor',     icon: <IconDoctor /> },
  { id: 'settings',   label: 'Settings',   icon: <IconSettings /> },
];

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 56,
    height: '100%',
    background: '#111111',
    borderRight: '1px solid #1e1e1e',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    gap: 2,
    flexShrink: 0,
  },
  item: {
    width: 40,
    height: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    cursor: 'pointer',
    color: '#555',
    transition: 'background 0.1s, color 0.1s',
    userSelect: 'none',
  },
  itemActive: {
    background: '#1e2a3a',
    color: '#4d9fff',
  },
  label: {
    fontSize: 9,
    marginTop: 2,
    lineHeight: 1,
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function Sidebar({ active, onSelect }: SidebarProps): React.ReactElement {
  return (
    <aside style={styles.sidebar} role="navigation" aria-label="Workbench navigation">
      {ITEMS.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            title={item.label}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              ...styles.item,
              ...(isActive ? styles.itemActive : {}),
              border: 'none',
              background: isActive ? '#1e2a3a' : 'transparent',
            }}
          >
            {item.icon}
            <span style={styles.label}>{item.label}</span>
          </button>
        );
      })}
    </aside>
  );
}
