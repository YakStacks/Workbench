/**
 * commandParser — parse slash commands typed in the chat composer.
 *
 * Returns a ParsedCommand discriminated union.
 * Normal messages (not starting with /) return { kind: "unknown", raw }.
 * "unknown" is not an error — it means: treat as a plain chat message.
 *
 * No regex complexity. No side effects. Pure function.
 */

export type ParsedCommand =
  | { kind: 'doctor' }
  | { kind: 'tool'; toolName: string; input?: unknown; jsonParseError?: true }
  | { kind: 'help' }
  | { kind: 'unknown'; raw: string };

/**
 * Parse a chat input string into a typed command.
 *
 * Examples:
 *   "/doctor"                    → { kind: "doctor" }
 *   "/help"                      → { kind: "help" }
 *   "/tool echo"                 → { kind: "tool", toolName: "echo" }
 *   '/tool echo {"x":1}'         → { kind: "tool", toolName: "echo", input: {x:1} }
 *   '/tool echo bad json'        → { kind: "tool", toolName: "echo", input: "bad json", jsonParseError: true }
 *   "hello world"                → { kind: "unknown", raw: "hello world" }
 */
export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();

  if (!trimmed.startsWith('/')) {
    return { kind: 'unknown', raw: trimmed };
  }

  // Split on first whitespace run to get the command token
  const spaceIdx = trimmed.indexOf(' ');
  const token = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const rest = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

  switch (token.toLowerCase()) {
    case '/doctor':
      return { kind: 'doctor' };

    case '/help':
      return { kind: 'help' };

    case '/tool': {
      if (!rest) {
        // "/tool" with no arguments — treat as echo with no input
        return { kind: 'tool', toolName: 'echo' };
      }

      // Split rest into toolName + optional JSON segment
      const toolSpaceIdx = rest.indexOf(' ');
      const toolName = toolSpaceIdx === -1 ? rest : rest.slice(0, toolSpaceIdx);
      const inputStr = toolSpaceIdx === -1 ? '' : rest.slice(toolSpaceIdx + 1).trim();

      if (!inputStr) {
        return { kind: 'tool', toolName };
      }

      // Attempt JSON parse only if segment looks like JSON
      if (inputStr.startsWith('{') || inputStr.startsWith('[')) {
        try {
          const input = JSON.parse(inputStr) as unknown;
          return { kind: 'tool', toolName, input };
        } catch {
          // Parse failed — pass as raw string and flag the error
          return { kind: 'tool', toolName, input: inputStr, jsonParseError: true };
        }
      }

      // Non-JSON remainder — treat as raw string input
      return { kind: 'tool', toolName, input: inputStr };
    }

    default:
      // Unknown slash command — surface as a plain unknown so ButlerChatView
      // can respond with a hint rather than silently dropping the message.
      return { kind: 'unknown', raw: trimmed };
  }
}
