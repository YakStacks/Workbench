/**
 * SuggestionChips — clickable pill buttons for tool-call suggestions.
 *
 * Rendered beneath assistant message bubbles in ChatTimeline.
 * Each chip fires onPick(suggestion) when clicked — no auto-execution.
 *
 * Phase L+1 — Dismiss:
 *   An optional onDismiss() callback renders a small "×" dismiss button
 *   at the end of the chip row.  Clicking it calls onDismiss() which
 *   clears suggestions from the parent message (sets suggestions: []).
 *
 * Minimal dark style, wraps across lines for many chips.
 */

import React from 'react';
import type { Suggestion } from '../types/suggestions';

// ============================================================================
// TYPES
// ============================================================================

interface SuggestionChipsProps {
  suggestions: Suggestion[];
  onPick(suggestion: Suggestion): void;
  /** When provided, renders a dismiss button that clears the chip row. */
  onDismiss?(): void;
}

// ============================================================================
// STYLES
// ============================================================================

const s: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    alignItems: 'center',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    background: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: 20,
    color: '#8b9fc0',
    fontSize: 11,
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s, color 0.12s',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  chipHover: {
    background: '#1a2030',
    borderColor: '#2a3f5a',
    color: '#a8c4e8',
  },
  icon: {
    fontSize: 10,
    opacity: 0.7,
  },
  dismissBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    color: '#333',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
    marginLeft: 2,
    transition: 'color 0.12s',
    userSelect: 'none',
    flexShrink: 0,
  },
  dismissBtnHover: {
    color: '#666',
  },
};

// ============================================================================
// ICON MAP
// ============================================================================

function chipIcon(kind: Suggestion['kind']): string {
  switch (kind) {
    case 'runDoctor':          return '⚕';
    case 'runTool':            return '⚡';
    case 'openPane':           return '⊞';
    case 'openCommandPalette': return '⌘';
    default:                   return '›';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SuggestionChips({ suggestions, onPick, onDismiss }: SuggestionChipsProps): React.ReactElement | null {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [dismissHovered, setDismissHovered] = React.useState(false);

  if (suggestions.length === 0) return null;

  return (
    <div style={s.row} role="group" aria-label="Suggested actions">
      {suggestions.map((suggestion) => {
        const isHovered = hovered === suggestion.id;
        return (
          <button
            key={suggestion.id}
            type="button"
            style={{ ...s.chip, ...(isHovered ? s.chipHover : {}) }}
            title={suggestion.detail}
            onMouseEnter={() => setHovered(suggestion.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onPick(suggestion)}
            aria-label={suggestion.title}
          >
            <span style={s.icon}>{chipIcon(suggestion.kind)}</span>
            {suggestion.title}
          </button>
        );
      })}

      {onDismiss !== undefined && (
        <button
          type="button"
          style={{ ...s.dismissBtn, ...(dismissHovered ? s.dismissBtnHover : {}) }}
          title="Dismiss suggestions"
          aria-label="Dismiss suggestions"
          onMouseEnter={() => setDismissHovered(true)}
          onMouseLeave={() => setDismissHovered(false)}
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </div>
  );
}
