/**
 * ArtifactCard — displays a single artifact in the Artifacts tab.
 *
 * Shows: kind badge, title, createdAt, content preview (~120 chars).
 * Buttons: Open (modal), Copy ▼ (dropdown: Markdown/Text/JSON), Open as Workspace, Delete.
 */

import React from 'react';
import type { Artifact } from '../types/artifacts';
import { Modal } from './Modal';
import { openArtifactAsWorkspace } from '../templates/openArtifactAsWorkspace';
import { copyText } from '../utils/clipboard';
import { artifactToMarkdown, artifactToJsonString, artifactToPlainText } from '../utils/exportFormatters';

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
    flexWrap: 'wrap',
    alignItems: 'center',
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
  btnWorkspace: {
    color: '#8b6fde',
    borderColor: '#2a1e3a',
    background: '#1a0d26',
  },
  // Copy dropdown wrapper
  copyWrapper: {
    position: 'relative' as const,
    display: 'inline-block',
  },
  copyDropdown: {
    position: 'absolute' as const,
    bottom: '100%',
    left: 0,
    marginBottom: 4,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    padding: '4px 0',
    zIndex: 100,
    minWidth: 140,
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  copyOption: {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    fontSize: 11,
    color: '#999',
    background: 'transparent',
    border: 'none',
    textAlign: 'left' as const,
    cursor: 'pointer',
  },
  copyOptionDisabled: {
    color: '#333',
    cursor: 'default',
  },
  // Inline toast
  toast: {
    fontSize: 10,
    color: '#4d9fff',
    marginLeft: 4,
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
  const [copyMenuOpen, setCopyMenuOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const kindColor = KIND_COLORS[artifact.kind] ?? '#888';
  const preview = artifact.content.length > 120
    ? artifact.content.slice(0, 120) + '…'
    : artifact.content;

  // Close copy menu on outside click
  React.useEffect(() => {
    if (!copyMenuOpen) return;
    function handleClick() { setCopyMenuOpen(false); }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [copyMenuOpen]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1200);
  }

  async function handleCopyMarkdown() {
    const text = artifactToMarkdown(artifact);
    const ok = await copyText(text);
    showToast(ok ? 'Copied!' : 'Failed');
    setCopyMenuOpen(false);
  }

  async function handleCopyText() {
    const text = artifactToPlainText(artifact);
    const ok = await copyText(text);
    showToast(ok ? 'Copied!' : 'Failed');
    setCopyMenuOpen(false);
  }

  async function handleCopyJson() {
    const text = artifactToJsonString(artifact);
    if (!text) return;
    const ok = await copyText(text);
    showToast(ok ? 'Copied!' : 'Failed');
    setCopyMenuOpen(false);
  }

  function handleOpenAsWorkspace() {
    openArtifactAsWorkspace(artifact).catch((err) => {
      console.error('[ArtifactCard] Open as Workspace failed:', err);
    });
  }

  const jsonAvailable = artifact.kind === 'json';

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

          {/* Copy dropdown */}
          <div style={styles.copyWrapper}>
            <button
              style={styles.btn}
              onClick={(e) => { e.stopPropagation(); setCopyMenuOpen(!copyMenuOpen); }}
            >
              Copy ▾
            </button>
            {copyMenuOpen && (
              <div style={styles.copyDropdown} onClick={(e) => e.stopPropagation()}>
                <button style={styles.copyOption} onClick={handleCopyMarkdown}>
                  Copy as Markdown
                </button>
                <button style={styles.copyOption} onClick={handleCopyText}>
                  Copy as Text
                </button>
                <button
                  style={jsonAvailable ? styles.copyOption : { ...styles.copyOption, ...styles.copyOptionDisabled }}
                  onClick={jsonAvailable ? handleCopyJson : undefined}
                  disabled={!jsonAvailable}
                >
                  Copy as JSON
                </button>
              </div>
            )}
          </div>

          <button style={{ ...styles.btn, ...styles.btnWorkspace }} onClick={handleOpenAsWorkspace}>
            Open as Workspace
          </button>
          <button style={styles.btn} onClick={() => onDelete(artifact.id)}>
            Delete
          </button>

          {toast && <span style={styles.toast}>{toast}</span>}
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
