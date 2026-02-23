/**
 * HomePage — artifact-style grid of recent workspaces + app templates.
 *
 * Structure:
 *   - Recent workspaces grid (WorkspaceCards)
 *   - App templates ("New Workspace" per app)
 *
 * Does NOT manage persistence directly — delegates to workspaceStore.
 * Does NOT import specific apps — reads from appRegistry.
 */

import React from 'react';
import { getAllApps, getApp } from '../../appRegistry';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useShellStore } from '../state/shellStore';
import { WorkspaceCard } from '../components/WorkspaceCard';
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
};

// ============================================================================
// COMPONENT
// ============================================================================

export function HomePage(): React.ReactElement {
  const { workspaces, upsertWorkspace, deleteWorkspace, touchWorkspace } = useWorkspaceStore();
  const { openTab } = useShellStore();
  const apps = getAllApps();

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

    // Re-hydrate workspace from persisted record
    // In Phase 5, apps will provide a hydrate() method.
    // For now we call createWorkspace() with the persisted ID overridden.
    app.createWorkspace().then((ws) => {
      // Patch with persisted data
      (ws as { id: string }).id = persisted.id;
      (ws as { title: string }).title = persisted.title;
      touchWorkspace(persisted.id);
      openTab(ws);
    });
  }

  function handleDelete(workspaceId: string) {
    deleteWorkspace(workspaceId);
  }

  return (
    <div style={styles.page}>
      {/* Recent workspaces */}
      <section>
        <div style={styles.sectionLabel}>Recent Workspaces</div>
        {recent.length === 0 ? (
          <div style={styles.emptyHint}>No workspaces yet. Create one below.</div>
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
        {apps.length === 0 ? (
          <div style={styles.emptyHint}>No apps installed.</div>
        ) : (
          <div style={styles.appRow}>
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
        )}
      </section>
    </div>
  );
}
