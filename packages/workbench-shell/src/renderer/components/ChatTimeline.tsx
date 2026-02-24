/**
 * ChatTimeline — renders an ordered list of chat messages.
 *
 * Supports all four ChatMessage roles:
 *   user      → right-aligned blue bubble
 *   assistant → left-aligned dark bubble (+ optional SuggestionChips)
 *   system    → centered muted label
 *   tool      → inline card with name + status indicator
 *
 * Auto-scrolls to bottom when messages change.
 *
 * Phase L — Suggestion Chips:
 *   Assistant messages may carry a `suggestions` array.  When present,
 *   <SuggestionChips> is rendered beneath the bubble.  Clicking a chip
 *   calls onPickSuggestion(suggestion) — the parent (ButlerChatView) owns
 *   the execution logic.  No auto-execution here.
 *
 * Phase L+1 — Dismiss Suggestions:
 *   An optional onDismissSuggestions(messageId) callback is passed down.
 *   When provided, SuggestionChips renders a small "×" dismiss button.
 *   Clicking it calls onDismissSuggestions(msg.id) in the parent.
 *
 * Phase M5 — Pin / Include controls:
 *   Subtle action row shown on hover beneath user and assistant bubbles.
 *   - Pin toggle (📌): calls onTogglePin(messageId)
 *   - Include checkbox: calls onToggleInclude(messageId, include)
 *   Both callbacks are optional. When absent the controls are hidden.
 *   Pinned state and include state passed in via pinnedIds / includedIds sets.
 */

import React from 'react';
import type { ChatMessage, ToolMessage } from '../types/chat';
import type { Suggestion } from '../types/suggestions';
import { SuggestionChips } from './SuggestionChips';

// ============================================================================
// TYPES
// ============================================================================

interface ChatTimelineProps {
  messages: ChatMessage[];
  /** Called when user clicks a suggestion chip. Required to enable chips. */
  onPickSuggestion?(suggestion: Suggestion): void;
  /**
   * Called when user clicks the dismiss button on a suggestion chip row.
   * Receives the assistant messageId whose suggestions should be cleared.
   * When provided, a "×" dismiss button appears at the end of each chip row.
   */
  onDismissSuggestions?(messageId: string): void;
  /**
   * M5 — Toggle pin for a message. When provided, a pin button appears on hover.
   */
  onTogglePin?(messageId: string): void;
  /**
   * M5 — Toggle include for a message. When provided, a checkbox appears on hover.
   * @param include true = include in context, false = exclude
   */
  onToggleInclude?(messageId: string, include: boolean): void;
  /** M5 — Set of currently pinned messageIds (for visual state). */
  pinnedIds?: ReadonlySet<string>;
  /** M5 — Set of currently included messageIds (for visual state). */
  includedIds?: ReadonlySet<string>;
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
  // M5 — message action row
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    minHeight: 18,
  },
  actionBtn: {
    background: 'transparent',
    border: 'none',
    padding: '0 2px',
    fontSize: 11,
    cursor: 'pointer',
    color: '#2a2a2a',
    transition: 'color 0.1s',
    userSelect: 'none',
    lineHeight: 1,
  },
  actionBtnActive: {
    color: '#4d9fff',
  },
  actionLabel: {
    fontSize: 10,
    color: '#2a2a2a',
    cursor: 'pointer',
    userSelect: 'none',
  },
  actionLabelActive: {
    color: '#4caf50',
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

// ── M5: Per-message action row ─────────────────────────────────────────────

interface MessageActionsProps {
  messageId: string;
  isPinned: boolean;
  isIncluded: boolean;
  onTogglePin?(id: string): void;
  onToggleInclude?(id: string, include: boolean): void;
  /** Align to right for user bubbles, left for assistant */
  align: 'left' | 'right';
}

function MessageActions({
  messageId, isPinned, isIncluded,
  onTogglePin, onToggleInclude, align,
}: MessageActionsProps): React.ReactElement | null {
  if (!onTogglePin && !onToggleInclude) return null;

  return (
    <div style={{
      ...styles.actionRow,
      justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
    }}>
      {onTogglePin && (
        <button
          type="button"
          style={{
            ...styles.actionBtn,
            ...(isPinned ? styles.actionBtnActive : {}),
          }}
          title={isPinned ? 'Unpin message' : 'Pin message (always in LLM context)'}
          onClick={() => onTogglePin(messageId)}
          aria-label={isPinned ? 'Unpin' : 'Pin'}
          aria-pressed={isPinned}
        >
          {isPinned ? '📌' : '📍'}
        </button>
      )}
      {onToggleInclude && (
        <label
          style={{
            ...styles.actionLabel,
            ...(isIncluded ? styles.actionLabelActive : {}),
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            cursor: 'pointer',
          }}
          title={isIncluded ? 'Remove from LLM context' : 'Include in LLM context'}
        >
          <input
            type="checkbox"
            checked={isIncluded}
            onChange={(e) => onToggleInclude(messageId, e.target.checked)}
            style={{ accentColor: '#4caf50', cursor: 'pointer' }}
            aria-label="Include in context"
          />
          ctx
        </label>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ChatTimeline({
  messages,
  onPickSuggestion,
  onDismissSuggestions,
  onTogglePin,
  onToggleInclude,
  pinnedIds,
  includedIds,
}: ChatTimelineProps): React.ReactElement {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasPinInclude = onTogglePin !== undefined || onToggleInclude !== undefined;

  return (
    <div style={styles.timeline} aria-label="Chat timeline" aria-live="polite">
      {messages.length === 0 && (
        <div style={styles.emptyHint}>No messages yet.</div>
      )}

      {messages.map((msg) => {
        if (msg.role === 'user') {
          const isPinned = pinnedIds?.has(msg.id) ?? false;
          const isIncluded = includedIds?.has(msg.id) ?? false;
          return (
            <div key={msg.id} style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <div style={styles.userBubble}>{msg.content}</div>
              {hasPinInclude && (
                <MessageActions
                  messageId={msg.id}
                  isPinned={isPinned}
                  isIncluded={isIncluded}
                  onTogglePin={onTogglePin}
                  onToggleInclude={onToggleInclude}
                  align="right"
                />
              )}
              <Timestamp ms={msg.createdAt} />
            </div>
          );
        }

        if (msg.role === 'assistant') {
          const hasSuggestions =
            onPickSuggestion !== undefined &&
            msg.suggestions !== undefined &&
            msg.suggestions.length > 0;
          const isPinned = pinnedIds?.has(msg.id) ?? false;
          const isIncluded = includedIds?.has(msg.id) ?? false;
          return (
            <div key={msg.id} style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '80%' }}>
              <div style={styles.assistantBubble}>{msg.content}</div>
              {hasSuggestions && (
                <SuggestionChips
                  suggestions={msg.suggestions!}
                  onPick={onPickSuggestion!}
                  onDismiss={
                    onDismissSuggestions !== undefined
                      ? () => onDismissSuggestions(msg.id)
                      : undefined
                  }
                />
              )}
              {hasPinInclude && (
                <MessageActions
                  messageId={msg.id}
                  isPinned={isPinned}
                  isIncluded={isIncluded}
                  onTogglePin={onTogglePin}
                  onToggleInclude={onToggleInclude}
                  align="left"
                />
              )}
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
