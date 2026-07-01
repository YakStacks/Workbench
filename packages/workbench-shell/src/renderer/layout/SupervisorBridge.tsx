/**
 * SupervisorBridge — mounts once in ShellLayout alongside RuntimeBridge.
 *
 * Listens to shellStore.logEvents for new entries, maps them back to
 * RuntimeEvent shape, and runs Pappy's rules to decide if a message
 * should be posted into the workspace chat.
 *
 * Rate-limited: minimum 15 seconds between Pappy messages per workspace.
 *
 * Renders nothing — pure side-effect component.
 */

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useShellStore } from '../state/shellStore';
import { useChatStore } from '../state/chatStore';
import { useRuntime } from '../../runtime/runtimeContext';
import { shouldSpeak, buildMessage, suggestedAction } from '../supervisor/pappy';
import type { RuntimeEvent } from '../types/runtimeEvents';

// Rate limit: minimum ms between Pappy messages per workspace
const RATE_LIMIT_MS = 15_000;

export function SupervisorBridge(): null {
  const runtime = useRuntime();
  const appendMessage = useChatStore((s) => s.appendMessage);

  // Track last time Pappy spoke per workspace
  const lastSpokeRef = React.useRef<Map<string, number>>(new Map());

  React.useEffect(() => {
    const unsubscribe = runtime.subscribeToEvents((evt: RuntimeEvent) => {
      // Must have a workspace to post into
      if (!evt.workspaceId) return;

      // Check Pappy's rules
      if (!shouldSpeak(evt)) return;

      // Rate limit per workspace
      const wid = evt.workspaceId;
      const now = Date.now();
      const lastSpoke = lastSpokeRef.current.get(wid) ?? 0;
      if (now - lastSpoke < RATE_LIMIT_MS) return;

      // Build message
      const content = buildMessage(evt);
      if (!content) return;

      // Include suggested action if any
      const action = suggestedAction(evt);
      const fullContent = action
        ? `${content}\nTry this: ${action}`
        : content;

      // Post into chat
      appendMessage({
        id: uuidv4(),
        workspaceId: wid,
        role: 'assistant',
        content: fullContent,
        createdAt: now,
      });

      // Update rate limit tracker
      lastSpokeRef.current.set(wid, now);
    });

    return unsubscribe;
  }, [runtime, appendMessage]);

  return null;
}
