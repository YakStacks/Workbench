/**
 * Shared LLM system primer for Butler workspaces.
 *
 * Imported by both ButlerChatView.tsx (for live inference) and
 * ContextPanel.tsx (for the Context Preview modal).
 *
 * Keep this in sync with any future personality / capability changes.
 */

export const BUTLER_SYSTEM_PRIMER =
  'You are Butler inside Workbench. Be concise. ' +
  'Suggest tools as clickable suggestions; never run tools automatically.';
