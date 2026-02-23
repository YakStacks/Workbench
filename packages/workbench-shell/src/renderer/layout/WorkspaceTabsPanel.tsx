/**
 * WorkspaceTabsPanel — wraps an active workspace with Chat / Artifacts / Runs tabs.
 *
 * This is a Shell-level wrapper. Apps do NOT need to change.
 * The "Chat" tab renders workspace.render() as-is.
 * The "Artifacts" tab renders ArtifactList for this workspace.
 * The "Runs" tab renders RunsList (filtered log events) for this workspace.
 *
 * The outer tab row is distinct from the global workspace TabBar at the top.
 */

import React from 'react';
import type { WorkbenchWorkspace } from '../../types';
import { ArtifactList } from '../components/ArtifactList';
import { RunsList } from '../components/RunsList';
import { useShellStore } from '../state/shellStore';

// ============================================================================
// TYPES
// ============================================================================

type InnerTab = 'chat' | 'artifacts' | 'runs';

interface WorkspaceTabsPanelProps {
  workspace: WorkbenchWorkspace;
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #1a1a1a',
    background: '#0d0d0d',
    flexShrink: 0,
    padding: '0 16px',
    gap: 0,
  },
  tab: {
    padding: '7px 14px',
    fontSize: 11,
    color: '#444',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    borderBottom: '2px solid transparent',
    transition: 'color 0.12s',
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
  },
  tabActive: {
    color: '#c0c0c0',
    borderBottomColor: '#4d9fff',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative' as const,
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function WorkspaceTabsPanel({ workspace }: WorkspaceTabsPanelProps): React.ReactElement {
  const defaultPane = useShellStore((s) => s.workspacePaneById[workspace.id]);
  const [activeTab, setActiveTab] = React.useState<InnerTab>(defaultPane ?? 'chat');

  const tabs: { id: InnerTab; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'artifacts', label: 'Artifacts' },
    { id: 'runs', label: 'Runs' },
  ];

  return (
    <div style={styles.root}>
      {/* Inner tab row */}
      <div style={styles.tabBar} role="tablist" aria-label="Workspace tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            style={activeTab === tab.id
              ? { ...styles.tab, ...styles.tabActive }
              : styles.tab
            }
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={styles.content}>
        {activeTab === 'chat' && workspace.render()}
        {activeTab === 'artifacts' && <ArtifactList workspaceId={workspace.id} />}
        {activeTab === 'runs' && <RunsList workspaceId={workspace.id} />}
      </div>
    </div>
  );
}
