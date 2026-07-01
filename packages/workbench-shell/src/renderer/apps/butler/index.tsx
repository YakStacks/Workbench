/**
 * Butler App — chat-first workspace.
 *
 * Domain: Conversational interface
 * Phase 1: Chat timeline with simulated tool blocks. No LLM yet.
 * Phase 6: Receives WorkbenchRuntimeContext, integrates LLM.
 *
 * Butler must NOT know about Maestro.
 * Butler must NOT access Shell internals.
 */

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WorkbenchApp, WorkbenchWorkspace } from '../../../types';
import { ButlerChatView } from './ButlerChatView';
import { useChatStore } from '../../state/chatStore';
import type { SystemMessage } from '../../types/chat';

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
    const title = 'Butler Session';

    // Initialize chat timeline with a system message
    const systemMsg: SystemMessage = {
      id: uuidv4(),
      workspaceId: id,
      role: 'system',
      content: 'New session started.',
      createdAt: Date.now(),
    };
    useChatStore.getState().appendMessage(systemMsg);

    return {
      id,
      appId: 'butler',
      title,
      state: {},
      render() {
        return <ButlerChatView workspaceId={id} title={title} />;
      },
      onMount() {},
      onDispose() {},
    };
  },
};
