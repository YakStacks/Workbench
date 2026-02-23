/**
 * openArtifactAsWorkspace — creates a new Butler workspace from an artifact.
 *
 * The new workspace gets:
 * - title: "Note: <artifact title>"
 * - a copied artifact (same content, new id)
 * - a seeded chat message: "Opened from artifact: <original title>"
 * - default pane: artifacts
 *
 * Does NOT remove the original artifact.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Artifact } from '../types/artifacts';
import { getApp } from '../../appRegistry';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useShellStore } from '../state/shellStore';
import { useChatStore } from '../state/chatStore';
import { useArtifactStore } from '../state/artifactStore';

export async function openArtifactAsWorkspace(artifact: Artifact): Promise<void> {
  const app = getApp('butler');
  if (!app) {
    console.error('[openArtifactAsWorkspace] Butler app not registered.');
    return;
  }

  // 1. Create workspace
  const ws = await app.createWorkspace();
  const title = `Note: ${artifact.title}`;
  (ws as { title: string }).title = title;

  const workspaceId = ws.id;
  const now = Date.now();

  // 2. Persist workspace
  useWorkspaceStore.getState().upsertWorkspace({
    id: workspaceId,
    appId: ws.appId,
    title,
    state: ws.state,
    lastOpened: new Date().toISOString(),
  });

  // 3. Set default pane to artifacts
  useShellStore.getState().setWorkspacePane(workspaceId, 'artifacts');

  // 4. Open tab
  useShellStore.getState().openTab(ws);

  // 5. Copy artifact into new workspace
  useArtifactStore.getState().addArtifact({
    id: uuidv4(),
    workspaceId,
    kind: artifact.kind,
    title: artifact.title,
    createdAt: now,
    content: artifact.content,
    meta: { sourceArtifactId: artifact.id },
  });

  // 6. Seed chat message
  useChatStore.getState().appendMessage({
    id: uuidv4(),
    workspaceId,
    role: 'assistant',
    content: `Opened from artifact: "${artifact.title}"`,
    createdAt: now,
  });
}
