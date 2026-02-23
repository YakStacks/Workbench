/**
 * ButlerChatView — the chat-first workspace view for Butler.
 *
 * Reads messages from chatStore (keyed by workspaceId).
 * Renders ChatTimeline + ChatComposer.
 *
 * Phase B1 — slash commands:
 * - /doctor  → runtime.runDoctor(workspaceId)
 * - /tool <name> [json]  → runtime.runTool({ toolName, input, workspaceId })
 * - /help    → assistant message listing commands
 * - Normal text → plain assistant placeholder
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
import { useRuntime } from '../../../runtime/runtimeContext';
import { parseCommand } from '../../utils/commandParser';
import type { AssistantMessage, SystemMessage, UserMessage } from '../../types/chat';

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
// COMPONENT
// ============================================================================

interface ButlerChatViewProps {
  workspaceId: string;
  title: string;
}

export function ButlerChatView({ workspaceId, title }: ButlerChatViewProps): React.ReactElement {
  const { getMessages, appendMessage } = useChatStore();
  const runtime = useRuntime();
  const messages = getMessages(workspaceId);

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
        // Normal chat (no LLM yet)
        const reply: AssistantMessage = {
          id: uuidv4(),
          workspaceId,
          role: 'assistant',
          content: `Got it. (Butler B1 — LLM integration coming in Phase 6.)`,
          createdAt: now + 1,
        };
        appendMessage(reply);
        break;
      }
    }
  }

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
  };

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.icon}>◈</span>
        <span style={styles.titleText}>{title}</span>
        <span style={styles.badge}>butler</span>
      </div>

      <ChatTimeline messages={messages} />
      <ChatComposer
        placeholder="Type a message or /command…"
        onSend={handleSend}
      />
    </div>
  );
}
