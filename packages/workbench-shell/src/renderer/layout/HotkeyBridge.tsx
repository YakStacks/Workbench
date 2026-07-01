/**
 * HotkeyBridge — global keyboard shortcut listener.
 *
 * Mounts once in ShellLayout (null-rendering, pure side-effect).
 * Opens the Command Palette on Ctrl+K (Windows/Linux) or Cmd+K (macOS).
 *
 * Works even when an input/textarea is focused (like VS Code).
 * Does not steal any other keystrokes.
 */

import React from 'react';
import { usePaletteStore } from '../state/paletteStore';

export function HotkeyBridge(): null {
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        usePaletteStore.getState().open();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
}
