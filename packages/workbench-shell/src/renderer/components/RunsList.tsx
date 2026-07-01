/**
 * RunsList — filtered view of runtime log events for a specific workspace.
 *
 * Reads from shellStore.logEvents (same source as LogDrawer).
 * Filters to entries where logEntry.workspaceId === workspaceId.
 * Renders events newest-first as a minimal list.
 */

import React from 'react';
import { useShellStore } from '../state/shellStore';

interface RunsListProps {
  workspaceId: string;
}

function formatTs(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const TYPE_COLORS: Record<string, string> = {
  'tool:requested': '#555',
  'tool:started': '#4d9fff',
  'tool:verified': '#4caf50',
  'tool:failed': '#cf6679',
  'doctor:run': '#8b6fde',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    overflow: 'auto',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  emptyHint: {
    color: '#2a2a2a',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 32,
  },
  row: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    padding: '5px 0',
    borderBottom: '1px solid #111',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  ts: {
    color: '#333',
    flexShrink: 0,
    minWidth: 70,
  },
  type: {
    flexShrink: 0,
    minWidth: 110,
    fontWeight: 600,
  },
  label: {
    color: '#555',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};

export function RunsList({ workspaceId }: RunsListProps): React.ReactElement {
  const logEvents = useShellStore((s) => s.logEvents);

  const filtered = logEvents.filter((e) => e.workspaceId === workspaceId);
  const sorted = [...filtered].reverse(); // newest first

  return (
    <div style={styles.container}>
      {sorted.length === 0 ? (
        <div style={styles.emptyHint}>No runs for this workspace yet.</div>
      ) : (
        sorted.map((ev, i) => (
          <div key={i} style={styles.row}>
            <span style={styles.ts}>{formatTs(ev.timestamp)}</span>
            <span style={{ ...styles.type, color: TYPE_COLORS[ev.type] ?? '#888' }}>
              {ev.type}
            </span>
            <span style={styles.label} title={ev.label}>{ev.label}</span>
          </div>
        ))
      )}
    </div>
  );
}
