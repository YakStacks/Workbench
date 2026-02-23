/**
 * HomePage — artifact-style grid of recent workspaces + app templates.
 *
 * Structure:
 *   - Recent workspaces grid (WorkspaceCards)
 *   - App templates ("New Workspace" per app)
 *
 * Does NOT manage persistence directly — delegates to workspaceStore.
 * Does NOT import specific apps — reads from appRegistry.
 *
 * Chat-first additions:
 *   - Empty state shows "Start a session" button (creates Butler workspace).
 *   - Deleting a workspace also clears its chat messages from chatStore.
 */

import React from 'react';
import { getAllApps, getApp } from '../../appRegistry';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useShellStore } from '../state/shellStore';
import { useChatStore } from '../state/chatStore';
import { useArtifactStore } from '../state/artifactStore';
import { WorkspaceCard } from '../components/WorkspaceCard';
import { NewWorkspaceWizard } from '../components/NewWorkspaceWizard';
import type { WorkbenchApp } from '../../types';

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100%',
    overflow: 'auto',
    padding: '32px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 40,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
  },
  appRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  newBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    background: '#161616',
    border: '1px solid #1e1e1e',
    borderRadius: 8,
    color: '#888',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  },
  newBtnIcon: {
    width: 24,
    height: 24,
    borderRadius: 5,
    background: '#1e2a3a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
  },
  emptyHint: {
    color: '#2a2a2a',
    fontSize: 13,
    fontStyle: 'italic',
    padding: '12px 0',
  },
  // Empty state (no workspaces at all)
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: '48px 0',
    color: '#333',
  },
  emptyStateTitle: {
    fontSize: 15,
    color: '#444',
  },
  emptyStateDesc: {
    fontSize: 12,
    color: '#2a2a2a',
    textAlign: 'center',
  },
  startBtn: {
    padding: '10px 24px',
    background: '#1e2a3a',
    border: '1px solid #2a3f5a',
    borderRadius: 8,
    color: '#4d9fff',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function HomePage(): React.ReactElement {
  const { workspaces, upsertWorkspace, deleteWorkspace, touchWorkspace } = useWorkspaceStore();
  const { openTab } = useShellStore();
  const { clearWorkspace } = useChatStore();
  const { clearWorkspace: clearArtifacts } = useArtifactStore();
  const apps = getAllApps();
  const [wizardOpen, setWizardOpen] = React.useState(false);

  // Sort recent: newest first
  const recent = [...workspaces].sort(
    (a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
  );

  async function handleNew(app: WorkbenchApp) {
    const ws = await app.createWorkspace();
    upsertWorkspace({
      id: ws.id,
      appId: ws.appId,
      title: ws.title,
      state: ws.state,
      lastOpened: new Date().toISOString(),
    });
    openTab(ws);
  }

  function handleOpen(workspaceId: string) {
    const persisted = workspaces.find((w) => w.id === workspaceId);
    if (!persisted) return;
    const app = getApp(persisted.appId);
    if (!app) return;

    // Re-hydrate workspace from persisted record.
    // In Phase 5, apps will provide a hydrate() method.
    app.createWorkspace().then((ws) => {
      // Patch with persisted ID/title so messages resolve correctly
      (ws as { id: string }).id = persisted.id;
      (ws as { title: string }).title = persisted.title;
      touchWorkspace(persisted.id);
      openTab(ws);
    });
  }

  function handleDelete(workspaceId: string) {
    // Clear chat messages and artifacts for this workspace before removing it
    clearWorkspace(workspaceId);
    clearArtifacts(workspaceId);
    deleteWorkspace(workspaceId);
  }

  async function handleStartSession() {
    const butlerApp = apps.find((a) => a.id === 'butler');
    if (butlerApp) {
      await handleNew(butlerApp);
    }
  }

  return (
    <div style={styles.page}>
      {/* Wizard modal */}
      {wizardOpen && <NewWorkspaceWizard onClose={() => setWizardOpen(false)} />}

      {/* Recent workspaces */}
      <section>
        <div style={styles.sectionLabel}>Recent Workspaces</div>
        {recent.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateTitle}>No workspaces yet</div>
            <div style={styles.emptyStateDesc}>
              Start a Butler session or create a workspace from a template.
            </div>
            <button
              style={styles.startBtn}
              onClick={() => setWizardOpen(true)}
              aria-label="New Workspace"
            >
              New Workspace
            </button>
          </div>
        ) : (
          <div style={styles.grid}>
            {recent.map((ws) => {
              const app = getApp(ws.appId);
              return (
                <WorkspaceCard
                  key={ws.id}
                  workspace={ws}
                  appName={app?.name ?? ws.appId}
                  appIcon={app?.icon}
                  onOpen={() => handleOpen(ws.id)}
                  onDelete={() => handleDelete(ws.id)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* App templates */}
      <section>
        <div style={styles.sectionLabel}>New Workspace</div>
        <div style={styles.appRow}>
          <button
            style={{ ...styles.newBtn, borderColor: '#2a3f5a', color: '#4d9fff' }}
            onClick={() => setWizardOpen(true)}
            aria-label="New Workspace from template"
          >
            <span style={styles.newBtnIcon}>+</span>
            From Template…
          </button>
          {apps.map((app) => (
            <button
              key={app.id}
              style={styles.newBtn}
              onClick={() => handleNew(app)}
              aria-label={`New ${app.name} workspace`}
            >
              <span style={styles.newBtnIcon}>{app.icon ?? '◻'}</span>
              {app.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
