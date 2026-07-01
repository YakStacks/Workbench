/**
 * applyTemplate — orchestrates workspace creation from a WorkspaceTemplate.
 *
 * Responsibilities:
 * 1. Create workspace via app registry
 * 2. Set workspace title
 * 3. Persist workspace via workspaceStore
 * 4. Open the workspace tab via shellStore
 * 5. Seed chat messages via chatStore
 * 6. Seed artifacts via artifactStore
 * 7. Set default pane via shellStore
 * 8. Run any runOnCreate actions via runtimeSingleton
 */

import { v4 as uuidv4 } from 'uuid';
import type { WorkspaceTemplate } from '../types/templates';
import type { ChatMessage } from '../types/chat';
import type { Artifact } from '../types/artifacts';
import { getApp } from '../../appRegistry';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useShellStore } from '../state/shellStore';
import { useChatStore } from '../state/chatStore';
import { useArtifactStore } from '../state/artifactStore';
import { getRuntime } from '../runtime/runtimeSingleton';

export async function applyTemplate(template: WorkspaceTemplate): Promise<void> {
  // 1. Look up the app
  const app = getApp(template.appId);
  if (!app) {
    console.error(`[applyTemplate] App "${template.appId}" not registered.`);
    return;
  }

  // 2. Create workspace
  const ws = await app.createWorkspace();

  // 3. Patch title
  (ws as { title: string }).title = template.defaultWorkspaceTitle;

  const workspaceId = ws.id;
  const now = Date.now();

  // 4. Persist
  useWorkspaceStore.getState().upsertWorkspace({
    id: workspaceId,
    appId: ws.appId,
    title: template.defaultWorkspaceTitle,
    state: ws.state,
    lastOpened: new Date().toISOString(),
  });

  // 5. Set default pane (before opening tab so WorkspaceTabsPanel can read it)
  if (template.defaultPane) {
    useShellStore.getState().setWorkspacePane(workspaceId, template.defaultPane);
  }

  // 6. Open tab
  useShellStore.getState().openTab(ws);

  // 7. Seed chat messages
  if (template.seedChat && template.seedChat.length > 0) {
    const messages: ChatMessage[] = template.seedChat.map((seed) => {
      const base = {
        id: uuidv4(),
        workspaceId,
        createdAt: now,
      };

      if (seed.role === 'tool') {
        return {
          ...base,
          role: 'tool' as const,
          toolName: seed.toolName,
          status: seed.status ?? 'success',
          input: seed.input,
          output: seed.output,
        };
      }

      return {
        ...base,
        role: seed.role,
        content: seed.content,
      };
    });

    useChatStore.getState().appendMany(workspaceId, messages);
  }

  // 8. Seed artifacts
  if (template.seedArtifacts && template.seedArtifacts.length > 0) {
    const artifactStore = useArtifactStore.getState();
    for (const seed of template.seedArtifacts) {
      const artifact: Artifact = {
        id: uuidv4(),
        workspaceId,
        kind: seed.kind,
        title: seed.title,
        createdAt: now,
        content: seed.content,
      };
      artifactStore.addArtifact(artifact);
    }
  }

  // 9. Run on-create actions
  if (template.runOnCreate && template.runOnCreate.length > 0) {
    const runtime = getRuntime();
    if (!runtime) {
      // Vite-only dev mode — no runtime available
      useChatStore.getState().appendMessage({
        id: uuidv4(),
        workspaceId,
        role: 'system',
        content: 'Runtime not available; skipping automatic run.',
        createdAt: Date.now(),
      });
      return;
    }

    for (const action of template.runOnCreate) {
      if (action.kind === 'doctor') {
        runtime.runDoctor(workspaceId).catch((err: unknown) => {
          console.warn('[applyTemplate] runDoctor failed:', err);
        });
      } else if (action.kind === 'tool') {
        runtime.runTool({
          toolName: action.toolName,
          input: action.input,
          workspaceId,
        }).catch((err: unknown) => {
          console.warn('[applyTemplate] runTool failed:', err);
        });
      }
    }
  }
}
