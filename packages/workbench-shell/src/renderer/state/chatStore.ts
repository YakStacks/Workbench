/**
 * Chat Store — per-workspace message persistence.
 *
 * Messages are keyed by workspaceId. Phase C: persisted to disk via
 * storageGet/storageSet('chat'). Falls back to localStorage in Vite dev mode.
 *
 * Migration: on first load, if disk is empty, promotes data from the
 * old localStorage key ('workbench.chat.v1') to disk.
 *
 * Lifecycle:
 * - On workspace creation: call appendMessage() with an initial SystemMessage.
 * - On workspace deletion: call clearWorkspace() to purge its messages.
 *
 * Phase A additions:
 * - ingestRuntimeEvent(evt): routes Shell RuntimeEvents into ToolMessage blocks.
 *   Uses an in-memory runId→messageId index so status updates mutate the
 *   existing message rather than appending a duplicate.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, AssistantMessage, ToolMessage } from '../types/chat';
import type { RuntimeEvent } from '../types/runtimeEvents';
import { storageGet, storageSet } from '../storage/storageClient';

// Old localStorage key (migration only)
const OLD_STORAGE_KEY = 'workbench.chat.v1';

// ============================================================================
// STORE SHAPE
// ============================================================================

interface ChatStoreState {
  messagesByWorkspaceId: Record<string, ChatMessage[]>;

  /** Return all messages for a workspace (empty array if none). */
  getMessages(workspaceId: string): ChatMessage[];

  /** Append a single message to a workspace's timeline. */
  appendMessage(msg: ChatMessage): void;

  /** Append multiple messages at once (e.g. initial hydration). */
  appendMany(workspaceId: string, msgs: ChatMessage[]): void;

  /** Replace all messages for a workspace with a new set. */
  setMessages(workspaceId: string, msgs: ChatMessage[]): void;

  /** Remove all messages for a workspace (call on workspace delete). */
  clearWorkspace(workspaceId: string): void;

  /**
   * Patch an existing AssistantMessage in-place (for streaming).
   *
   * Typically called with { content: newContent } during streaming to append
   * delta text to the assistant bubble without creating new messages.
   * Does NOT persist to disk mid-stream (caller must call appendMessage first,
   * then use this to update content, and let the final persist happen naturally
   * via setMessages or a terminal appendMessage call if needed).
   *
   * Persists to disk on each call (acceptable cost for streaming UX).
   */
  updateAssistantMessage(
    workspaceId: string,
    messageId: string,
    patch: Partial<Pick<AssistantMessage, 'content'>>,
  ): void;

  /**
   * Ingest a Shell RuntimeEvent and update the ToolMessage timeline.
   *
   * - If evt.workspaceId is absent, the event is ignored (still reaches LogDrawer).
   * - tool:requested  → append a new ToolMessage with status "requested"
   * - tool:started    → update existing ToolMessage to status "running"
   * - tool:verified   → update to "success" (ok=true) or "error" (ok=false)
   * - tool:failed     → update to "error" with error text
   * - doctor:run      → append a ToolMessage representing the doctor report
   *
   * runId is used as the stable ToolMessage.id so in-flight updates mutate
   * the same message rather than creating duplicates.
   */
  ingestRuntimeEvent(evt: RuntimeEvent): void;
}

// ============================================================================
// STORE
// ============================================================================

// In-memory only: runId → { workspaceId, messageId }
// Not persisted — transient tool runs don't need to survive reloads.
const runIndex = new Map<string, { workspaceId: string; messageId: string }>();

