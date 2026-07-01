/**
 * Chat Message Model — persisted per workspace in chatStore.
 *
 * All message variants share a base with workspaceId + role + createdAt.
 * No `any`. Use `unknown` for flexible payload fields.
 */

import type { Suggestion } from './suggestions';

export type ChatRole = 'user' | 'assistant' | 'tool' | 'system';

export interface ChatMessageBase {
  id: string;
  workspaceId: string;
  role: ChatRole;
  createdAt: number; // epoch ms
}

export interface UserMessage extends ChatMessageBase {
  role: 'user';
  content: string;
}

export interface AssistantMessage extends ChatMessageBase {
  role: 'assistant';
  content: string;
  /**
   * Optional tool-call suggestions attached to this message.
   * Generated post-completion by generateSuggestions(); never from LLM output directly.
   * Presented as clickable chips — user must click to execute (never auto-run).
   */
  suggestions?: Suggestion[];
}

export interface ToolMessage extends ChatMessageBase {
  role: 'tool';
  toolName: string;
  status: 'requested' | 'running' | 'success' | 'error';
  input?: unknown;
  output?: unknown;
  error?: string;
}

export interface SystemMessage extends ChatMessageBase {
  role: 'system';
  content: string;
}

export type ChatMessage =
  | UserMessage
  | AssistantMessage
  | ToolMessage
  | SystemMessage;
