/**
 * Workspace Context Types — M phase.
 *
 * WorkspaceContextSettings: user-configurable toggles and budget.
 * WorkspaceContextState: per-workspace context state persisted to disk.
 *
 * No `any`.
 */

// ============================================================================
// SETTINGS
// ============================================================================

export interface WorkspaceContextSettings {
  /** Include the workspace summary in LLM context. Default: true. */
  includeSummary: boolean;

  /** Include pinned messages in LLM context. Default: true. */
  includePinned: boolean;

  /**
   * Approximate token budget for context window.
   * Token estimator: Math.ceil(text.length / 4).
   * Default: 3000.
   */
  maxContextTokens: number;
}

export const DEFAULT_CONTEXT_SETTINGS: WorkspaceContextSettings = {
  includeSummary: true,
  includePinned: true,
  maxContextTokens: 3000,
};

// ============================================================================
// STATE
// ============================================================================

export interface WorkspaceContextState {
  workspaceId: string;

  /**
   * Optional markdown summary of the workspace conversation.
   * Written by "Generate Summary" or manually.
   */
  summary: string;

  /**
   * Set of messageIds that are pinned (always included in LLM context
   * when settings.includePinned=true).
   */
  pinnedMessageIds: string[];

  /**
   * Set of messageIds explicitly included in context (beyond recency).
   * Controlled via per-message "Include" checkbox in ChatTimeline.
   */
  includeMessageIds: string[];

  /** Per-workspace settings overrides. */
  settings: WorkspaceContextSettings;
}
