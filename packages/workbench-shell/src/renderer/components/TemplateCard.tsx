/**
 * TemplateCard — displays a single workspace template in the wizard grid.
 * Highlights when selected. No dependencies beyond React.
 */

import React from 'react';
import type { WorkspaceTemplate } from '../types/templates';

interface TemplateCardProps {
  template: WorkspaceTemplate;
  selected: boolean;
  onSelect(): void;
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: '16px 18px',
    background: '#141414',
    border: '1px solid #1e1e1e',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardSelected: {
    borderColor: '#4d9fff',
    background: '#111827',
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: '#d0d0d0',
    margin: 0,
  },
  description: {
    fontSize: 11,
    color: '#666',
    lineHeight: 1.5,
    margin: 0,
  },
  badge: {
    fontSize: 9,
    color: '#4d9fff',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginTop: 4,
  },
};

export function TemplateCard({ template, selected, onSelect }: TemplateCardProps): React.ReactElement {
  return (
    <div
      style={selected ? { ...styles.card, ...styles.cardSelected } : styles.card}
      onClick={onSelect}
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
    >
      <p style={styles.title}>{template.title}</p>
      <p style={styles.description}>{template.description}</p>
      <span style={styles.badge}>{template.appId}</span>
    </div>
  );
}
