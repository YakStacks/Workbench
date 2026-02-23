/**
 * Export Formatters — convert Artifact to various text formats for clipboard export.
 *
 * - Markdown: structured with title, kind, and fenced code block for json
 * - JSON: pretty-printed JSON string (only for json kind)
 * - Plain text: raw content
 *
 * No dependencies.
 */

import type { Artifact } from '../types/artifacts';

/**
 * Format artifact as Markdown.
 * JSON kind content is wrapped in a fenced code block.
 */
export function artifactToMarkdown(a: Artifact): string {
  const lines: string[] = [];
  lines.push(`# ${a.title}`);
  lines.push('');
  lines.push(`Kind: ${a.kind}`);
  lines.push('');

  if (a.kind === 'json') {
    lines.push('```json');
    lines.push(a.content);
    lines.push('```');
  } else {
    lines.push(a.content);
  }

  return lines.join('\n');
}

/**
 * Format artifact as pretty JSON string.
 * Returns null if the artifact is not json kind or content is not valid JSON.
 */
export function artifactToJsonString(a: Artifact): string | null {
  if (a.kind !== 'json') return null;

  try {
    // Re-parse and re-stringify for consistent pretty printing
    const parsed: unknown = JSON.parse(a.content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // Content is not valid JSON — return as-is if it looks like JSON
    if (a.content.trim().startsWith('{') || a.content.trim().startsWith('[')) {
      return a.content;
    }
    return null;
  }
}

/**
 * Format artifact as plain text.
 */
export function artifactToPlainText(a: Artifact): string {
  return a.content;
}
