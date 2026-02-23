/**
 * ArtifactList — renders all artifacts for a workspace in the Artifacts tab.
 */

import React from 'react';
import { useArtifactStore } from '../state/artifactStore';
import { ArtifactCard } from './ArtifactCard';

interface ArtifactListProps {
  workspaceId: string;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    overflow: 'auto',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  emptyHint: {
    color: '#2a2a2a',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 32,
  },
};

export function ArtifactList({ workspaceId }: ArtifactListProps): React.ReactElement {
  const { getArtifacts, removeArtifact } = useArtifactStore();
  const artifacts = getArtifacts(workspaceId);

  // Newest first
  const sorted = [...artifacts].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div style={styles.container}>
      {sorted.length === 0 ? (
        <div style={styles.emptyHint}>
          No artifacts yet. Run /doctor or /tool to generate outputs.
        </div>
      ) : (
        sorted.map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            artifact={artifact}
            onDelete={(id) => removeArtifact(workspaceId, id)}
          />
        ))
      )}
    </div>
  );
}
