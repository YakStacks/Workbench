/**
 * ChatTimeline — renders an ordered list of chat messages.
 *
 * Supports all four ChatMessage roles:
 *   user      → right-aligned blue bubble
 *   assistant → left-aligned dark bubble
 *   system    → centered muted label
 *   tool      → inline card with name + status indicator
 *
 * Auto-scrolls to bottom when messages change.
 */

import React from 'react';
import type { ChatMessage, ToolMessage } from '../types/chat';

// ============================================================================
// TYPES
// ============================================================================

interface ChatTimelineProps {
  messages: ChatMessage[];
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  timeline: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emptyHint: {
    color: '#2a2a2a',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 24,
  },
  // user bubble
  userBubble: {
    alignSelf: 'flex-end',
    background: '#1e2a3a',
    border: '1px solid #2a3f5a',
    borderRadius: '10px 10px 2px 10px',
    padding: '8px 13px',
    maxWidth: '72%',
    fontSize: 13,
    color: '#b0c8e8',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  // assistant bubble
  assistantBubble: {
    alignSelf: 'flex-start',
    background: '#161616',
    border: '1px solid #222',
    borderRadius: '10px 10px 10px 2px',
    padding: '8px 13px',
    maxWidth: '72%',
    fontSize: 13,
    color: '#c0c0c0',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  // system message
  systemRow: {
    alignSelf: 'center',
    fontSize: 11,
    color: '#383838',
    fontStyle: 'italic',
    padding: '2px 0',
  },
  // tool block
  toolBlock: {
    alignSelf: 'flex-start',
    background: '#111',
    border: '1px solid #1e1e1e',
    borderRadius: 8,
    padding: '9px 14px',
    maxWidth: '80%',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  toolHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  toolName: {
    color: '#8b6fde',
    fontFamily: 'monospace',
    fontWeight: 600,
    fontSize: 12,
  },
  toolStatus: {
    fontSize: 10,
    borderRadius: 4,
    padding: '1px 6px',
    fontWeight: 500,
  },
  toolOutput: {
    color: '#555',
    fontFamily: 'monospace',
    fontSize: 11,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    marginTop: 2,
  },
  toolError: {
    color: '#b04040',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 10,
    color: '#2a2a2a',
    marginTop: 1,
  },
};

// ============================================================================
// STATUS BADGE COLOR
// ============================================================================

function statusStyle(status: ToolMessage['status']): React.CSSProperties {
  const map: Record<ToolMessage['status'], React.CSSProperties> = {
    requested: { background: '#1a1a1a', color: '#555', border: '1px solid #222' },
    running:   { background: '#1a2030', color: '#4d9fff', border: '1px solid #1e3050' },
    success:   { background: '#0d1f0d', color: '#4caf50', border: '1px solid #1a3a1a' },
    error:     { background: '#1f0d0d', color: '#cf6679', border: '1px solid #3a1a1a' },
  };
  return { ...styles.toolStatus, ...map[status] };
}

// ============================================================================
// SUB-RENDERERS
// ============================================================================

function ToolBlock({ msg }: { msg: ToolMessage }): React.ReactElement {
  return (
    <div style={styles.toolBlock}>
      <div style={styles.toolHeader}>
        <span style={{ color: '#444', fontSize: 10 }}>tool</span>
        <span style={styles.toolName}>{msg.toolName}</span>
        <span style={statusStyle(msg.status)}>{msg.status}</span>
      </div>
      {msg.output !== undefined && msg.status === 'success' && (
        <div style={styles.toolOutput}>
          {typeof msg.output === 'string'
            ? msg.output
            : JSON.stringify(msg.output, null, 2)}
        </div>
      )}
      {msg.error !== undefined && (
        <div style={styles.toolError}>{msg.error}</div>
      )}
    </div>
  );
}

function Timestamp({ ms }: { ms: number }): React.ReactElement {
  const d = new Date(ms);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return <div style={styles.timestamp}>{hh}:{mm}</div>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ChatTimeline({ messages }: ChatTimelineProps): React.ReactElement {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={styles.timeline} aria-label="Chat timeline" aria-live="polite">
      {messages.length === 0 && (
        <div style={styles.emptyHint}>No messages yet.</div>
      )}

      {messages.map((msg) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <div style={styles.userBubble}>{msg.content}</div>
              <Timestamp ms={msg.createdAt} />
            </div>
          );
        }

        if (msg.role === 'assistant') {
          return (
            <div key={msg.id} style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={styles.assistantBubble}>{msg.content}</div>
              <Timestamp ms={msg.createdAt} />
            </div>
          );
        }

        if (msg.role === 'system') {
          return (
            <div key={msg.id} style={styles.systemRow}>
              {msg.content}
            </div>
          );
        }

        if (msg.role === 'tool') {
          return (
            <div key={msg.id} style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <ToolBlock msg={msg} />
              <Timestamp ms={msg.createdAt} />
            </div>
          );
        }

        return null;
      })}

      <div ref={endRef} />
    </div>
  );
}
