/**
 * generateSuggestions — deterministic, rule-based suggestion generator.
 *
 * Called after an LLM response completes (or is stopped).  Inspects the
 * user text and assistant response for signal words and produces up to 4
 * Suggestion objects that are attached to the assistant message.
 *
 * NO LLM usage.  NO side-effects.  Pure function.
 *
 * Spam prevention:
 *   - Per-workspace cooldown: if identical suggestion ids were generated
 *     within the last 10 seconds, returns the cached set (dedup).
 *   - Callers must skip generation entirely for slash commands (checked by
 *     the caller, not here).
 *
 * Phase L+2: All generated suggestions set requiresConfirm: false.
 *   The field exists on the Suggestion type for future use — no chips
 *   currently require confirmation.
 *
 * Phase L+3: Runtime-aware enrichment via lastToolMessages.
 *   If recent tool messages for the workspace show failures (status='error'),
 *   Run Doctor + Open Runs chips are injected.
 */

import type { Suggestion } from '../types/suggestions';
import type { ToolMessage } from '../types/chat';

// ============================================================================
// SIGNAL WORD SETS
// ============================================================================

const DOCTOR_SIGNALS = [
  'error', 'failed', 'crash', 'timeout', 'spawn', 'permission', 'path',
  "can't connect", 'cannot connect', 'connection', 'econn', 'mcp', 'server',
  'not found', 'enoent', 'access denied', 'refused',
];

const PIPEWRENCH_SIGNALS = [
  'mcp', 'server', 'tooling', 'connect', 'network', 'socket', 'port',
  'rpc', 'endpoint',
];

const RUNS_SIGNALS = [
  'logs', 'events', 'history', 'output', 'run', 'trace', 'debug',
];

const PALETTE_SIGNALS = [
  'what can you do', 'help', '/help', 'commands', 'options', 'available',
];

// ============================================================================
// HELPERS
// ============================================================================

function includes(haystack: string, signals: string[]): boolean {
  const lower = haystack.toLowerCase();
  return signals.some((s) => lower.includes(s));
}

/** Build a suggestion with requiresConfirm=false (L+2: default for all chips). */
function chip(s: Omit<Suggestion, 'requiresConfirm'>): Suggestion {
  return { ...s, requiresConfirm: false };
}

// ============================================================================
// SPAM PREVENTION
// (module-level Map — not persisted, resets on reload which is fine)
// ============================================================================

interface CooldownEntry {
  hash: string;
  ts: number;
}

const COOLDOWN_MS = 10_000; // 10 seconds
const cooldownByWorkspace = new Map<string, CooldownEntry>();

