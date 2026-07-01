/**
 * ButlerChatView — the chat-first workspace view for Butler.
 *
 * Reads messages from chatStore (keyed by workspaceId).
 * Renders ChatTimeline + ChatComposer + optional Stop button.
 *
 * Phase B1 — slash commands:
 * - /doctor  → runtime.runDoctor(workspaceId)
 * - /tool <name> [json]  → runtime.runTool({ toolName, input, workspaceId })
 * - /help    → assistant message listing commands
 *
 * Phase H — LLM integration:
 * - Normal text → sent to LLM via getClient()
 * - Streams response token-by-token into assistant message bubble
 * - Stop button (✕) visible while generating, calls abort()
 *
 * Phase L — Suggestion Chips (click-to-run):
 * - After LLM finishes, generateSuggestions() is called.
 * - Suggestions attached to the assistant message via updateAssistantMessage.
 * - No auto-execution.
 *
 * Phase L+1 — Dismiss Suggestions:
 * - handleDismissSuggestions clears suggestions via updateAssistantMessage.
 *
 * Phase L+2 — requiresConfirm:
 * - Confirm modal shown for chips with requiresConfirm=true.
 *
 * Phase L+3 — Runtime-aware suggestions:
 * - generateSuggestions receives last 10 ToolMessages for enrichment.
 *
 * Phase M7 — buildLLMContext integration:
 * - Uses buildLLMContext() instead of ad-hoc buildLLMMessages().
 * - System primer: "You are Butler inside Workbench. Be concise. Suggest tools
 *   as clickable suggestions; never run tools automatically."
 * - Shows approx token count badge in header.
 *
 * Phase M5 — Pin / Include callbacks:
 * - Passes onTogglePin and onToggleInclude to ChatTimeline.
 * - Reads pinnedIds and includedIds from contextStore.
 *
 * Tool blocks are NOT created manually here.
 * They appear via RuntimeBridge → chatStore.ingestRuntimeEvent().
 *
 * No Core imports. No timeout simulations.
 */

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatTimeline } from '../../components/ChatTimeline';
import { ChatComposer } from '../../components/ChatComposer';
import { useChatStore } from '../../state/chatStore';
import { useSettingsStore } from '../../state/settingsStore';
import { useShellStore } from '../../state/shellStore';
import { usePaletteStore } from '../../state/paletteStore';
import { useContextStore } from '../../state/contextStore';
import { useRuntime } from '../../../runtime/runtimeContext';
import { parseCommand } from '../../utils/commandParser';
import { getClient, getActiveModel } from '../../llm/getClient';
import { buildLLMContext } from '../../llm/buildContext';
import { generateSuggestions } from '../../suggestions/generateSuggestions';
import type { AssistantMessage, SystemMessage, UserMessage, ChatMessage, ToolMessage } from '../../types/chat';
import type { Suggestion } from '../../types/suggestions';

// ============================================================================
// CONSTANTS
// ============================================================================

const SYSTEM_PRIMER =
  'You are Butler inside Workbench. Be concise. ' +
  'Suggest tools as clickable suggestions; never run tools automatically.';

const HELP_TEXT = `Available commands:
  /doctor             — run workspace diagnostics
  /tool <name> [json] — run a named tool with optional JSON input
  /help               — show this message

Examples:
  /doctor
  /tool echo {"message":"hello"}
  /tool pipewrench {"probe":"network"}`;

// ============================================================================
// HELPERS
// ============================================================================