export const useChatStore = create<ChatStoreState>((set, get) => ({
  messagesByWorkspaceId: {},

  getMessages: (workspaceId) => {
    return get().messagesByWorkspaceId[workspaceId] ?? [];
  },

  appendMessage: (msg) => {
    const current = get().messagesByWorkspaceId;
    const existing = current[msg.workspaceId] ?? [];
    const next = { ...current, [msg.workspaceId]: [...existing, msg] };
    set({ messagesByWorkspaceId: next });
    storageSet('chat', next);
  },

  appendMany: (workspaceId, msgs) => {
    const current = get().messagesByWorkspaceId;
    const existing = current[workspaceId] ?? [];
    const next = { ...current, [workspaceId]: [...existing, ...msgs] };
    set({ messagesByWorkspaceId: next });
    storageSet('chat', next);
  },

  setMessages: (workspaceId, msgs) => {
    const current = get().messagesByWorkspaceId;
    const next = { ...current, [workspaceId]: msgs };
    set({ messagesByWorkspaceId: next });
    storageSet('chat', next);
  },

  clearWorkspace: (workspaceId) => {
    const current = get().messagesByWorkspaceId;
    const next = { ...current };
    delete next[workspaceId];
    set({ messagesByWorkspaceId: next });
    storageSet('chat', next);
  },

  updateAssistantMessage: (workspaceId, messageId, patch) => {
    const current = get().messagesByWorkspaceId;
    const msgs = current[workspaceId] ?? [];
    const next = (msgs as ChatMessage[]).map((m) =>
      m.id === messageId && m.role === 'assistant'
        ? ({ ...m, ...patch } as AssistantMessage)
        : m
    );
    const nextMap = { ...current, [workspaceId]: next };
    set({ messagesByWorkspaceId: nextMap });
    storageSet('chat', nextMap);
  },

  ingestRuntimeEvent: (evt) => {
    if (!evt.workspaceId) return; // No routing target — log only
    // Capture as const string so inner functions can use it as an index key
    const wid: string = evt.workspaceId;

    const current = get().messagesByWorkspaceId;

    // ── Helper: patch a ToolMessage by its stable id ─────────────────────
    function patchTool(
      messageId: string,
      patch: Partial<Omit<ToolMessage, 'id' | 'workspaceId' | 'role' | 'createdAt'>>
    ): void {
      const msgs = current[wid] ?? [];
      const next = (msgs as ChatMessage[]).map((m) =>
        m.id === messageId && m.role === 'tool'
          ? ({ ...m, ...patch } as ToolMessage)
          : m
      );
      const nextMap = { ...current, [wid]: next };
      set({ messagesByWorkspaceId: nextMap });
      storageSet('chat', nextMap);
    }

    // ── Helper: append a new ToolMessage ─────────────────────────────────
    function appendTool(msg: ToolMessage): void {
      const msgs = current[wid] ?? [];
      const nextMap = { ...current, [wid]: [...(msgs as ChatMessage[]), msg] };
      set({ messagesByWorkspaceId: nextMap });
      storageSet('chat', nextMap);
    }

    switch (evt.type) {
      case 'tool:requested': {
        const runId = evt.runId;
        // Use runId as the stable message id (if present), else generate one
        const messageId = runId ?? uuidv4();
        const msg: ToolMessage = {
          id: messageId,
          workspaceId: wid,
          role: 'tool',
          toolName: evt.toolName,
          status: 'requested',
          input: evt.input,
          createdAt: evt.ts,
        };
        appendTool(msg);
        if (runId) {
          runIndex.set(runId, { workspaceId: wid, messageId });
        }
        break;
      }

      case 'tool:started': {
        const runId = evt.runId;
        if (runId && runIndex.has(runId)) {
          const { messageId } = runIndex.get(runId)!;
          patchTool(messageId, { status: 'running' });
        }
        break;
      }

      case 'tool:verified': {
        const runId = evt.runId;
        if (runId && runIndex.has(runId)) {
          const { messageId } = runIndex.get(runId)!;
          patchTool(messageId, {
            status: evt.ok ? 'success' : 'error',
            output: evt.output,
            error: evt.ok ? undefined : 'Verification failed',
          });
          runIndex.delete(runId);
        }
        break;
      }

      case 'tool:failed': {
        const runId = evt.runId;
        if (runId && runIndex.has(runId)) {
          const { messageId } = runIndex.get(runId)!;
          patchTool(messageId, { status: 'error', error: evt.error });
          runIndex.delete(runId);
        }
        break;
      }

      case 'doctor:run': {
        // Doctor runs appear as a synthetic ToolMessage
        const runId = evt.runId;
        const messageId = runId ?? uuidv4();
        const msg: ToolMessage = {
          id: messageId,
          workspaceId: wid,
          role: 'tool',
          toolName: 'doctor',
          status: 'success',
          output: evt.report,
          createdAt: evt.ts,
        };
        appendTool(msg);
        break;
      }
    }
  },
}));

// ============================================================================
// ASYNC HYDRATION (runs once at module load)
// ============================================================================

(async () => {
  const fromDisk = await storageGet<Record<string, ChatMessage[]> | null>('chat', null);

  if (fromDisk != null) {
    useChatStore.setState({ messagesByWorkspaceId: fromDisk });
  } else {
    // No disk data — migrate from old localStorage key
    try {
      const raw = localStorage.getItem(OLD_STORAGE_KEY);
      if (raw) {
        const migrated = JSON.parse(raw) as Record<string, ChatMessage[]>;
        useChatStore.setState({ messagesByWorkspaceId: migrated });
        await storageSet('chat', migrated);
      }
    } catch {
      // localStorage unavailable or unparseable — start fresh
    }
  }
})();