/** Stable sorted hash for a suggestion set. */
function hashSuggestions(suggestions: Suggestion[]): string {
  return suggestions.map((s) => s.id).sort().join(',');
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate up to 4 Suggestion objects for a completed assistant message.
 *
 * Returns empty array when:
 *   - No signal words found AND no runtime failures detected.
 *   - Same suggestions were generated < 10s ago for this workspace (cooldown).
 *
 * @param lastToolMessages  Optional slice of recent ToolMessages for the
 *   workspace (L+3). Any message with status='error' injects Doctor+Runs chips.
 */
export function generateSuggestions(args: {
  userText: string;
  assistantText: string;
  workspaceId: string;
  lastToolMessages?: ToolMessage[];
}): Suggestion[] {
  const { userText, assistantText, workspaceId, lastToolMessages } = args;
  const combined = `${userText} ${assistantText}`;

  const suggestions: Suggestion[] = [];

  // ── L+3: Runtime-aware enrichment ────────────────────────────────────────
  // Check recent tool messages for failures before signal-word logic so that
  // runtime failures always surface Doctor + Runs regardless of text content.
  let hasToolFailure = false;
  let hasDoctorWarnFail = false;

  if (lastToolMessages && lastToolMessages.length > 0) {
    for (const tm of lastToolMessages) {
      if (tm.status === 'error') {
        hasToolFailure = true;
      }
      if (tm.toolName === 'doctor' && tm.status === 'success') {
        // Check if doctor report contains WARN or FAIL signals
        const reportStr =
          typeof tm.output === 'string'
            ? tm.output
            : JSON.stringify(tm.output ?? '');
        if (/warn|fail/i.test(reportStr)) {
          hasDoctorWarnFail = true;
        }
      }
    }
  }

  // Inject Doctor + Open Runs on tool failure (L+3)
  if (hasToolFailure) {
    suggestions.push(chip({
      id: 'runDoctor::',
      kind: 'runDoctor',
      title: 'Run Doctor',
      detail: 'Diagnose environment issues in this workspace',
    }));
    suggestions.push(chip({
      id: 'openPane::runs',
      kind: 'openPane',
      title: 'Open Runs tab',
      detail: 'View runtime event log for this workspace',
      pane: 'runs',
    }));
  }

  // Inject Open Runs + Open Artifacts on doctor WARN/FAIL (L+3)
  if (hasDoctorWarnFail) {
    if (!suggestions.some((s) => s.id === 'openPane::runs')) {
      suggestions.push(chip({
        id: 'openPane::runs',
        kind: 'openPane',
        title: 'Open Runs tab',
        detail: 'View runtime event log for this workspace',
        pane: 'runs',
      }));
    }
    if (!suggestions.some((s) => s.id === 'openPane::artifacts')) {
      suggestions.push(chip({
        id: 'openPane::artifacts',
        kind: 'openPane',
        title: 'Open Artifacts tab',
        detail: 'View artifacts for this workspace',
        pane: 'artifacts',
      }));
    }
  }

  // ── Signal-word suggestions (only if not already at max 4) ───────────────

  // ── Run Doctor ────────────────────────────────────────────────────────────
  if (
    suggestions.length < 4 &&
    !suggestions.some((s) => s.id === 'runDoctor::') &&
    includes(combined, DOCTOR_SIGNALS)
  ) {
    suggestions.push(chip({
      id: 'runDoctor::',
      kind: 'runDoctor',
      title: 'Run Doctor',
      detail: 'Diagnose environment issues in this workspace',
    }));
  }

  // ── Run Pipewrench ────────────────────────────────────────────────────────
  if (suggestions.length < 4 && includes(combined, PIPEWRENCH_SIGNALS)) {
    suggestions.push(chip({
      id: 'runTool:pipewrench:',
      kind: 'runTool',
      title: 'Run Pipewrench Diagnose',
      detail: 'Probe network / MCP connectivity',
      toolName: 'pipewrench',
      input: { probe: 'network' },
    }));
  }

  // ── Open Runs tab ─────────────────────────────────────────────────────────
  if (
    suggestions.length < 4 &&
    !suggestions.some((s) => s.id === 'openPane::runs') &&
    includes(combined, RUNS_SIGNALS)
  ) {
    suggestions.push(chip({
      id: 'openPane::runs',
      kind: 'openPane',
      title: 'Open Runs tab',
      detail: 'View runtime event log for this workspace',
      pane: 'runs',
    }));
  }

  // ── Open Command Palette ──────────────────────────────────────────────────
  if (suggestions.length < 4 && includes(combined, PALETTE_SIGNALS)) {
    suggestions.push(chip({
      id: 'openCommandPalette::',
      kind: 'openCommandPalette',
      title: 'Open Command Palette',
      detail: 'Browse all available commands (Ctrl+K)',
    }));
  }

  // Limit to max 4
  const limited = suggestions.slice(0, 4);

  if (limited.length === 0) return [];

  // ── Cooldown check ────────────────────────────────────────────────────────
  const hash = hashSuggestions(limited);
  const prev = cooldownByWorkspace.get(workspaceId);
  if (prev && prev.hash === hash && Date.now() - prev.ts < COOLDOWN_MS) {
    // Identical suggestions generated too recently — skip (return existing)
    return limited; // still return them so the message can be updated on first call
  }
  cooldownByWorkspace.set(workspaceId, { hash, ts: Date.now() });

  return limited;
}