/** Get the last N ToolMessages for a workspace (L+3 runtime enrichment). */
function getLastToolMessages(messages: ChatMessage[], n: number): ToolMessage[] {
  return messages
    .filter((m): m is ToolMessage => m.role === 'tool')
    .slice(-n);
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '10px 20px',
    borderBottom: '1px solid #1a1a1a',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  icon: {
    fontSize: 15,
    color: '#8b6fde',
  },
  titleText: {
    fontSize: 13,
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
  tokenBadge: {
    fontSize: 10,
    color: '#333',
    background: '#111',
    border: '1px solid #1a1a1a',
    borderRadius: 4,
    padding: '2px 6px',
    marginLeft: 'auto',
    fontFamily: 'monospace',
  },
  providerBadge: {
    fontSize: 10,
    color: '#444',
    fontFamily: 'monospace',
  },
  stopButton: {
    padding: '6px 14px',
    background: '#3a1a1a',
    border: '1px solid #5a2a2a',
    borderRadius: 6,
    color: '#ff6b6b',
    fontSize: 12,
    cursor: 'pointer',
    flexShrink: 0,
    alignSelf: 'center',
    margin: '6px 20px',
  },
  // L+2 confirm modal
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9000,
  },
  modalBox: {
    background: '#181818',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: '20px 24px',
    minWidth: 280,
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  modalTitle: {
    fontSize: 13,
    color: '#c0c0c0',
    fontWeight: 500,
  },
  modalActions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalCancel: {
    padding: '6px 14px',
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#666',
    fontSize: 12,
    cursor: 'pointer',
  },
  modalConfirm: {
    padding: '6px 14px',
    background: '#1a2030',
    border: '1px solid #2a3f5a',
    borderRadius: 6,
    color: '#4d9fff',
    fontSize: 12,
    cursor: 'pointer',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

interface ButlerChatViewProps {
  workspaceId: string;
  title: string;
}

export function ButlerChatView({ workspaceId, title }: ButlerChatViewProps): React.ReactElement {
  const { getMessages, appendMessage, updateAssistantMessage } = useChatStore();
  const runtime = useRuntime();
  const messages = getMessages(workspaceId);

  // LLM streaming state
  const [isGenerating, setIsGenerating] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Token count badge — updated after each LLM call prep
  const [approxTokens, setApproxTokens] = React.useState(0);

  // L+2 confirm modal
  const [pendingConfirm, setPendingConfirm] = React.useState<Suggestion | null>(null);

  const llmProvider = useSettingsStore((s) => s.llmProvider);

  // M5 — context store for pin/include state
  const ctx = useContextStore((s) => s.contextByWorkspaceId[workspaceId]);
  const { togglePin, setIncludeMessage, ensure } = useContextStore();

  // Ensure context entry exists for this workspace
  React.useEffect(() => {
    ensure(workspaceId);
  }, [workspaceId, ensure]);

  const pinnedIds = React.useMemo(
    () => new Set(ctx?.pinnedMessageIds ?? []),
    [ctx?.pinnedMessageIds]
  );
  const includedIds = React.useMemo(
    () => new Set(ctx?.includeMessageIds ?? []),
    [ctx?.includeMessageIds]
  );

  // ── Stop handler ──────────────────────────────────────────────────────────
  function handleStop() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }

  // ── L+1: Dismiss suggestions ──────────────────────────────────────────────
  function handleDismissSuggestions(messageId: string) {
    updateAssistantMessage(workspaceId, messageId, { suggestions: [] });
  }

  // ── M5: Pin / Include handlers ────────────────────────────────────────────
  function handleTogglePin(messageId: string) {
    togglePin(workspaceId, messageId);
  }

  function handleToggleInclude(messageId: string, include: boolean) {
    setIncludeMessage(workspaceId, messageId, include);
  }

  // ── Attach suggestions ────────────────────────────────────────────────────
  function attachSuggestions(opts: {
    assistantId: string;
    userText: string;
    assistantText: string;
    isSlashCommand: boolean;
  }) {
    if (opts.isSlashCommand) return;
    if (!opts.assistantText) return;

    const allMessages = getMessages(workspaceId);
    const lastToolMessages = getLastToolMessages(allMessages, 10);

    const suggestions = generateSuggestions({
      userText: opts.userText,
      assistantText: opts.assistantText,
      workspaceId,
      lastToolMessages,
    });

    if (suggestions.length > 0) {
      updateAssistantMessage(workspaceId, opts.assistantId, { suggestions });
    }
  }

  // ── L+2: Execute a suggestion ─────────────────────────────────────────────
  function executeSuggestion(suggestion: Suggestion) {
    switch (suggestion.kind) {
      case 'runDoctor': {
        if (!runtime) {
          appendMessage({
            id: uuidv4(), workspaceId, role: 'system',
            content: 'Runtime not available in this mode.',
            createdAt: Date.now(),
          });
          return;
        }
        runtime.runDoctor(workspaceId).catch((err: unknown) => {
          console.warn('[ButlerChatView] runDoctor from suggestion failed:', err);
        });
        break;
      }
      case 'runTool': {
        if (!runtime || !suggestion.toolName) {
          appendMessage({
            id: uuidv4(), workspaceId, role: 'system',
            content: suggestion.toolName
              ? 'Runtime not available in this mode.'
              : 'No tool name specified in suggestion.',
            createdAt: Date.now(),
          });
          return;
        }
        runtime.runTool({
          toolName: suggestion.toolName,
          input: suggestion.input,
          workspaceId,
        }).catch((err: unknown) => {
          console.warn('[ButlerChatView] runTool from suggestion failed:', err);
        });
        break;
      }
      case 'openPane': {
        if (suggestion.pane) {
          useShellStore.getState().setWorkspacePane(workspaceId, suggestion.pane);
        }
        break;
      }
      case 'openCommandPalette': {
        usePaletteStore.getState().open();
        break;
      }
    }
  }

  function handlePickSuggestion(suggestion: Suggestion) {
    if (suggestion.requiresConfirm) {
      setPendingConfirm(suggestion);
    } else {
      executeSuggestion(suggestion);
    }
  }

  function handleConfirmRun() {
    if (pendingConfirm) executeSuggestion(pendingConfirm);
    setPendingConfirm(null);
  }

  function handleConfirmCancel() {
    setPendingConfirm(null);
  }

  // ── LLM pipeline ──────────────────────────────────────────────────────────
  async function runLLM(userMsg: UserMessage) {
    const now = Date.now();

    const assistantId = uuidv4();
    const assistantMsg: AssistantMessage = {
      id: assistantId,
      workspaceId,
      role: 'assistant',
      content: '',
      createdAt: now + 1,
    };
    appendMessage(assistantMsg);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);

    const settings = useSettingsStore.getState();

    // M7: use buildLLMContext instead of ad-hoc message mapping
    const { messages: llmMessages, approxTokens: toks } = buildLLMContext({
      workspaceId,
      systemPrimer: SYSTEM_PRIMER,
    });
    setApproxTokens(toks);

    const client = getClient();
    const model = getActiveModel();

    let fullContent = '';
    let stopped = false;

    try {
      const generator = client.generate({
        messages: llmMessages,
        model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        stream: settings.stream,
        signal: controller.signal,
      });

      for await (const chunk of generator) {
        if (controller.signal.aborted) { stopped = true; break; }
        if (chunk.delta) {
          fullContent += chunk.delta;
          updateAssistantMessage(workspaceId, assistantId, { content: fullContent });
        }
        if (chunk.done) break;
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') {
        stopped = true;
      } else {
        const errorText = err instanceof Error ? err.message : String(err);
        updateAssistantMessage(workspaceId, assistantId, {
          content: fullContent + `\n\n⚠️ Error: ${errorText}`,
        });
      }
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
    }

    if (stopped) {
      if (!fullContent) {
        updateAssistantMessage(workspaceId, assistantId, { content: '(generation stopped)' });
        fullContent = '(generation stopped)';
      }
      const stopMsg: SystemMessage = {
        id: uuidv4(), workspaceId, role: 'system',
        content: 'Generation stopped.',
        createdAt: Date.now(),
      };
      appendMessage(stopMsg);
    }

    attachSuggestions({
      assistantId,
      userText: userMsg.content,
      assistantText: fullContent,
      isSlashCommand: false,
    });
  }

  // ── Send handler ──────────────────────────────────────────────────────────
  function handleSend(text: string) {
    const now = Date.now();
    const userMsg: UserMessage = {
      id: uuidv4(), workspaceId, role: 'user',
      content: text,
      createdAt: now,
    };
    appendMessage(userMsg);

    const cmd = parseCommand(text);

    switch (cmd.kind) {
      case 'help': {
        appendMessage({
          id: uuidv4(), workspaceId, role: 'assistant',
          content: HELP_TEXT,
          createdAt: now + 1,
        });
        break;
      }
      case 'doctor': {
        appendMessage({
          id: uuidv4(), workspaceId, role: 'assistant',
          content: 'Running diagnostics…',
          createdAt: now + 1,
        });
        runtime.runDoctor(workspaceId).catch(() => {/* silenced */});
        break;
      }
      case 'tool': {
        if (cmd.jsonParseError) {
          appendMessage({
            id: uuidv4(), workspaceId, role: 'system',
            content: "Couldn't parse JSON input; sending as raw text.",
            createdAt: now + 1,
          });
        }
        appendMessage({
          id: uuidv4(), workspaceId, role: 'assistant',
          content: `Running \`${cmd.toolName}\`…`,
          createdAt: now + 2,
        });
        runtime.runTool({ toolName: cmd.toolName, input: cmd.input, workspaceId })
          .catch(() => {/* silenced */});
        break;
      }
      case 'unknown':
      default: {
        void runLLM(userMsg);
        break;
      }
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.icon}>◈</span>
        <span style={styles.titleText}>{title}</span>
        <span style={styles.badge}>butler</span>
        <span style={styles.providerBadge}>{llmProvider}</span>
        {approxTokens > 0 && (
          <span style={styles.tokenBadge} title="Approximate LLM context tokens">
            ~{approxTokens.toLocaleString()} tok
          </span>
        )}
      </div>

      <ChatTimeline
        messages={messages}
        onPickSuggestion={handlePickSuggestion}
        onDismissSuggestions={handleDismissSuggestions}
        onTogglePin={handleTogglePin}
        onToggleInclude={handleToggleInclude}
        pinnedIds={pinnedIds}
        includedIds={includedIds}
      />

      {isGenerating && (
        <button style={styles.stopButton} onClick={handleStop} type="button">
          ✕ Stop generating
        </button>
      )}

      <ChatComposer
        placeholder="Type a message or /command…"
        onSend={handleSend}
        disabled={isGenerating}
      />

      {/* L+2: Confirm modal */}
      {pendingConfirm !== null && (
        <div style={styles.modalBackdrop} onClick={handleConfirmCancel}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>
              Run: <strong>{pendingConfirm.title}</strong>?
            </div>
            {pendingConfirm.detail && (
              <div style={{ fontSize: 11, color: '#555' }}>{pendingConfirm.detail}</div>
            )}
            <div style={styles.modalActions}>
              <button style={styles.modalCancel} type="button" onClick={handleConfirmCancel}>
                Cancel
              </button>
              <button style={styles.modalConfirm} type="button" onClick={handleConfirmRun}>
                Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
