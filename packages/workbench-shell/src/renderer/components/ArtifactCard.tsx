/**
 * ArtifactCard — displays a single artifact in the Artifacts tab.
 *
 * Shows: kind badge, title, createdAt, content preview (~120 chars).
 * Buttons: Open (shows full content in Modal), Copy, Delete.
 */

import React from 'react';
import type { Artifact } from '../types/artifacts';
import { Modal } from './Modal';

// ============================================================================
// HELPERS
// ============================================================================

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const KIND_COLORS: Record<string, string> = {
  json: '#4d9fff',
  text: '#8b8b8b',
  note: '#8b6fde',
  file: '#5a9',
};

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#141414',
    border: '1px solid #1e1e1e',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  kindBadge: {
    fontSize: 10,
    borderRadius: 4,
    padding: '1px 6px',
    fontWeight: 600,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontSize: 12,
    fontWeight: 500,
    color: '#c0c0c0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  ts: {
    fontSize: 10,
    color: '#333',
    flexShrink: 0,
  },
  preview: {
    fontSize: 11,
    color: '#444',
    fontFamily: 'monospace',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  actions: {
    display: 'flex',
    gap: 6,
    marginTop: 2,
  },
  btn: {
    fontSize: 11,
    padding: '3px 10px',
    borderRadius: 4,
    border: '1px solid #222',
    background: '#111',
    color: '#666',
    cursor: 'pointer',
  },
  btnOpen: {
    color: '#4d9fff',
    borderColor: '#1e2a3a',
    background: '#0d1a26',
  },
  // Modal content
  modalContent: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#c0c0c0',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

interface ArtifactCardProps {
  artifact: Artifact;
  onDelete(artifactId: string): void;
}

export function ArtifactCard({ artifact, onDelete }: ArtifactCardProps): React.ReactElement {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const kindColor = KIND_COLORS[artifact.kind] ?? '#888';
  const preview = artifact.content.length > 120
    ? artifact.content.slice(0, 120) + '…'
    : artifact.content;

  function handleCopy() {
    navigator.clipboard?.writeText(artifact.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      <div style={styles.card}>
        <div style={styles.topRow}>
          <span style={{ ...styles.kindBadge, color: kindColor, background: '#0d0d0d', border: `1px solid ${kindColor}33` }}>
            {artifact.kind}
          </span>
          <span style={styles.title} title={artifact.title}>{artifact.title}</span>
          <span style={styles.ts}>{relativeTime(artifact.createdAt)}</span>
        </div>
        <div style={styles.preview}>{preview}</div>
        <div style={styles.actions}>
          <button style={{ ...styles.btn, ...styles.btnOpen }} onClick={() => setModalOpen(true)}>
            Open
          </button>
          <button style={styles.btn} onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button style={styles.btn} onClick={() => onDelete(artifact.id)}>
            Delete
          </button>
        </div>
      </div>

      {modalOpen && (
        <Modal title={artifact.title} onClose={() => setModalOpen(false)}>
          <div style={styles.modalContent}>{artifact.content}</div>
        </Modal>
      )}
    </>
  );
}
