/**
 * getPaletteItems — builds the full list of Command Palette items.
 *
 * Pure function (no React hooks). Reads store state via .getState() so it
 * can be called outside React components.
 *
 * Categories:
 *   Templates  — built-in workspace templates
 *   Commands   — hard-coded shell actions
 *   Workspaces — persisted workspaces (reopen or activate)
 *   Artifacts  — all artifacts across workspaces (open as workspace)
 */

import { v4 as uuidv4 } from 'uuid';
import type { PaletteItem } from '../types/palette';
import type { LLMProviderId } from '../types/llm';
import { getTemplates } from '../templates/templateRegistry';
import { applyTemplate } from '../templates/applyTemplate';
import { openArtifactAsWorkspace } from '../templates/openArtifactAsWorkspace';
import { getRuntime } from '../runtime/runtimeSingleton';
import { useShellStore } from '../state/shellStore';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useArtifactStore } from '../state/artifactStore';
import { useChatStore } from '../state/chatStore';
import { useSettingsStore } from '../state/settingsStore';
import { getClient, getActiveModel } from '../llm/getClient';
import { getApp } from '../../appRegistry';

// ============================================================================
// TEMPLATES
// ============================================================================

function buildTemplateItems(): PaletteItem[] {
  return getTemplates().map((t) => ({
    id: `template:${t.id}`,
    category: 'Templates' as const,
    title: t.title,
    subtitle: t.description,
    keywords: ['template', 'new', 'create'],
    action: () => applyTemplate(t),
  }));
}

// ============================================================================
// COMMANDS
// ============================================================================

