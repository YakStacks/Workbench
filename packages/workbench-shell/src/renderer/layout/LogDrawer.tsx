/**
 * LogDrawer — collapsible bottom drawer for runtime observability.
 *
 * Phase 6: Self-contained. Subscribes to EventBus via useRuntime() on mount.
 * Writes entries into shellStore.logEvents (cap 200).
 * Unsubscribes on unmount — no memory leaks.
 */

import React from 'react';
import { useShellStore } from '../state/shellStore';
import { useRuntime } from '../../runtime/runtimeContext';

// ============================================================================
// TYPES
// ============================================================================

interface LogDrawerProps {
  open: boolean;
  onToggle(): void;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTs(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Convert a raw Core RuntimeEvent (unknown shape) to a human-readable label.
 * Only the `type` field is trusted for branching; everything else is optional.
 */
function eventToLabel(event: unknown): string {
  if (event === null || typeof event !== 'object') return String(event);
  const e = event as Record<string, unknown>;
  const type = typeof e['type'] === 'string' ? e['type'] : '?';
  switch (type) {
    case 'tool:requested':
      return `Tool requested: ${e['toolName'] ?? '?'}`;
    case 'tool:started':
      return `Tool started: ${e['toolName'] ?? '?'} (${e['runId'] ?? '?'})`;
    case 'tool:verified':
      return `Tool verified: ${e['toolName'] ?? '?'} — ${e['status'] ?? '?'}`;
    case 'tool:failed':
      return `Tool failed: ${e['toolName'] ?? '?'} — ${e['reason'] ?? '?'}`;
    case 'doctor:run': {
      const s = (e['summary'] ?? {}) as Record<string, unknown>;
      return `Doctor ran — PASS ${s['pass'] ?? 0} WARN ${s['warn'] ?? 0} FAIL ${s['fail'] ?? 0}`;
    }
    default:
      return type;
  }
}

const DRAWER_HEIGHT = 200;

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flexShrink: 0,
    borderTop: '1px solid #1e1e1e',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: 28,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: 8,
    cursor: 'pointer',
    userSelect: 'none',
    borderBottom: '1px solid #1a1a1a',
  },
  headerLabel: {
    fontSize: 11,
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    flex: 1,
  },
  chevron: {
    fontSize: 10,
    color: '#444',
    transition: 'transform 0.15s',
  },
  content: {
    height: DRAWER_HEIGHT,
    overflow: 'auto',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 1.5,
    color: '#555',
    padding: '6px 12px',
  },
  entry: {
    display: 'flex',
    gap: 12,
    padding: '2px 0',
    borderBottom: '1px solid #111',
  },
  ts: {
    color: '#333',
    flexShrink: 0,
    minWidth: 80,
  },
  type: {
    color: '#4d9fff',
    flexShrink: 0,
    minWidth: 120,
  },
  label: {
    color: '#888',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  empty: {
    color: '#2a2a2a',
    fontStyle: 'italic',
    padding: '8px 0',
  },
};

// ============================================================================
// STYLES
// ============================================================================

export function LogDrawer({ open, onToggle }: LogDrawerProps): React.ReactElement {
  const { logEvents, addLogEvent } = useShellStore();
  const runtime = useRuntime();

  // Subscribe once on mount; runtime is a stable singleton.
  React.useEffect(() => {
    const unsubscribe = runtime.subscribeToEvents((event) => {
      const e = event as Record<string, unknown>;
      addLogEvent({
        type: typeof e['type'] === 'string' ? e['type'] : 'unknown',
        timestamp: typeof e['timestamp'] === 'number' ? e['timestamp'] : Date.now(),
        label: eventToLabel(event),
      });
    });
    return unsubscribe;
  }, [runtime, addLogEvent]);

  return (
    <div style={styles.wrapper}>
      {/* Toggle header — always visible */}
      <div
        style={styles.header}
        onClick={onToggle}
        role="button"
        aria-expanded={open}
        aria-label="Toggle runtime log drawer"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
      >
        <span style={styles.headerLabel}>
          Runtime Log
          {logEvents.length > 0 && (
            <span style={{ color: '#3a5a3a', marginLeft: 8 }}>({logEvents.length})</span>
          )}
        </span>
        <span style={{ ...styles.chevron, transform: open ? 'rotate(180deg)' : 'none' }}>
          ▲
        </span>
      </div>

      {/* Drawer content */}
      {open && (
        <div style={styles.content} aria-label="Runtime log" aria-live="polite">
          {logEvents.length === 0 ? (
            <div style={styles.empty}>No events yet.</div>
          ) : (
            [...logEvents].reverse().map((ev, i) => (
              <div key={i} style={styles.entry}>
                <span style={styles.ts}>{formatTs(ev.timestamp)}</span>
                <span style={styles.type}>{ev.type}</span>
                <span style={styles.label}>{ev.label}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
