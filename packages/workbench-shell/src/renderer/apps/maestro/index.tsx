/**
 * Maestro App — stub that validates the workspace architecture.
 *
 * Domain: Tool execution (code + shell runner sessions)
 * Phase 1: Renders a stub panel. No actual tool integration yet.
 * Phase 6: Receives WorkbenchRuntimeContext and calls runTool().
 */

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WorkbenchApp, WorkbenchWorkspace } from '../../../types';
import { useRuntime } from '../../../runtime/runtimeContext';

// ============================================================================
// WORKSPACE RENDER
// ============================================================================

function MaestroPanel({ title }: { title: string }): React.ReactElement {
  const [log, setLog] = React.useState<string[]>([]);
  const [running, setRunning] = React.useState(false);
  const runtime = useRuntime();

  async function handleRun() {
    setRunning(true);
    const ts = new Date().toLocaleTimeString();
    setLog((prev) => [...prev, `[${ts}] Running tool — echo...`]);
    try {
      const result = await runtime.runTool({ name: 'echo', payload: 'hello from maestro' });
      const out = JSON.stringify(result);
      setLog((prev) => [...prev, `[${ts}] Done: ${out}`]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLog((prev) => [...prev, `[${ts}] Error: ${msg}`]);
    } finally {
      setRunning(false);
    }
  }

  const styles: Record<string, React.CSSProperties> = {
    root: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: 24,
      gap: 16,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    icon: {
      fontSize: 18,
      color: '#4d9fff',
    },
    title: {
      fontSize: 16,
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
    editor: {
      flex: 1,
      background: '#151515',
      border: '1px solid #1e1e1e',
      borderRadius: 6,
      padding: 14,
      fontFamily: 'monospace',
      fontSize: 12,
      color: '#558',
      overflow: 'auto',
    },
    log: {
      height: 120,
      background: '#0d0d0d',
      border: '1px solid #1a1a1a',
      borderRadius: 6,
      overflow: 'auto',
      padding: 10,
      fontFamily: 'monospace',
      fontSize: 11,
      color: '#555',
    },
    runBtn: {
      alignSelf: 'flex-start',
      padding: '7px 18px',
      background: '#1e2a3a',
      border: '1px solid #2a3f5a',
      borderRadius: 5,
      color: '#4d9fff',
      fontSize: 12,
      cursor: 'pointer',
    },
  };

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.icon}>⌘</span>
        <span style={styles.title}>{title}</span>
        <span style={styles.badge}>maestro</span>
      </div>

      <div style={styles.editor}>
        {/* Phase 6: Replace with actual tool editor */}
        <span style={{ color: '#333' }}>// Tool editor — Phase 6</span>
      </div>

      <button style={styles.runBtn} onClick={handleRun} disabled={running}>
        {running ? 'Running…' : 'Run Tool'}
      </button>

      <div style={styles.log} aria-label="Execution log" aria-live="polite">
        {log.length === 0
          ? <span style={{ color: '#222' }}>No executions yet.</span>
          : log.map((line, i) => <div key={i}>{line}</div>)
        }
      </div>
    </div>
  );
}

// ============================================================================
// APP DEFINITION
// ============================================================================

export const MaestroApp: WorkbenchApp = {
  id: 'maestro',
  name: 'Maestro',
  icon: '⌘',
  capabilities: ['runTool', 'subscribeToEvents'],

  async createWorkspace(): Promise<WorkbenchWorkspace> {
    const id = uuidv4();
    const title = 'Maestro Session';

    return {
      id,
      appId: 'maestro',
      title,
      state: {},
      render() {
        return <MaestroPanel title={title} />;
      },
      onMount() {
        // Phase 6: subscribe to runtime events
      },
      onDispose() {
        // Phase 6: unsubscribe
      },
    };
  },
};
