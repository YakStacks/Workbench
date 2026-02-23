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
 * - Normal text → sent to LLM via getClient() (provider from settingsStore)
 * - Streams response token-by-token into assistant message bubble
 * - Stop button (✕) visible while generating, calls abort() on AbortController
 * - Generation stopped → appends system message "Generation stopped."
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
import { useRuntime } from '../../../runtime/runtimeContext';
import { parseCommand } from '../../utils/commandParser';
import { getClient, getActiveModel } from '../../llm/getClient';
import type { AssistantMessage, SystemMessage, UserMessage, ChatMessage } from '../../types/chat';
import type { LLMMessage } from '../../types/llm';

// ============================================================================
// HELP TEXT
// ============================================================================

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

/** Convert chat messages to the LLM message format (exclude tool messages). */
function buildLLMMessages(messages: ChatMessage[]): LLMMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .map((m) => {
      if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
        return { role: m.role as 'user' | 'assistant' | 'system', content: m.content };
      }
      return null;
    })
    .filter((m): m is LLMMessage => m !== null);
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
    padding: '12px 20px',
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
  providerBadge: {
    fontSize: 10,
    color: '#666',
    marginLeft: 'auto',
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

  // Provider badge for header display
  const llmProvider = useSettingsStore((s) => s.llmProvider);

  // ── Stop button handler ──────────────────────────────────────────────────
  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }

  // ── LLM pipeline for normal text messages ───────────────────────────────
  async function runLLM(userMsg: UserMessage, priorMessages: ChatMessage[]) {
    const now = Date.now();

    // Create a placeholder assistant message
    const assistantId = uuidv4();
    const assistantMsg: AssistantMessage = {
      id: assistantId,
      workspaceId,
      role: 'assistant',
      content: '',
      createdAt: now + 1,
    };
    appendMessage(assistantMsg);

    // Set up AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);

    const settings = useSettingsStore.getState();
    const client = getClient();
    const model = getActiveModel();

    // Build the full LLM context from prior messages + new user message
    const allMessages = [...priorMessages, userMsg];
    const llmMessages = buildLLMMessages(allMessages);

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
        if (controller.signal.aborted) {
          stopped = true;
          break;
        }
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
        // Network / API error — show in assistant bubble
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
      // If assistant bubble is empty (stopped immediately), fill with placeholder
      if (!fullContent) {
        updateAssistantMessage(workspaceId, assistantId, { content: '(generation stopped)' });
      }
      // Append system message
      const stopMsg: SystemMessage = {
        id: uuidv4(),
        workspaceId,
        role: 'system',
        content: 'Generation stopped.',
        createdAt: Date.now(),
      };
      appendMessage(stopMsg);
    }
  }

  // ── Send handler ─────────────────────────────────────────────────────────
  function handleSend(text: string) {
    const now = Date.now();

    // 1. Always append the user message first
    const userMsg: UserMessage = {
      id: uuidv4(),
      workspaceId,
      role: 'user',
      content: text,
      createdAt: now,
    };
    appendMessage(userMsg);

    const cmd = parseCommand(text);

    switch (cmd.kind) {
      case 'help': {
        const reply: AssistantMessage = {
          id: uuidv4(),
          workspaceId,
          role: 'assistant',
          content: HELP_TEXT,
          createdAt: now + 1,
        };
        appendMessage(reply);
        break;
      }

      case 'doctor': {
        const ack: AssistantMessage = {
          id: uuidv4(),
          workspaceId,
          role: 'assistant',
          content: 'Running diagnostics…',
          createdAt: now + 1,
        };
        appendMessage(ack);
        // Tool blocks appear via RuntimeBridge → chatStore.ingestRuntimeEvent
        runtime.runDoctor(workspaceId).catch(() => {/* silenced */});
        break;
      }

      case 'tool': {
        // Warn on JSON parse failure
        if (cmd.jsonParseError) {
          const warn: SystemMessage = {
            id: uuidv4(),
            workspaceId,
            role: 'system',
            content: "Couldn't parse JSON input; sending as raw text.",
            createdAt: now + 1,
          };
          appendMessage(warn);
        }
        const ack: AssistantMessage = {
          id: uuidv4(),
          workspaceId,
          role: 'assistant',
          content: `Running \`${cmd.toolName}\`…`,
          createdAt: now + 2,
        };
        appendMessage(ack);
        runtime.runTool({ toolName: cmd.toolName, input: cmd.input, workspaceId })
          .catch(() => {/* silenced — error surfaces via tool:failed event */});
        break;
      }

      case 'unknown':
      default: {
        // Normal chat → send to LLM
        // Capture snapshot of messages BEFORE userMsg was appended
        // (appendMessage is synchronous, so we need to use current store state minus the new msg)
        const priorMessages = getMessages(workspaceId).slice(0, -1); // all but last (userMsg)
        void runLLM(userMsg, priorMessages);
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
      </div>

      <ChatTimeline messages={messages} />

      {/* Stop button — only visible while generating */}
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
    </div>
  );
}
