/**
 * Suggestion Types — click-to-run tool call suggestions for Butler.
 *
 * Suggestions are presented as clickable chips beneath assistant messages.
 * They are NEVER executed automatically — only on explicit user click.
 *
 * No `any` — use `unknown` for flexible payload fields.
 */

export type SuggestionKind =
  | 'runDoctor'
  | 'runTool'
  | 'openPane'
  | 'openCommandPalette';

export interface Suggestion {
  /** Stable id used for deduplication / spam prevention. */
  id: string;

  kind: SuggestionKind;

  /** Short label shown on the chip button. */
  title: string;

  /** Optional longer description shown as tooltip or sub-label. */
  detail?: string;

  /**
   * When true, clicking the chip shows a minimal confirm modal before executing.
   * Currently all generated suggestions have this false, but the code path exists
   * for future use.
   */
  requiresConfirm?: boolean;

  // ── runTool fields ─────────────────────────────────────────────────────
  toolName?: string;
  input?: unknown;

  // ── openPane field ─────────────────────────────────────────────────────
  pane?: 'chat' | 'artifacts' | 'runs';
}
