/**
 * Butler App — stub chat workspace.
 *
 * Domain: Conversational interface
 * Phase 1: Renders a minimal chat UI. No LLM integration yet.
 * Phase 6: Receives WorkbenchRuntimeContext (does not need runTool for Phase 6).
 *
 * Butler must NOT know about Maestro.
 * Butler must NOT access Shell internals.
 */

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WorkbenchApp, WorkbenchWorkspace } from '../../../types';

// ============================================================================
// WORKSPACE RENDER
// ============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

function ButlerPanel({ title }: { title: string }): React.ReactElement {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      text,
      ts: Date.now(),
    };

    // Stub reply
    const botMsg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      text: `(Butler stub — LLM integration coming in Phase 6)`,
      ts: Date.now() + 100,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
  }

  const styles: Record<string, React.CSSProperties> = {
    root: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      padding: '14px 20px',
      borderBottom: '1px solid #1a1a1a',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    icon: {
      fontSize: 16,
      color: '#8b6fde',
    },
    title: {
      fontSize: 14,
      fontWeight: 500,
      color: '#d0d0d0',
    },
    badge: {
      fontSize: 10,
      color: '#444',
      background: '#1a1a1a',
      border: '1px solid #222',
      borderRadius: 4,
      padding: '2px 6px',
    },
    messages: {
      flex: 1,
      overflow: 'auto',
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    },
    msgUser: {
      alignSelf: 'flex-end',
      background: '#1e2a3a',
      border: '1px solid #2a3f5a',
      borderRadius: '8px 8px 2px 8px',
      padding: '7px 12px',
      maxWidth: '70%',
      fontSize: 13,
      color: '#b0c8e8',
    },
    msgBot: {
      alignSelf: 'flex-start',
      background: '#161616',
      border: '1px solid #1e1e1e',
      borderRadius: '8px 8px 8px 2px',
      padding: '7px 12px',
      maxWidth: '70%',
      fontSize: 13,
      color: '#888',
    },
    inputRow: {
      display: 'flex',
      gap: 8,
      padding: '12px 16px',
      borderTop: '1px solid #1a1a1a',
    },
    input: {
      flex: 1,
      background: '#151515',
      border: '1px solid #1e1e1e',
      borderRadius: 5,
      padding: '7px 12px',
      fontSize: 13,
      color: '#d0d0d0',
      outline: 'none',
    },
    sendBtn: {
      padding: '7px 16px',
      background: '#1e2a3a',
      border: '1px solid #2a3f5a',
      borderRadius: 5,
      color: '#8b6fde',
      fontSize: 12,
      cursor: 'pointer',
    },
  };

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.icon}>◈</span>
        <span style={styles.title}>{title}</span>
        <span style={styles.badge}>butler</span>
      </div>

      <div style={styles.messages} aria-label="Chat messages" aria-live="polite">
        {messages.length === 0 && (
          <div style={{ color: '#2a2a2a', fontStyle: 'italic', fontSize: 12 }}>
            Send a message to start.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={m.role === 'user' ? styles.msgUser : styles.msgBot}>
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={input}
          placeholder="Type a message..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          aria-label="Message input"
        />
        <button style={styles.sendBtn} onClick={send} aria-label="Send">
          Send
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// APP DEFINITION
// ============================================================================

export const ButlerApp: WorkbenchApp = {
  id: 'butler',
  name: 'Butler',
  icon: '◈',
  capabilities: [],

  async createWorkspace(): Promise<WorkbenchWorkspace> {
    const id = uuidv4();
    const title = 'Butler Chat';

    return {
      id,
      appId: 'butler',
      title,
      state: {},
      render() {
        return <ButlerPanel title={title} />;
      },
      onMount() {},
      onDispose() {},
    };
  },
};
