/**
 * NewWorkspaceWizard — modal wizard for creating workspaces from templates.
 *
 * Shows a grid of template cards. Select one, click Create.
 * Uses the existing Modal component as the overlay wrapper.
 * Calls applyTemplate() to create and seed the workspace.
 */

import React from 'react';
import { Modal } from './Modal';
import { TemplateCard } from './TemplateCard';
import { getTemplates } from '../templates/templateRegistry';
import { applyTemplate } from '../templates/applyTemplate';
import type { TemplateId } from '../types/templates';

interface NewWorkspaceWizardProps {
  onClose(): void;
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 10,
    marginBottom: 20,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    borderTop: '1px solid #1e1e1e',
    paddingTop: 14,
  },
  btnCancel: {
    padding: '8px 18px',
    background: 'transparent',
    border: '1px solid #252525',
    borderRadius: 6,
    color: '#666',
    fontSize: 12,
    cursor: 'pointer',
  },
  btnCreate: {
    padding: '8px 22px',
    background: '#1e2a3a',
    border: '1px solid #2a3f5a',
    borderRadius: 6,
    color: '#4d9fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  btnCreateDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
};

export function NewWorkspaceWizard({ onClose }: NewWorkspaceWizardProps): React.ReactElement {
  const templates = getTemplates();
  const [selectedId, setSelectedId] = React.useState<TemplateId | null>(null);
  const [creating, setCreating] = React.useState(false);

  const selectedTemplate = selectedId
    ? templates.find((t) => t.id === selectedId) ?? null
    : null;

  async function handleCreate() {
    if (!selectedTemplate || creating) return;
    setCreating(true);
    try {
      await applyTemplate(selectedTemplate);
      onClose();
    } catch (err) {
      console.error('[NewWorkspaceWizard] Create failed:', err);
      setCreating(false);
    }
  }

  return (
    <Modal title="New Workspace" onClose={onClose}>
      <div style={styles.grid} role="listbox" aria-label="Template list">
        {templates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            selected={selectedId === t.id}
            onSelect={() => setSelectedId(t.id)}
          />
        ))}
      </div>

      <div style={styles.footer}>
        <button style={styles.btnCancel} onClick={onClose}>
          Cancel
        </button>
        <button
          style={
            !selectedTemplate || creating
              ? { ...styles.btnCreate, ...styles.btnCreateDisabled }
              : styles.btnCreate
          }
          onClick={handleCreate}
          disabled={!selectedTemplate || creating}
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </div>
    </Modal>
  );
}