function buildCommandItems(): PaletteItem[] {
  return [
    {
      id: 'cmd:doctor',
      category: 'Commands' as const,
      title: 'Run Doctor in active workspace',
      subtitle: 'Diagnose environment issues',
      keywords: ['doctor', 'diagnose', 'health', 'check'],
      action: () => {
        const workspaceId = useShellStore.getState().activeTabId;
        const runtime = getRuntime();
        if (!runtime) {
          // Vite dev mode — no runtime available
          if (workspaceId) {
            useChatStore.getState().appendMessage({
              id: uuidv4(),
              workspaceId,
              role: 'system',
              content: 'Runtime not available in renderer-only dev mode.',
              createdAt: Date.now(),
            });
          }
          return;
        }
        runtime.runDoctor(workspaceId ?? undefined).catch((err: unknown) => {
          console.warn('[palette] runDoctor failed:', err);
        });
      },
    },
    {
      id: 'cmd:toggle-log',
      category: 'Commands' as const,
      title: 'Toggle Log Drawer',
      subtitle: 'Show or hide the runtime event log',
      keywords: ['log', 'drawer', 'events', 'toggle'],
      action: () => useShellStore.getState().toggleLogDrawer(),
    },
    {
      id: 'cmd:go-home',
      category: 'Commands' as const,
      title: 'Go to Home',
      subtitle: 'Show the home / workspace list',
      keywords: ['home', 'navigate', 'workspaces'],
      action: () => useShellStore.getState().setActiveSection('home'),
    },
    {
      id: 'cmd:help',
      category: 'Commands' as const,
      title: 'Show available chat commands',
      subtitle: '/doctor · /tool <name> [json] · /help',
      keywords: ['help', 'commands', 'slash'],
      action: () => {
        const workspaceId = useShellStore.getState().activeTabId;
        if (!workspaceId) return;
        useChatStore.getState().appendMessage({
          id: uuidv4(),
          workspaceId,
          role: 'system',
          content: 'Chat commands: /doctor · /tool <name> [json] · /help',
          createdAt: Date.now(),
        });
      },
    },
    // ── LLM Settings ──────────────────────────────────────────────────────
    // NOTE: subtitles are evaluated eagerly (plain strings) — this is fine
    // because buildCommandItems() is called fresh each time getPaletteItems()
    // is invoked (on every palette open).
    {
      id: 'cmd:llm-set-provider',
      category: 'Commands' as const,
      title: 'Set LLM provider',
      subtitle: `Current: ${useSettingsStore.getState().llmProvider}`,
      keywords: ['llm', 'provider', 'openai', 'anthropic', 'mock', 'settings', 'ai'],
      action: () => {
        const current = useSettingsStore.getState().llmProvider;
        const input = window.prompt(
          `Set LLM provider\nOptions: mock, openai, anthropic\nCurrent: ${current}`,
          current,
        );
        if (input === null) return; // cancelled
        const trimmed = input.trim().toLowerCase();
        if (trimmed === 'mock' || trimmed === 'openai' || trimmed === 'anthropic') {
          useSettingsStore.getState().setLlmProvider(trimmed as LLMProviderId);
        } else {
          window.alert(`Invalid provider "${trimmed}". Must be: mock, openai, or anthropic`);
        }
      },
    },
    {
      id: 'cmd:llm-set-openai-key',
      category: 'Commands' as const,
      title: 'Set OpenAI API key',
      subtitle: useSettingsStore.getState().openaiApiKey ? 'Key configured (hidden)' : 'No key set',
      keywords: ['openai', 'api', 'key', 'secret', 'llm', 'settings'],
      action: () => {
        const input = window.prompt('Enter your OpenAI API key (starts with sk-):');
        if (input === null) return; // cancelled
        const trimmed = input.trim();
        if (!trimmed) return;
        useSettingsStore.getState().setOpenaiApiKey(trimmed);
        // Never log the key
      },
    },
    {
      id: 'cmd:llm-set-anthropic-key',
      category: 'Commands' as const,
      title: 'Set Anthropic API key',
      subtitle: useSettingsStore.getState().anthropicApiKey ? 'Key configured (hidden)' : 'No key set',
      keywords: ['anthropic', 'claude', 'api', 'key', 'secret', 'llm', 'settings'],
      action: () => {
        const input = window.prompt('Enter your Anthropic API key (starts with sk-ant-):');
        if (input === null) return; // cancelled
        const trimmed = input.trim();
        if (!trimmed) return;
        useSettingsStore.getState().setAnthropicApiKey(trimmed);
        // Never log the key
      },
    },
    {
      id: 'cmd:llm-set-openai-model',
      category: 'Commands' as const,
      title: 'Set OpenAI model',
      subtitle: `Current: ${useSettingsStore.getState().openaiModel}`,
      keywords: ['openai', 'model', 'gpt', 'llm', 'settings'],
      action: () => {
        const current = useSettingsStore.getState().openaiModel;
        const input = window.prompt('Enter OpenAI model name (e.g. gpt-4o, gpt-4o-mini):', current);
        if (input === null) return;
        const trimmed = input.trim();
        if (trimmed) useSettingsStore.getState().setOpenaiModel(trimmed);
      },
    },
    {
      id: 'cmd:llm-set-anthropic-model',
      category: 'Commands' as const,
      title: 'Set Anthropic model',
      subtitle: `Current: ${useSettingsStore.getState().anthropicModel}`,
      keywords: ['anthropic', 'claude', 'model', 'llm', 'settings'],
      action: () => {
        const current = useSettingsStore.getState().anthropicModel;
        const input = window.prompt('Enter Anthropic model name (e.g. claude-opus-4-5, claude-sonnet-4-5):', current);
        if (input === null) return;
        const trimmed = input.trim();
        if (trimmed) useSettingsStore.getState().setAnthropicModel(trimmed);
      },
    },
    {
      id: 'cmd:llm-toggle-stream',
      category: 'Commands' as const,
      title: 'Toggle LLM streaming',
      subtitle: `Currently: ${useSettingsStore.getState().stream ? 'on' : 'off'}`,
      keywords: ['stream', 'streaming', 'llm', 'settings', 'toggle'],
      action: () => {
        const current = useSettingsStore.getState().stream;
        useSettingsStore.getState().setStream(!current);
      },
    },
    {
      id: 'cmd:llm-test',
      category: 'Commands' as const,
      title: 'Test LLM: Say hello',
      subtitle: `Provider: ${useSettingsStore.getState().llmProvider} · Model: ${getActiveModel()}`,
      keywords: ['test', 'llm', 'hello', 'ping', 'check', 'ai'],
      action: async () => {
        const workspaceId = useShellStore.getState().activeTabId;
        if (!workspaceId) {
          window.alert('No active workspace. Open a Butler workspace first.');
          return;
        }
        const client = getClient();
        const model = getActiveModel();
        const settings = useSettingsStore.getState();

        // Append user test message
        const testMsgId = uuidv4();
        useChatStore.getState().appendMessage({
          id: testMsgId,
          workspaceId,
          role: 'user',
          content: 'Say hello in one sentence.',
          createdAt: Date.now(),
        });

        // Append placeholder assistant message
        const replyId = uuidv4();
        useChatStore.getState().appendMessage({
          id: replyId,
          workspaceId,
          role: 'assistant',
          content: '',
          createdAt: Date.now() + 1,
        });

        let fullContent = '';
        try {
          const gen = client.generate({
            messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
            model,
            temperature: settings.temperature,
            maxTokens: 100,
            stream: settings.stream,
          });
          for await (const chunk of gen) {
            if (chunk.delta) {
              fullContent += chunk.delta;
              useChatStore.getState().updateAssistantMessage(workspaceId, replyId, { content: fullContent });
            }
            if (chunk.done) break;
          }
        } catch (err: unknown) {
          const errorText = err instanceof Error ? err.message : String(err);
          useChatStore.getState().updateAssistantMessage(workspaceId, replyId, {
            content: `⚠️ Test failed: ${errorText}`,
          });
        }
      },
    },
  ];
}

