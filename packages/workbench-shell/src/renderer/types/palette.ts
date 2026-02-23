/**
 * Command Palette — type definitions.
 */

export type PaletteCategory = 'Templates' | 'Commands' | 'Workspaces' | 'Artifacts';

export interface PaletteItem {
  id: string;
  category: PaletteCategory;
  title: string;
  subtitle?: string;
  /** Extra strings included in match scoring. */
  keywords?: string[];
  action(): Promise<void> | void;
}
