/**
 * RuntimeBridge — mounts once in ShellLayout and owns the SOLE runtime subscription.
 *
 * On every Shell RuntimeEvent it:
 *   1. Writes a human-readable entry into shellStore.logEvents  (→ LogDrawer + RunsList)
 *   2. Calls chatStore.ingestRuntimeEvent(evt)                  (→ ChatTimeline)
 *   3. Auto-creates artifacts for whitelisted tool outputs      (→ ArtifactList)
 *
 * No other component should call runtime.subscribeToEvents().
 * LogDrawer reads from shellStore only; ButlerChatView reads from chatStore only.
 *
 * Renders nothing — this is a pure side-effect component.
 */

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useRuntime } from '../../runtime/runtimeContext';
import { useShellStore } from '../state/shellStore';
import { useChatStore } from '../state/chatStore';
import { useArtifactStore } from '../state/artifactStore';
import type { RuntimeEvent, ToolVerifiedEvent, DoctorRunEvent } from '../types/runtimeEvents';
import type { Artifact, ArtifactKind } from '../types/artifacts';

// ── Auto-artifact whitelist ───────────────────────────────────────────────────
// Only tools in this set produce automatic artifacts to avoid spam.
const AUTO_ARTIFACT_TOOLS = new Set(['doctor', 'echo', 'pipewrench']);

const AUTO_ARTIFACTS_FLAG = 'workbench.autoArtifacts';

// ── Human-readable log label ──────────────────────────────────────────────────

function eventToLabel(evt: RuntimeEvent): string {
  switch (evt.type) {
    case 'tool:requested':
      return `Tool requested: ${evt.toolName}`;
    case 'tool:started':
      return `Tool started: ${evt.toolName}${evt.runId ? ` (${evt.runId})` : ''}`;
    case 'tool:verified':
      return `Tool verified: ${evt.toolName} — ${evt.ok ? 'PASS' : 'FAIL'}`;
    case 'tool:failed':
      return `Tool failed: ${evt.toolName} — ${evt.error}`;
    case 'doctor:run': {
      const r = evt.report as { pass?: number; warn?: number; fail?: number } | undefined;
      return `Doctor ran — PASS ${r?.pass ?? 0} WARN ${r?.warn ?? 0} FAIL ${r?.fail ?? 0}`;
    }
    default:
      return (evt as { type: string }).type;
  }
}

// ── Auto-artifact helper ──────────────────────────────────────────────────────

function autoArtifactsEnabled(): boolean {
  try {
    const flag = localStorage.getItem(AUTO_ARTIFACTS_FLAG);
    // Default true: only disabled if explicitly set to "false"
    return flag !== 'false';
  } catch {
    return true;
  }
}

function makeArtifactFromVerified(evt: ToolVerifiedEvent): Artifact | null {
  if (!evt.workspaceId) return null;
  if (!AUTO_ARTIFACT_TOOLS.has(evt.toolName)) return null;
  if (!evt.output) return null;

  const isObject = typeof evt.output === 'object' && evt.output !== null;
  const kind: ArtifactKind = isObject ? 'json' : 'text';
  const content = isObject
    ? JSON.stringify(evt.output, null, 2)
    : String(evt.output);

  return {
    id: uuidv4(),
    workspaceId: evt.workspaceId,
    kind,
    title: `Tool Output: ${evt.toolName}`,
    createdAt: evt.ts,
    content,
    meta: { runId: evt.runId, toolName: evt.toolName },
  };
}

function makeArtifactFromDoctor(evt: DoctorRunEvent): Artifact | null {
  if (!evt.workspaceId) return null;
  if (!evt.report) return null;

  const content = JSON.stringify(evt.report, null, 2);
  return {
    id: uuidv4(),
    workspaceId: evt.workspaceId,
    kind: 'json',
    title: 'Tool Output: doctor',
    createdAt: evt.ts,
    content,
    meta: { runId: evt.runId, toolName: 'doctor' },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RuntimeBridge(): null {
  const runtime = useRuntime();
  const addLogEvent = useShellStore((s) => s.addLogEvent);
  const ingestRuntimeEvent = useChatStore((s) => s.ingestRuntimeEvent);
  const addArtifact = useArtifactStore((s) => s.addArtifact);

  React.useEffect(() => {
    const unsubscribe = runtime.subscribeToEvents((evt: RuntimeEvent) => {
      // 1. Log drawer + RunsList (workspaceId attached for filtered view)
      addLogEvent({
        type: evt.type,
        timestamp: evt.ts,
        label: eventToLabel(evt),
        workspaceId: evt.workspaceId,
      });

      // 2. Chat timeline (no-op if evt.workspaceId is absent)
      ingestRuntimeEvent(evt);

      // 3. Auto-artifacts (whitelist-gated, opt-out via localStorage flag)
      if (autoArtifactsEnabled()) {
        if (evt.type === 'tool:verified') {
          const artifact = makeArtifactFromVerified(evt);
          if (artifact) addArtifact(artifact);
        } else if (evt.type === 'doctor:run') {
          const artifact = makeArtifactFromDoctor(evt);
          if (artifact) addArtifact(artifact);
        }
      }
    });

    return unsubscribe;
  }, [runtime, addLogEvent, ingestRuntimeEvent, addArtifact]);

  return null;
}
