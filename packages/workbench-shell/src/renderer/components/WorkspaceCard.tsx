/**
 * WorkspaceCard — displays a persisted workspace in the Home grid.
 *
 * Shows: app icon, title, last opened timestamp, open + delete buttons.
 * Fires callbacks up — no store access, fully presentational.
 */

import React from 'react';
import type { PersistedWorkspace } from '../../types';

// ============================================================================
// TYPES
// ============================================================================

interface WorkspaceCardProps {
  workspace: PersistedWorkspace;
  appName: string;
  appIcon?: string;
  onOpen(): void;
  onDelete(): void;
}

// ============================================================================
// HELPERS
// ============================================================================

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#161616',
    border: '1px solid #1e1e1e',
    borderRadius: 8,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    transition: 'border-color 0.15s',
    cursor: 'default',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    background: '#1e2a3a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 500,
    color: '#d0d0d0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  appName: {
    fontSize: 11,
    color: '#444',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
    color: '#333',
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  btnOpen: {
    flex: 1,
    padding: '5px 0',
    fontSize: 11,
    background: '#1e2a3a',
    color: '#4d9fff',
    border: '1px solid #2a3f5a',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  btnDelete: {
    padding: '5px 10px',
    fontSize: 11,
    background: 'transparent',
    color: '#444',
    border: '1px solid #222',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'color 0.1s',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function WorkspaceCard({ workspace, appName, appIcon, onOpen, onDelete }: WorkspaceCardProps): React.ReactElement {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.iconBox} aria-hidden>
          {appIcon ?? '◻'}
        </div>
        <div style={styles.meta}>
          <div style={styles.title} title={workspace.title}>{workspace.title}</div>
          <div style={styles.appName}>{appName}</div>
        </div>
      </div>

      <div style={styles.timestamp}>
        Last opened: {relativeTime(workspace.lastOpened)}
      </div>

      <div style={styles.actions}>
        <button style={styles.btnOpen} onClick={onOpen} aria-label={`Open ${workspace.title}`}>
          Open
        </button>
        <button style={styles.btnDelete} onClick={onDelete} aria-label={`Delete ${workspace.title}`}>
          ✕
        </button>
      </div>
    </div>
  );
}
