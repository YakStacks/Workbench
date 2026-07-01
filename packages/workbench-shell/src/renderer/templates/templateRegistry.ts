/**
 * Template Registry — central store of built-in workspace templates.
 *
 * Templates are defined in code. No marketplace or dynamic loading yet.
 * Each template targets a registered appId and can seed chat, artifacts,
 * and auto-run actions.
 */

import type { TemplateId, WorkspaceTemplate } from '../types/templates';

// ============================================================================
// BUILT-IN TEMPLATES
// ============================================================================

const templates: WorkspaceTemplate[] = [
  {
    id: 'butler.session',
    title: 'Butler Session',
    description: 'Start a new Butler chat session with tool access.',
    appId: 'butler',
    defaultWorkspaceTitle: 'Butler Session',
    seedChat: [
      { role: 'system', content: 'New session started.' },
    ],
    defaultPane: 'chat',
  },
  {
    id: 'maestro.session',
    title: 'Maestro Session',
    description: 'Plan and build with Maestro. Use /tool and /doctor as needed.',
    appId: 'maestro',
    defaultWorkspaceTitle: 'Maestro Session',
    seedChat: [
      {
        role: 'assistant',
        content: 'Tell me what you want to build. Use /tool and /doctor as needed.',
      },
    ],
    defaultPane: 'chat',
  },
  {
    id: 'doctor.runAndAttach',
    title: 'Run Doctor & Attach',
    description: 'Run a diagnostic check and attach the report as an artifact.',
    appId: 'butler',
    defaultWorkspaceTitle: 'Doctor Report',
    seedChat: [
      {
        role: 'assistant',
        content:
          'Doctor scans your environment for common issues — missing tools, config problems, connectivity. Running now…',
      },
    ],
    runOnCreate: [{ kind: 'doctor' }],
    defaultPane: 'runs',
  },
  {
    id: 'pipewrench.diagnose',
    title: 'Pipewrench Diagnose',
    description: 'Diagnose MCP and tooling issues. Paste your error to begin.',
    appId: 'pipewrench',
    defaultWorkspaceTitle: 'Pipewrench Diagnostics',
    seedChat: [
      {
        role: 'assistant',
        content: 'I can diagnose MCP/tooling issues. Paste your error.',
      },
    ],
    defaultPane: 'chat',
  },
  {
    id: 'note.blank',
    title: 'Blank Note',
    description: 'A blank workspace with a note artifact ready to edit.',
    appId: 'butler',
    defaultWorkspaceTitle: 'Untitled Note',
    seedArtifacts: [
      {
        kind: 'note',
        title: 'Untitled Note',
        content: '',
      },
    ],
    defaultPane: 'artifacts',
  },
];

// ============================================================================
// PUBLIC API
// ============================================================================

/** Returns all built-in templates. */
export function getTemplates(): WorkspaceTemplate[] {
  return templates;
}

/** Retrieve a template by ID. */
export function getTemplate(id: TemplateId): WorkspaceTemplate | undefined {
  return templates.find((t) => t.id === id);
}
