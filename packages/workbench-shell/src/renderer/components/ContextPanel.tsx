/**
 * ContextPanel — Workspace Context Controls (Phase M).
 *
 * Displayed in the 4th inner tab ("Context") of WorkspaceTabsPanel.
 *
 * Sections:
 *   1. Summary — textarea + "Generate Summary" button (M8).
 *      LLM-generated 5-8 bullet summary from last ~20 messages.
 *      Falls back to deterministic summary if no LLM configured.
 *
 *   2. Settings — toggles for includeSummary / includePinned + token budget input.
 *
 *   3. Pinned Messages — list of pinned messageIds with unpin buttons.
 *      (Shows truncated preview from chatStore message content.)
 *
 *   4. Reset Context — clears all context state for this workspace.
 *
 * No `any`.
 */

import React from 'react';
import { useContextStore } from '../state/contextStore';
import { useChatStore } from '../state/chatStore';
import { getClient, getActiveModel } from '../llm/getClient';
import { useSettingsStore } from '../state/settingsStore';
import type { UserMessage, AssistantMessage } from '../types/chat';

// ============================================================================
// TYPES
// ============================================================================

interface ContextPanelProps {
  workspaceId: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Rough token estimate: 1 token ≈ 4 characters. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

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
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: '#555',
    paddingBottom: 4,
    borderBottom: '1px solid #1a1a1a',
  },
  textarea: {
    background: '#111',
    border: '1px solid #1e1e1e',
    borderRadius: 6,
    color: '#b0b0b0',
    fontSize: 12,
    fontFamily: 'inherit',
    padding: '8px 10px',
    resize: 'vertical' as const,
    minHeight: 80,
    lineHeight: 1.5,
    outline: 'none',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: '#888',
    flex: 1,
  },
  toggle: {
    cursor: 'pointer',
    accentColor: '#4d9fff',
  },
  tokenInput: {
    width: 70,
    background: '#111',
    border: '1px solid #1e1e1e',
    borderRadius: 4,
    color: '#b0b0b0',
    fontSize: 12,
    padding: '3px 6px',
    textAlign: 'right' as const,
  },
  btn: {
    padding: '6px 12px',
    background: '#1a2030',
    border: '1px solid #2a3f5a',
    borderRadius: 6,
    color: '#4d9fff',
    fontSize: 11,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.1s',
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
  btnDanger: {
    background: '#1f0a0a',
    border: '1px solid #3a1a1a',
    color: '#cf6679',
  },
  pinnedItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '6px 8px',
    background: '#111',
    border: '1px solid #1a1a1a',
    borderRadius: 6,
    fontSize: 11,
    color: '#777',
  },
  pinnedPreview: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    fontFamily: 'monospace',
  },
  emptyHint: {
    fontSize: 11,
    color: '#333',
    fontStyle: 'italic',
  },
  tokenBadge: {
    fontSize: 10,
    color: '#444',
    marginLeft: 'auto',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ContextPanel({ workspaceId }: ContextPanelProps): React.ReactElement {
  const {
    getContext,
    setSummary,
    togglePin,
    resetContext,
    setSettings,
  } = useContextStore();
  const { getMessages } = useChatStore();

  const ctx = useContextStore((s_) => s_.contextByWorkspaceId[workspaceId]);
  const messages = getMessages(workspaceId);

  // ── Resolved context (fallback to default if not yet in store) ───────────
  const ctxResolved = ctx ?? getContext(workspaceId);
  const { summary, pinnedMessageIds, settings } = ctxResolved;

  // ── Generate Summary state ────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = React.useState(false);
  const generateAbortRef = React.useRef<AbortController | null>(null);

  // ── Summary estimated tokens ──────────────────────────────────────────────
  const summaryTokens = estimateTokens(summary);

  // ── Generate Summary handler (M8) ─────────────────────────────────────────
  async function handleGenerateSummary() {
    if (isGenerating) {
      // Cancel in-flight generation
      generateAbortRef.current?.abort();
      generateAbortRef.current = null;
      setIsGenerating(false);
      return;
    }

    const llmProvider = useSettingsStore.getState().llmProvider;

    // Collect last ~20 user+assistant messages
    const relevant = messages
      .filter((m): m is UserMessage | AssistantMessage =>
        m.role === 'user' || m.role === 'assistant'
      )
      .slice(-20);

    if (relevant.length === 0) {
      setSummary(workspaceId, '• No conversation messages yet.');
      return;
    }

    // Fallback: deterministic summary if no LLM configured
    if (llmProvider === 'mock') {
      const lines = relevant
        .slice(-8)
        .map((m) => {
          const prefix = m.role === 'user' ? 'User' : 'Assistant';
          const snippet = m.content.slice(0, 80).replace(/\n/g, ' ');
          return `• ${prefix}: ${snippet}${m.content.length > 80 ? '…' : ''}`;
        });
      setSummary(workspaceId, lines.join('\n'));
      return;
    }

    // LLM-based summary
    setIsGenerating(true);
    const controller = new AbortController();
    generateAbortRef.current = controller;

    const transcript = relevant
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const prompt = [
      {
        role: 'system' as const,
        content: 'Summarize the conversation in 5-8 concise bullet points. Each bullet should start with "• ". Be brief.',
      },
      {
        role: 'user' as const,
        content: transcript,
      },
    ];

    const settings_ = useSettingsStore.getState();
    const client = getClient();
    const model = getActiveModel();

    let fullContent = '';

    try {
      const gen = client.generate({
        messages: prompt,
        model,
        temperature: 0.3,
        maxTokens: 512,
        stream: settings_.stream,
        signal: controller.signal,
      });

      for await (const chunk of gen) {
        if (controller.signal.aborted) break;
        if (chunk.delta) fullContent += chunk.delta;
        if (chunk.done) break;
      }

      if (fullContent) {
        setSummary(workspaceId, fullContent.trim());
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : String(err);
        setSummary(workspaceId, `• Summary generation failed: ${msg}`);
      }
    } finally {
      generateAbortRef.current = null;
      setIsGenerating(false);
    }
  }

  // ── Pinned message preview lookup ─────────────────────────────────────────
  function getPinnedPreview(messageId: string): string {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return messageId;
    if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
      return msg.content.slice(0, 60) + (msg.content.length > 60 ? '…' : '');
    }
    if (msg.role === 'tool') return `[tool: ${msg.toolName}]`;
    return messageId;
  }

  return (
    <div style={s.root} aria-label="Context panel">

      {/* ── 1. Summary ─────────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Summary</div>
        <textarea
          style={s.textarea}
          value={summary}
          placeholder="No summary yet. Edit manually or click Generate Summary."
          onChange={(e) => setSummary(workspaceId, e.target.value)}
          rows={5}
          aria-label="Workspace summary"
        />
        <div style={s.row}>
          <span style={s.tokenBadge}>~{summaryTokens} tokens</span>
          <button
            type="button"
            style={{
              ...s.btn,
              ...(isGenerating ? {} : {}),
            }}
            onClick={handleGenerateSummary}
            aria-label={isGenerating ? 'Stop generating summary' : 'Generate summary'}
          >
            {isGenerating ? '✕ Stop' : '✦ Generate Summary'}
          </button>
        </div>
      </div>

      {/* ── 2. Settings ────────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>LLM Context Settings</div>

        <div style={s.row}>
          <label style={s.label} htmlFor={`ctx-summary-${workspaceId}`}>
            Include summary
          </label>
          <input
            id={`ctx-summary-${workspaceId}`}
            type="checkbox"
            style={s.toggle}
            checked={settings.includeSummary}
            onChange={(e) => setSettings(workspaceId, { includeSummary: e.target.checked })}
          />
        </div>

        <div style={s.row}>
          <label style={s.label} htmlFor={`ctx-pinned-${workspaceId}`}>
            Include pinned messages
          </label>
          <input
            id={`ctx-pinned-${workspaceId}`}
            type="checkbox"
            style={s.toggle}
            checked={settings.includePinned}
            onChange={(e) => setSettings(workspaceId, { includePinned: e.target.checked })}
          />
        </div>

        <div style={s.row}>
          <label style={s.label} htmlFor={`ctx-tokens-${workspaceId}`}>
            Token budget
          </label>
          <input
            id={`ctx-tokens-${workspaceId}`}
            type="number"
            style={s.tokenInput}
            value={settings.maxContextTokens}
            min={500}
            max={32000}
            step={100}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 100) {
                setSettings(workspaceId, { maxContextTokens: v });
              }
            }}
            aria-label="Token budget"
          />
        </div>
      </div>

      {/* ── 3. Pinned Messages ─────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Pinned Messages ({pinnedMessageIds.length})</div>

        {pinnedMessageIds.length === 0 ? (
          <div style={s.emptyHint}>No pinned messages. Pin messages in the chat timeline.</div>
        ) : (
          pinnedMessageIds.map((msgId) => (
            <div key={msgId} style={s.pinnedItem}>
              <span style={s.pinnedPreview}>{getPinnedPreview(msgId)}</span>
              <button
                type="button"
                style={{ ...s.btn, padding: '2px 7px', fontSize: 10 }}
                onClick={() => togglePin(workspaceId, msgId)}
                aria-label="Unpin message"
                title="Unpin"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── 4. Reset Context ──────────────────────────────────────────── */}
      <div style={s.section}>
        <button
          type="button"
          style={{ ...s.btn, ...s.btnDanger }}
          onClick={() => resetContext(workspaceId)}
          aria-label="Reset context"
        >
          ↺ Reset Context
        </button>
      </div>

    </div>
  );
}