// ============================================================================
// WORKSPACES
// ============================================================================

function buildWorkspaceItems(): PaletteItem[] {
  const { workspaces, touchWorkspace } = useWorkspaceStore.getState();
  const { openTab } = useShellStore.getState();
  // ARCHITECTURE NOTE: shellStore.openTab() sets activeTabId = workspace.id,
  // so tab ids are identical to workspace ids. activeTabId IS the workspaceId.

  return workspaces.map((persisted) => ({
    id: `ws:${persisted.id}`,
    category: 'Workspaces' as const,
    title: persisted.title,
    subtitle: persisted.appId,
    keywords: ['workspace', 'open', persisted.appId],
    action: async () => {
      // Check if already open → activate; otherwise recreate (mirrors HomePage.handleOpen)
      const { tabs, activateTab } = useShellStore.getState();
      const existingTab = tabs.find((t) => t.workspace.id === persisted.id);
      if (existingTab) {
        activateTab(persisted.id);
        return;
      }

      const app = getApp(persisted.appId);
      if (!app) return;

      const ws = await app.createWorkspace();
      (ws as { id: string }).id = persisted.id;
      (ws as { title: string }).title = persisted.title;
      touchWorkspace(persisted.id);
      openTab(ws);
    },
  }));
}

// ============================================================================
// ARTIFACTS
// ============================================================================

function buildArtifactItems(): PaletteItem[] {
  const { artifactsByWorkspaceId } = useArtifactStore.getState();
  const allArtifacts = Object.values(artifactsByWorkspaceId).flat();

  return allArtifacts.map((artifact) => ({
    id: `artifact:${artifact.id}`,
    category: 'Artifacts' as const,
    title: artifact.title,
    subtitle: `${artifact.kind} · workspace ${artifact.workspaceId.slice(0, 8)}`,
    keywords: ['artifact', artifact.kind, 'open'],
    action: () => openArtifactAsWorkspace(artifact),
  }));
}

// ============================================================================
// PUBLIC API
// ============================================================================

/** Returns all palette items across all categories. */
export function getPaletteItems(): PaletteItem[] {
  return [
    ...buildTemplateItems(),
    ...buildCommandItems(),
    ...buildWorkspaceItems(),
    ...buildArtifactItems(),
  ];
}

/**
 * Returns a sensible default list when the query is empty.
 * Shows: first 2 templates, all 4 commands, 2 most-recently-opened workspaces.
 */
export function getDefaultPaletteItems(): PaletteItem[] {
  const templates = buildTemplateItems().slice(0, 2);
  const commands = buildCommandItems();
  const workspaces = buildWorkspaceItems()
    .slice()
    // Most recently opened = last in sorted order
    .sort((a, b) => {
      const wss = useWorkspaceStore.getState().workspaces;
      const wa = wss.find((w) => `ws:${w.id}` === a.id);
      const wb = wss.find((w) => `ws:${w.id}` === b.id);
      return (wb?.lastOpened ?? '').localeCompare(wa?.lastOpened ?? '');
    })
    .slice(0, 2);

  return [...templates, ...commands, ...workspaces];
}
