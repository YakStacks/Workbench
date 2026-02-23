/**
 * Artifact types — persistent per-workspace outputs.
 *
 * Artifacts are created by tool runs or manually. They are persisted to
 * localStorage under workbench.artifacts.v1.
 *
 * No `any`. Flexible metadata typed as Record<string, unknown>.
 */

export type ArtifactKind = 'note' | 'json' | 'text' | 'file';

export interface Artifact {
  id: string;
  workspaceId: string;
  kind: ArtifactKind;
  title: string;
  createdAt: number; // epoch ms
  /** Content stored as string. For json kind, store pretty-printed JSON. */
  content: string;
  /** Optional extra metadata (source tool, run id, etc.). */
  meta?: Record<string, unknown>;
}
