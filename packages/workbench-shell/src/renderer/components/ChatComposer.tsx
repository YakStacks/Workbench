/**
 * ChatComposer — bottom input bar for chat workspaces.
 *
 * - Textarea: Enter sends, Shift+Enter inserts newline.
 * - Send button disabled when input is empty/whitespace.
 * - Auto-resizes up to ~5 lines then scrolls.
 * - Tool Picker button (left of Send) opens an inline popover with
 *   pre-built command snippets. Selecting one inserts the command text.
 *   Escape or click-outside closes the picker.
 */

import React from 'react';

// ============================================================================
// TOOL PICKER DATA
// ============================================================================

interface ToolPickerItem {
  label: string;
  description: string;
  insert: string;
}

const TOOL_PICKER_ITEMS: ToolPickerItem[] = [
  { label: '/doctor', description: 'Run workspace diagnostics', insert: '/doctor' },
  { label: '/tool echo', description: 'Echo a payload back', insert: '/tool echo {"message":"hello"}' },
  { label: '/tool pipewrench', description: 'Run Pipewrench probes', insert: '/tool pipewrench {"probe":"network"}' },
  { label: '/help', description: 'List available commands', insert: '/help' },
];

// ============================================================================
// TYPES
// ============================================================================

interface ChatComposerProps {
  placeholder?: string;
  onSend(text: string): void;
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  composerRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    padding: '10px 16px 14px',
    borderTop: '1px solid #1a1a1a',
    background: '#0d0d0d',
    position: 'relative',
  },
  textarea: {
    flex: 1,
    background: '#151515',
    border: '1px solid #222',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 13,
    color: '#d0d0d0',
    outline: 'none',
    resize: 'none',
    lineHeight: 1.5,
    minHeight: 38,
    maxHeight: 130,
    overflowY: 'auto',
    fontFamily: 'inherit',
  },
  toolsBtn: {
    flexShrink: 0,
    padding: '0 10px',
    height: 38,
    background: '#111',
    border: '1px solid #222',
    borderRadius: 8,
    color: '#555',
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'color 0.1s, border-color 0.1s',
  },
  toolsBtnActive: {
    color: '#8b6fde',
    borderColor: '#3a2a6a',
  },
  sendBtn: {
    flexShrink: 0,
    padding: '8px 16px',
    background: '#1e2a3a',
    border: '1px solid #2a3f5a',
    borderRadius: 8,
    color: '#4d9fff',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    height: 38,
    transition: 'opacity 0.15s',
  },
  sendBtnDisabled: {
    opacity: 0.35,
    cursor: 'default',
  },
  // Popover
  popover: {
    position: 'absolute',
    bottom: 'calc(100% + 4px)',
    left: 16,
    background: '#161616',
    border: '1px solid #252525',
    borderRadius: 10,
    padding: '6px 0',
    minWidth: 260,
    zIndex: 100,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  popoverHeader: {
    fontSize: 10,
    color: '#3a3a3a',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '4px 14px 6px',
  },
  popoverItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    padding: '8px 14px',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  popoverItemLabel: {
    fontSize: 12,
    color: '#c0c0c0',
    fontFamily: 'monospace',
  },
  popoverItemDesc: {
    fontSize: 11,
    color: '#444',
  },
};

// ============================================================================
// TOOL PICKER POPOVER
// ============================================================================

interface ToolPickerPopoverProps {
  onSelect(insert: string): void;
  onClose(): void;
}

function ToolPickerPopover({ onSelect, onClose }: ToolPickerPopoverProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = React.useState<number | null>(null);

  // Close on click-outside
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div ref={ref} style={styles.popover} role="listbox" aria-label="Tool picker">
      <div style={styles.popoverHeader}>Commands</div>
      {TOOL_PICKER_ITEMS.map((item, i) => (
        <div
          key={item.insert}
          role="option"
          aria-selected={hovered === i}
          style={{
            ...styles.popoverItem,
            background: hovered === i ? '#1e1e1e' : 'transparent',
          }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent textarea blur
            onSelect(item.insert);
          }}
        >
          <span style={styles.popoverItemLabel}>{item.label}</span>
          <span style={styles.popoverItemDesc}>{item.description}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ChatComposer({ placeholder = 'Type a message…', onSend }: ChatComposerProps): React.ReactElement {
  const [value, setValue] = React.useState('');
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const isEmpty = value.trim().length === 0;

  function handleSend() {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue('');
    setPickerOpen(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 130)}px`;
  }

  function handlePickerSelect(insert: string) {
    setValue(insert);
    setPickerOpen(false);
    // Focus textarea after inserting
    setTimeout(() => {
      textareaRef.current?.focus();
      // Place cursor at end
      const len = insert.length;
      textareaRef.current?.setSelectionRange(len, len);
    }, 0);
  }

  const btnStyle: React.CSSProperties = isEmpty
    ? { ...styles.sendBtn, ...styles.sendBtnDisabled }
    : styles.sendBtn;

  const toolsBtnStyle: React.CSSProperties = pickerOpen
    ? { ...styles.toolsBtn, ...styles.toolsBtnActive }
    : styles.toolsBtn;

  return (
    <div style={styles.composerRow}>
      {pickerOpen && (
        <ToolPickerPopover
          onSelect={handlePickerSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Tool picker toggle */}
      <button
        style={toolsBtnStyle}
        onClick={() => setPickerOpen((v) => !v)}
        aria-label="Open tool picker"
        aria-expanded={pickerOpen}
        title="Tool commands"
      >
        <span style={{ fontSize: 14 }}>⚡</span>
        <span>Tools</span>
      </button>

      <textarea
        ref={textareaRef}
        style={styles.textarea}
        value={value}
        placeholder={placeholder}
        rows={1}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-label="Message input"
      />
      <button
        style={btnStyle}
        onClick={handleSend}
        disabled={isEmpty}
        aria-label="Send message"
      >
        Send
      </button>
    </div>
  );
}
