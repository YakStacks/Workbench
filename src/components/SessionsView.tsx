import React, { useState } from 'react';
import { SessionsList, SessionMetadata } from './SessionsList';

interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  chatHistory: any[];
  assets: string[];
  toolRuns: any[];
  model: string;
  mode: 'read' | 'propose' | 'execute';
  provider: string;
  environmentContext: { workingDirectory?: string; [key: string]: any };
}

interface SessionsViewProps {
  sessions: SessionMetadata[];
  currentSession: Session | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onRenameSession: (sessionId: string, newName: string) => void;
  onDeleteSession: (sessionId: string) => void;
  chatComponent: React.ReactNode;
}

export function SessionsView({
  sessions,
  currentSession,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  chatComponent
}: SessionsViewProps) {
  return (
    <div style={styles.container}>
      {/* Left sidebar: Sessions list */}
      <div style={styles.sessionsSidebar}>
        <SessionsList
          sessions={sessions}
          currentSessionId={currentSession?.id || null}
          onSelectSession={onSelectSession}
          onCreateSession={onCreateSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
        />
      </div>

      {/* Right content: Chat interface */}
      <div style={styles.chatContent}>
        {currentSession ? (
          <div style={styles.chatContainer}>
            <div style={styles.sessionHeader}>
              <h2 style={styles.sessionTitle}>{currentSession.name}</h2>
              <div style={styles.sessionMeta}>
                Session ID: {currentSession.id.slice(0, 8)}...
              </div>
            </div>
            <div style={styles.chatWrapper}>
              {chatComponent}
            </div>
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>💬</div>
            <div style={styles.emptyTitle}>No Session Selected</div>
            <div style={styles.emptyDescription}>
              Select a session from the list or create a new one to get started
            </div>
            <button onClick={onCreateSession} style={styles.createButton}>
              Create New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100%',
    width: '100%',
    overflow: 'hidden'
  },
  sessionsSidebar: {
    width: '280px',
    flexShrink: 0,
    borderRight: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-primary)',
    overflow: 'hidden'
  },
  chatContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-primary)'
  },
  chatContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden'
  },
  sessionHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-secondary)'
  },
  sessionTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  sessionMeta: {
    marginTop: '4px',
    fontSize: '12px',
    color: 'var(--text-secondary)'
  },
  chatWrapper: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
    opacity: 0.5
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px'
  },
  emptyDescription: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '24px',
    maxWidth: '400px'
  },
  createButton: {
    padding: '10px 20px',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-on-accent)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  }
};
