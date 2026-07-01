import React, { useState } from 'react';

export interface SessionMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface SessionsListProps {
  sessions: SessionMetadata[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onRenameSession: (sessionId: string, newName: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionsList({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession
}: SessionsListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleStartEdit = (session: SessionMetadata) => {
    setEditingId(session.id);
    setEditingName(session.name);
  };

  const handleSaveEdit = (sessionId: string) => {
    if (editingName.trim()) {
      onRenameSession(sessionId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(sessionId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div style={styles.container}>
      {/* New Session Button */}
      <button className="new-button" style={styles.newButton} onClick={onCreateSession}>
        <span style={styles.plusIcon}>+</span> New Session
      </button>

      {/* Sessions Header */}
      <div style={styles.header}>Sessions</div>

      {/* Sessions List */}
      <div style={styles.list}>
        {sessions.map(session => (
          <div
            key={session.id}
            className="session-item"
            style={{
              ...styles.sessionItem,
              ...(currentSessionId === session.id ? styles.sessionItemActive : {})
            }}
            onClick={() => !editingId && onSelectSession(session.id)}
          >
            {editingId === session.id ? (
              <div style={styles.editContainer}>
                <input
                  type="text"
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, session.id)}
                  onBlur={() => handleSaveEdit(session.id)}
                  autoFocus
                  style={styles.editInput}
                />
              </div>
            ) : (
              <>
                <div style={styles.sessionContent}>
                  <span style={styles.bullet}>•</span>
                  <span style={styles.sessionName}>{session.name}</span>
                </div>
                <div className="session-actions" style={styles.sessionActions}>
                  <button
                    style={styles.actionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(session);
                    }}
                    title="Rename"
                  >
                    ✎
                  </button>
                  <button
                    style={styles.actionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete session "${session.name}"?`)) {
                        onDeleteSession(session.id);
                      }
                    }}
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {sessions.length === 0 && (
          <div style={styles.emptyState}>
            No sessions yet. Create one to get started!
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
    padding: '16px',
    gap: '12px'
  },
  newButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-on-accent)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  plusIcon: {
    fontSize: '18px',
    fontWeight: 'bold'
  },
  header: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    paddingLeft: '8px',
    marginTop: '8px'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflowY: 'auto',
    flex: 1
  },
  sessionItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    backgroundColor: 'transparent',
    position: 'relative'
  },
  sessionItemActive: {
    backgroundColor: 'var(--bg-tertiary)'
  },
  sessionContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    overflow: 'hidden'
  },
  bullet: {
    fontSize: '16px',
    color: 'var(--accent-primary)',
    flexShrink: 0
  },
  sessionName: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  sessionActions: {
    display: 'flex',
    gap: '4px',
    opacity: 0,
    transition: 'opacity 0.2s'
  },
  actionButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: '4px',
    transition: 'background-color 0.2s, color 0.2s'
  },
  editContainer: {
    flex: 1
  },
  editInput: {
    width: '100%',
    padding: '6px 8px',
    fontSize: '14px',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--accent-primary)',
    borderRadius: '4px',
    outline: 'none'
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--text-secondary)'
  }
};
