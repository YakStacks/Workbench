/**
 * BenchPanel — Pegboard Tool Status UI (Anti-Bloat Transparency).
 *
 * Shows three lists:
 *   COLD  — tools installed but not loaded (near-zero resources)
 *   WARM  — tools loaded and idle (TTL countdown shown)
 *   HOT   — tools actively running (timer + stop button)
 *
 * Also shows:
 *   - Hot slots used: "N / maxHotTools"
 *   - Queue depth and queued tool names
 *   - "Stop All Hot Tools" safety button
 *   - Per-tool pin/unpin for session tools
 *
 * Reads entirely from useToolStore — no direct runtime coupling.
 * Renders nothing when no tools are registered.
 *
 * Spec reference: Pegboard Tools spec — UI Requirements (Anti-Bloat Transparency)
 */

import React from 'react';
import { useToolStore } from '../tools/toolStore';
import type { ToolRecord, RunRecord } from '../tools/toolStore';

// ============================================================================
// STYLES
// ============================================================================

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflowY: 'auto',
    padding: '16px 20px',
    gap: 20,
    fontSize: 12,
    color: '#888',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderBottom: '1px solid #1a1a1a',
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#555',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    flex: 1,
  },
  slotsBadge: {
    fontSize: 10,
    color: '#444',
    background: '#111',
    border: '1px solid #1a1a1a',
    borderRadius: 4,
    padding: '2px 8px',
    fontFamily: 'monospace',
  },
  slotsOver: {
    color: '#cf6679',
    borderColor: '#3a1a1a',
    background: '#1f0a0a',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    marginBottom: 2,
  },
  cold: { color: '#333' },
  warm: { color: '#8b6f00' },
  hot:  { color: '#4d9fff' },
  toolRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 8px',
    background: '#111',
    border: '1px solid #1a1a1a',
    borderRadius: 6,
  },
  toolName: {
    flex: 1,
    color: '#b0b0b0',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  toolKind: {
    fontSize: 9,
    color: '#333',
    border: '1px solid #1e1e1e',
    borderRadius: 3,
    padding: '1px 4px',
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  ttlText: {
    fontSize: 10,
    color: '#444',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  btn: {
    padding: '3px 8px',
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 4,
    color: '#666',
    fontSize: 10,
    cursor: 'pointer',
    transition: 'color 0.1s',
    flexShrink: 0,
    userSelect: 'none',
  },
  btnPrimary: {
    color: '#4d9fff',
    borderColor: '#1e3050',
    background: '#0d1a2a',
  },
  btnDanger: {
    color: '#cf6679',
    borderColor: '#3a1a1a',
    background: '#1f0a0a',
  },
  stopAllBtn: {
    width: '100%',
    padding: '7px 12px',
    background: '#1f0a0a',
    border: '1px solid #5a2a2a',
    borderRadius: 6,
    color: '#ff6b6b',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontSize: 11,
    color: '#282828',
    fontStyle: 'italic',
  },
  queueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    background: '#0f0f0f',
    border: '1px solid #1a1a1a',
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#555',
  },
  runTimer: {
    fontSize: 10,
    color: '#4d9fff',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function stateDotColor(state: ToolRecord['state']): string {
  switch (state) {
    case 'COLD': return '#2a2a2a';
    case 'WARM': return '#8b6f00';
    case 'HOT':  return '#4d9fff';
    default:     return '#333';
  }
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = React.useState(Date.now);
  React.useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(h);
  }, [intervalMs]);
  return now;
}

function formatMs(ms: number): string {
  if (ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ColdToolRow({ rec }: { rec: ToolRecord }) {
  const { mount } = useToolStore();
  return (
    <div style={s.toolRow}>
      <div style={{ ...s.stateDot, background: stateDotColor('COLD') }} />
      <span style={s.toolName}>{rec.manifest.name}</span>
      <span style={s.toolKind}>{rec.manifest.kind}</span>
      <button
        style={s.btn}
        type="button"
        onClick={() => mount(rec.manifest.id)}
        title="Load tool module (COLD → WARM)"
      >
        Load
      </button>
    </div>
  );
}

function WarmToolRow({ rec, now }: { rec: ToolRecord; now: number }) {
  const { unmount, pin, unpin } = useToolStore();
  const id = rec.manifest.id;
  const ttlMs = rec.manifest.lifecycle.warmTtlMs;
  const elapsed = rec.warmSince ? now - rec.warmSince : 0;
  const remaining = Math.max(0, ttlMs - elapsed);

  return (
    <div style={s.toolRow}>
      <div style={{ ...s.stateDot, background: stateDotColor('WARM') }} />
      <span style={s.toolName}>{rec.manifest.name}</span>
      <span style={s.toolKind}>{rec.manifest.kind}</span>
      {rec.pinned ? (
        <span style={{ ...s.ttlText, color: '#4d9fff' }}>pinned</span>
      ) : (
        <span style={s.ttlText} title="Time until auto-unload">{formatMs(remaining)}</span>
      )}
      {rec.manifest.kind === 'session' && (
        <button
          style={rec.pinned ? { ...s.btn, ...s.btnPrimary } : s.btn}
          type="button"
          onClick={() => rec.pinned ? unpin(id) : pin(id)}
          title={rec.pinned ? 'Unpin session (enable auto-unload)' : 'Pin session (disable auto-unload)'}
        >
          {rec.pinned ? '📌 Pinned' : '📍 Pin'}
        </button>
      )}
      <button
        style={s.btn}
        type="button"
        onClick={() => unmount(id)}
        title="Unload tool (WARM → COLD)"
      >
        Unload
      </button>
    </div>
  );
}

function HotToolRow({ rec, runs, onStop }: {
  rec: ToolRecord;
  runs: RunRecord[];
  onStop: (runId: string) => void;
}) {
  const now = useNow(500);
  const activeRuns = runs.filter(
    (r) => r.toolId === rec.manifest.id && r.status === 'RUNNING'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={s.toolRow}>
        <div style={{ ...s.stateDot, background: stateDotColor('HOT') }} />
        <span style={s.toolName}>{rec.manifest.name}</span>
        <span style={s.toolKind}>{rec.manifest.kind}</span>
        {activeRuns.map((run) => {
          const elapsed = run.startedAt ? now - run.startedAt : 0;
          return (
            <React.Fragment key={run.runId}>
              <span style={s.runTimer}>{formatMs(elapsed)}</span>
              <button
                style={{ ...s.btn, ...s.btnDanger }}
                type="button"
                onClick={() => onStop(run.runId)}
                title="Stop this run"
              >
                ✕ Stop
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BenchPanel(): React.ReactElement {
  const {
    tools,
    runs,
    budgets,
    _queue,
    cancelRun,
    stopAllHot,
  } = useToolStore();

  const now = useNow();

  const allTools = Object.values(tools);
  const coldTools = allTools.filter((t) => t.state === 'COLD');
  const warmTools = allTools.filter((t) => t.state === 'WARM');
  const hotTools  = allTools.filter((t) => t.state === 'HOT');

  const hotCount = hotTools.length;
  const isOverBudget = hotCount >= budgets.maxHotTools;

  return (
    <div style={s.root} aria-label="Bench status panel">

      {/* ── Header: slot usage ───────────────────────────────────────────── */}
      <div style={s.header}>
        <span style={s.headerTitle}>Bench</span>
        <span style={{
          ...s.slotsBadge,
          ...(isOverBudget ? s.slotsOver : {}),
        }}>
          {hotCount} / {budgets.maxHotTools} hot slots
        </span>
      </div>

      {/* ── HOT ─────────────────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={{ ...s.sectionLabel, ...s.hot }}>
          🔥 Hot ({hotTools.length})
        </div>
        {hotTools.length === 0 ? (
          <div style={s.emptyHint}>No tools running.</div>
        ) : (
          hotTools.map((rec) => (
            <HotToolRow
              key={rec.manifest.id}
              rec={rec}
              runs={runs}
              onStop={cancelRun}
            />
          ))
        )}
      </div>

      {/* ── Queue ────────────────────────────────────────────────────────── */}
      {_queue.length > 0 && (
        <div style={s.section}>
          <div style={{ ...s.sectionLabel, color: '#8b4f00' }}>
            ⏳ Queued ({_queue.length})
          </div>
          {_queue.map((q, i) => {
            const manifest = tools[q.toolId]?.manifest;
            return (
              <div key={q.runId} style={s.queueRow}>
                <span style={{ color: '#333' }}>#{i + 1}</span>
                <span style={{ flex: 1, color: '#666' }}>
                  {manifest?.name ?? q.toolId}
                </span>
                <button
                  style={{ ...s.btn, ...s.btnDanger }}
                  type="button"
                  onClick={() => cancelRun(q.runId)}
                  title="Remove from queue"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── WARM ────────────────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={{ ...s.sectionLabel, ...s.warm }}>
          ♨ Warm ({warmTools.length})
        </div>
        {warmTools.length === 0 ? (
          <div style={s.emptyHint}>No tools loaded.</div>
        ) : (
          warmTools.map((rec) => (
            <WarmToolRow key={rec.manifest.id} rec={rec} now={now} />
          ))
        )}
      </div>

      {/* ── COLD ─────────────────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={{ ...s.sectionLabel, ...s.cold }}>
          ❄ Cold ({coldTools.length})
        </div>
        {coldTools.length === 0 ? (
          <div style={s.emptyHint}>All tools loaded.</div>
        ) : (
          coldTools.map((rec) => (
            <ColdToolRow key={rec.manifest.id} rec={rec} />
          ))
        )}
      </div>

      {/* ── Stop All ─────────────────────────────────────────────────────── */}
      {hotTools.length > 0 && (
        <button
          style={s.stopAllBtn}
          type="button"
          onClick={stopAllHot}
          aria-label="Stop all hot tools"
        >
          ⬛ Stop All Hot Tools
        </button>
      )}

    </div>
  );
}
