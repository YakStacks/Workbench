import React from 'react';
import type { SidebarView } from './Sidebar';

interface SuggestionChipsProps {
  activeView: SidebarView;
  hasAssets: boolean;
  hasTools: boolean;
  onChipClick: (action: string) => void;
}

interface Chip {
  label: string;
  action: string;
}

const BASE_CHIPS: Chip[] = [
  { label: 'System Info', action: '/builtin.systemInfo' },
  { label: 'Clipboard', action: '/builtin.clipboardRead' },
];

const ASSET_CHIPS: Chip[] = [
  { label: 'Upload PDF', action: 'upload' },
  { label: 'Analyze Asset', action: '/builtin.analyzeAsset' },
];

const TOOL_CHIPS: Chip[] = [
  { label: 'Read File', action: '/builtin.readFile' },
  { label: 'List Directory', action: '/builtin.listDir' },
  { label: 'Write File', action: '/builtin.writeFile' },
];

function getChipsForView(view: SidebarView, hasAssets: boolean, hasTools: boolean): Chip[] {
  const chips: Chip[] = [];

  if (view === 'chat') {
    chips.push(...BASE_CHIPS);
    if (hasAssets) chips.push({ label: 'Analyze Asset', action: '/builtin.analyzeAsset' });
    if (hasTools) chips.push(...TOOL_CHIPS.slice(0, 2));
    chips.push(...ASSET_CHIPS.slice(0, 1));
  } else if (view === 'assets') {
    chips.push(...ASSET_CHIPS);
  } else if (view === 'tools') {
    chips.push(...TOOL_CHIPS);
  } else if (view === 'doctor') {
    chips.push({ label: 'Run Diagnostics', action: 'doctor:run' });
    chips.push({ label: 'Export Report', action: 'doctor:export' });
  }

  return chips.slice(0, 6);
}

export function SuggestionChips({ activeView, hasAssets, hasTools, onChipClick }: SuggestionChipsProps) {
  const chips = getChipsForView(activeView, hasAssets, hasTools);
  if (chips.length === 0) return null;

  return (
    <div className="suggestion-chips">
      {chips.map(chip => (
        <button
          key={chip.action}
          className="suggestion-chip"
          onClick={() => onChipClick(chip.action)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
