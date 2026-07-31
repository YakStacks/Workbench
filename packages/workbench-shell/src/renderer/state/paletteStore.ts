/**
 * Palette Store — ephemeral UI state for the Command Palette.
 *
 * Not persisted to disk or localStorage.
 *
 * Stability Sprint: focus is saved on open() and restored on close()
 * so keyboard navigation returns to the previously focused element.
 */

import { create } from 'zustand';

interface PaletteState {
  isOpen: boolean;
  query: string;
  activeIndex: number;

  open(): void;
  close(): void;
  setQuery(q: string): void;
  setActiveIndex(i: number): void;
}

// Module-level ref — not part of Zustand state (no re-renders needed).
let _previousFocus: Element | null = null;

export const usePaletteStore = create<PaletteState>((set) => ({
  isOpen: false,
  query: '',
  activeIndex: 0,

  open: () => {
    // Capture focused element before the palette input steals focus
    _previousFocus = document.activeElement;
    set({ isOpen: true, query: '', activeIndex: 0 });
  },

  close: () => {
    set({ isOpen: false, query: '', activeIndex: 0 });
    // Restore focus to the element that was active before the palette opened
    if (_previousFocus && typeof (_previousFocus as HTMLElement).focus === 'function') {
      (_previousFocus as HTMLElement).focus();
    }
    _previousFocus = null;
  },

  setQuery: (q) => set({ query: q, activeIndex: 0 }),
  setActiveIndex: (i) => set({ activeIndex: i }),
}));
