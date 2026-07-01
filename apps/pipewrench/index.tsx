/**
 * @workbench-apps/pipewrench
 *
 * Pipewrench — system probe and rule runner.
 *
 * Domain: Environment analysis (runs probes, evaluates rules, surfaces findings)
 * Phase 8: Full stub. Renders probe control panel + uses runTool for probe execution.
 *
 * This file is the canonical entry-point for the Pipewrench app.
 * It lives at /apps/pipewrench/ so the Shell can load it dynamically in a future phase.
 */

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WorkbenchApp, WorkbenchWorkspace } from '@workbench/shell/types';
import { useRuntime } from '@workbench/shell/runtime';

// ============================================================================
// LOCAL TYPES
// ============================================================================

type ProbeStatus = 'idle' | 'running' | 'pass' | 'warn' | 'fail';

interface ProbeResult {
  id: string;
  name: string;
  status: ProbeStatus;
  detail: string;
  ts: string;
}

// ============================================================================
// PROBE PANEL
// ============================================================================

function PipewrenchPanel({ title }: { title: string }): React.ReactElement {
  const runtime = useRuntime();
  const [results, setResults] = React.useState<ProbeResult[]>([]);
  const [running, setRunning] = React.useState(false);

  const PROBE_NAMES = [
    'node-version',
    'electron-version',
    'disk-space',
    'memory-headroom',
    'plugin-integrity',
  ] as const;

  async function handleRunProbes() {
    setRunning(true);
    setResults([]);

    for (const probe of PROBE_NAMES) {
      const ts = new Date().toLocaleTimeString();
      // Optimistic: show running
      setResults((prev) => [
        ...prev,
        { id: uuidv4(), name: probe, status: 'running', detail: 'Probing…', ts },
      ]);

      try {
        const raw = await runtime.runTool({ toolName: 'pipewrench', input: { probe } });
        const detail = raw != null ? JSON.stringify(raw) : 'ok';
        setResults((prev) =>
          prev.map((r) =>
            r.name === probe && r.status === 'running'
              ? { ...r, status: 'pass', detail }
              : r,
          ),
        );
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setResults((prev) =>
          prev.map((r) =>
            r.name === probe && r.status === 'running'
              ? { ...r, status: 'fail', detail }
              : r,
          ),
        );
      }
    }

    setRunning(false);
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  function badgeStyle(status: ProbeStatus): React.CSSProperties {
    const bg =
      status === 'pass' ? '#22c55e'
      : status === 'fail' ? '#ef4444'
      : status === 'warn' ? '#f59e0b'
      : status === 'running' ? '#3b82f6'
      : '#d1d5db';
    return {
      minWidth: 48,
      textAlign: 'center',
      padding: '2px 6px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 700,
      color: '#fff',
      backgroundColor: bg,
    };
  }

  const s: Record<string, React.CSSProperties> = {
    root: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: 24,
      gap: 16,
      fontFamily: 'system-ui, sans-serif',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    icon: {
      fontSize: 22,
      lineHeight: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: 600,
      color: '#1a1a2e',
    },
    subtitle: {
      fontSize: 12,
      color: '#555',
      marginTop: 2,
    },
    toolbar: {
      display: 'flex',
      gap: 8,
    },
    runBtn: {
      padding: '6px 16px',
      backgroundColor: running ? '#ccc' : '#1a1a2e',
      color: running ? '#888' : '#fff',
      border: 'none',
      borderRadius: 6,
      fontSize: 13,
      cursor: running ? 'not-allowed' : 'pointer',
      fontWeight: 500,
    },
    clearBtn: {
      padding: '6px 12px',
      backgroundColor: 'transparent',
      color: '#888',
      border: '1px solid #ddd',
      borderRadius: 6,
      fontSize: 13,
      cursor: 'pointer',
    },
    results: {
      flex: 1,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    },
    emptyHint: {
      color: '#aaa',
      fontSize: 12,
      fontStyle: 'italic',
    },
    row: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '8px 10px',
      borderRadius: 6,
      border: '1px solid #e8e8e8',
      backgroundColor: '#fafafa',
      fontSize: 12,
    },
    probeName: {
      fontWeight: 600,
      color: '#1a1a2e',
      minWidth: 140,
    },
    detail: {
      color: '#555',
      wordBreak: 'break-all' as const,
      flex: 1,
    },
    ts: {
      marginLeft: 'auto',
      color: '#aaa',
      whiteSpace: 'nowrap',
    },
  };

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.icon} aria-hidden>🔧</span>
        <div>
          <div style={s.title}>{title}</div>
          <div style={s.subtitle}>Run system probes and surface environment findings</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <button
          style={s.runBtn}
          disabled={running}
          onClick={handleRunProbes}
          aria-label="Run all probes"
        >
          {running ? 'Running…' : 'Run Probes'}
        </button>
        <button
          style={s.clearBtn}
          onClick={() => setResults([])}
          aria-label="Clear results"
        >
          Clear
        </button>
      </div>

      {/* Results */}
      <div style={s.results} aria-label="Probe results" aria-live="polite">
        {results.length === 0 ? (
          <span style={s.emptyHint}>No probes run yet. Press "Run Probes" to start.</span>
        ) : (
          results.map((r) => (
            <div key={r.id} style={s.row}>
              <span style={badgeStyle(r.status)}>{r.status.toUpperCase()}</span>
              <span style={s.probeName}>{r.name}</span>
              <span style={s.detail}>{r.detail}</span>
              <span style={s.ts}>{r.ts}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// APP DEFINITION
// ============================================================================

export const PipewrenchApp: WorkbenchApp = {
  id: 'pipewrench',
  name: 'Pipewrench',
  icon: '🔧',
  capabilities: ['runTool'],

  async createWorkspace(): Promise<WorkbenchWorkspace> {
    const id = uuidv4();
    const title = 'Pipewrench Probes';

    return {
      id,
      appId: 'pipewrench',
      title,
      state: {},
      render() {
        return <PipewrenchPanel title={title} />;
      },
      onMount() {},
      onDispose() {},
    };
  },
};

export default PipewrenchApp;
