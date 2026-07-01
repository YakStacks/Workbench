/**
 * Clipboard Utility — copy text to clipboard with fallback.
 *
 * Tries navigator.clipboard.writeText first.
 * Falls back to hidden textarea + execCommand('copy') for older browsers.
 * Returns true on success, false on failure.
 * No dependencies.
 */

export async function copyText(text: string): Promise<boolean> {
  // Modern API
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy fallback
    }
  }

  // Legacy fallback
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
