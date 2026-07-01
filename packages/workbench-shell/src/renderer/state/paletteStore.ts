/**
 * Palette Store — ephemeral UI state for the Command Palette.
 *
 * Not persisted to disk or localStorage.
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

export const usePaletteStore = create<PaletteState>((set) => ({
  isOpen: false,
  query: '',
  activeIndex: 0,

  open: () => set({ isOpen: true, query: '', activeIndex: 0 }),
  close: () => set({ isOpen: false, query: '', activeIndex: 0 }),
  setQuery: (q) => set({ query: q, activeIndex: 0 }),
  setActiveIndex: (i) => set({ activeIndex: i }),
}));
