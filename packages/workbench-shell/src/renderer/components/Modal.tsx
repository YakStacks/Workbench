/**
 * Modal — minimal overlay for displaying artifact content.
 * No dependencies. Escape or backdrop click closes.
 */

import React from 'react';

interface ModalProps {
  title: string;
  onClose(): void;
  children: React.ReactNode;
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    background: '#161616',
    border: '1px solid #252525',
    borderRadius: 12,
    width: '600px',
    maxWidth: 'calc(100vw - 48px)',
    maxHeight: 'calc(100vh - 80px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid #1e1e1e',
    flexShrink: 0,
  },
  titleText: {
    fontSize: 13,
    fontWeight: 500,
    color: '#d0d0d0',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#555',
    fontSize: 16,
    cursor: 'pointer',
    padding: '2px 6px',
    lineHeight: 1,
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 18px',
  },
};

export function Modal({ title, onClose, children }: ModalProps): React.ReactElement {
  // Close on Escape
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      style={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div style={styles.dialog}>
        <div style={styles.header}>
          <span style={styles.titleText}>{title}</span>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  );
}
