/**
 * Pappy — rule-based supervisor that reacts to runtime events.
 *
 * Pappy is NOT a model. He's a set of if/then rules that fire when
 * something goes wrong: tool failures, verification failures, doctor
 * warnings. He keeps it short, blunt, and helpful.
 *
 * All functions are pure — no side effects. The SupervisorBridge
 * decides when and where to post Pappy's messages.
 */

import type { RuntimeEvent } from '../types/runtimeEvents';

// ============================================================================
// DOCTOR REPORT PARSING (best-effort, type-guarded)
// ============================================================================

interface DoctorCheck {
  name: string;
  status: string;
}

interface ParsedDoctorReport {
  pass: number;
  warn: number;
  fail: number;
  failingChecks: string[];
}

/**
 * Best-effort parse of an unknown doctor report shape.
 * Returns null if the shape is unrecognizable.
 */
function parseDoctorReport(report: unknown): ParsedDoctorReport | null {
  if (typeof report !== 'object' || report === null) return null;

  const r = report as Record<string, unknown>;
  const pass = typeof r.pass === 'number' ? r.pass : 0;
  const warn = typeof r.warn === 'number' ? r.warn : 0;
  const fail = typeof r.fail === 'number' ? r.fail : 0;

  const failingChecks: string[] = [];

  // Try to extract individual check names from a `checks` or `results` array
  const checksArr = Array.isArray(r.checks) ? r.checks : Array.isArray(r.results) ? r.results : null;
  if (checksArr) {
    for (const item of checksArr) {
      if (typeof item === 'object' && item !== null) {
        const check = item as DoctorCheck;
        if (typeof check.status === 'string' && (check.status === 'WARN' || check.status === 'FAIL')) {
          if (typeof check.name === 'string') {
            failingChecks.push(check.name);
          }
        }
      }
    }
  }

  return { pass, warn, fail, failingChecks };
}

// ============================================================================
// RULES
// ============================================================================

/**
 * Should Pappy speak in response to this event?
 */
export function shouldSpeak(evt: RuntimeEvent): boolean {
  switch (evt.type) {
    case 'tool:failed':
      return true;

    case 'tool:verified':
      return !evt.ok;

    case 'doctor:run': {
      const parsed = parseDoctorReport(evt.report);
      if (!parsed) return true; // unknown shape — flag it
      return parsed.warn > 0 || parsed.fail > 0;
    }

    default:
      return false;
  }
}

/**
 * Build the message body Pappy will post into the chat.
 * Short, blunt, country-mechanic style. 1–3 sentences max.
 */
export function buildMessage(evt: RuntimeEvent): string {
  switch (evt.type) {
    case 'tool:failed':
      return `Pappy: Hear that clunk? There's your problem: ${evt.error}. Give it another go or run /doctor to dig deeper.`;

    case 'tool:verified':
      if (!evt.ok) {
        return `Pappy: That tool ran, but something ain't right — verification failed on "${evt.toolName}". Try checking the input or run /doctor.`;
      }
      return '';

    case 'doctor:run': {
      const parsed = parseDoctorReport(evt.report);
      if (!parsed) {
        return 'Pappy: Doctor found some issues. Open Runs to see details.';
      }

      const parts: string[] = [];
      if (parsed.fail > 0) {
        parts.push(`${parsed.fail} failing`);
      }
      if (parsed.warn > 0) {
        parts.push(`${parsed.warn} warning${parsed.warn > 1 ? 's' : ''}`);
      }
      const summary = parts.join(', ');

      if (parsed.failingChecks.length > 0) {
        const top = parsed.failingChecks.slice(0, 3).join(', ');
        return `Pappy: Doctor came back with ${summary}. Top issues: ${top}. Check the Runs tab for the full report.`;
      }

      return `Pappy: Doctor came back with ${summary}. Check the Runs tab for the full report.`;
    }

    default:
      return '';
  }
}

/**
 * Optional suggested action to include in the message.
 * Returns null if no specific action is warranted.
 */
export function suggestedAction(evt: RuntimeEvent): string | null {
  switch (evt.type) {
    case 'tool:failed':
      return '/doctor';
    case 'tool:verified':
      return !evt.ok ? '/doctor' : null;
    case 'doctor:run':
      return null; // doctor was already run
    default:
      return null;
  }
}
