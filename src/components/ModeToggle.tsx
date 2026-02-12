import React from 'react';

export type ExecutionMode = 'read-only' | 'propose' | 'execute';

interface ModeToggleProps {
  mode: ExecutionMode;
  onChange: (mode: ExecutionMode) => void;
}

const MODES: { value: ExecutionMode; label: string }[] = [
  { value: 'read-only', label: 'Read' },
  { value: 'propose', label: 'Propose' },
  { value: 'execute', label: 'Execute' },
];

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="mode-toggle" title="Execution mode">
      {MODES.map(m => (
        <button
          key={m.value}
          className={`mode-toggle-btn ${m.value}${mode === m.value ? ' active' : ''}`}
          onClick={() => onChange(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
