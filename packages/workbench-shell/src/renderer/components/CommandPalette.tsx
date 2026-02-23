/**
 * CommandPalette — VS Code/Raycast-style overlay command palette.
 *
 * Opens via Ctrl+K / Cmd+K (handled by HotkeyBridge).
 * Closes on Esc or backdrop click.
 *
 * Features:
 *   - Autofocused input with 75ms debounced filtering
 *   - Scope prefixes: > commands  # templates  @ workspaces  ! artifacts  ? help
 *   - Category group headers
 *   - ArrowUp/Down navigation, Enter to confirm
 *   - Mouse click to confirm
 *   - Sensible default items when query is empty
 *
 * No external dependencies. All styles inline (React.CSSProperties).
 */

import React from 'react';
import { usePaletteStore } from '../state/paletteStore';
import { getPaletteItems, getDefaultPaletteItems } from '../palette/getPaletteItems';
import type { PaletteItem, PaletteCategory } from '../types/palette';

// ============================================================================
// SCOPE PREFIX PARSING
// ============================================================================

const SCOPE_CHARS = new Set(['>', '#', '@', '!', '?']);

type PaletteScope = '>' | '#' | '@' | '!' | '?' | null;

interface ParsedQuery {
  scope: PaletteScope;
  effectiveQuery: string;
}

function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  const firstChar = trimmed[0];
  if (firstChar !== undefined && SCOPE_CHARS.has(firstChar)) {
    return {
      scope: firstChar as '>' | '#' | '@' | '!' | '?',
      effectiveQuery: trimmed.slice(1).trim(),
    };
  }
  return { scope: null, effectiveQuery: trimmed };
}

const SCOPE_CATEGORY_MAP: Record<'>' | '#' | '@' | '!', PaletteCategory> = {
  '>': 'Commands',
  '#': 'Templates',
  '@': 'Workspaces',
  '!': 'Artifacts',
};

const HELP_ITEM: PaletteItem = {
  id: 'help:scopes',
  category: 'Commands',
  title: 'Command Palette Shortcuts',
  subtitle: '> commands  # templates  @ workspaces  ! artifacts  ? help',
  keywords: ['help', 'scope', 'shortcuts', 'prefix'],
  action: () => { /* no-op — informational */ },
};

// ============================================================================
// STYLES
// ============================================================================

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '12vh',
  },
  modal: {
    width: '100%',
    maxWidth: 560,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    maxHeight: '60vh',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #2a2a2a',
    color: '#e0e0e0',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  },
  hint: {
    padding: '4px 16px 6px',
    fontSize: 11,
    color: '#555',
    borderBottom: '1px solid #1e1e1e',
    letterSpacing: '0.02em',
  },
  scopeHint: {
    padding: '4px 16px 6px',
    fontSize: 11,
    color: '#444',
    borderBottom: '1px solid #1e1e1e',
    letterSpacing: '0.02em',
    fontFamily: 'monospace',
  },
  scopeActive: {
    padding: '4px 16px 6px',
    fontSize: 11,
    color: '#4a9eff',
    borderBottom: '1px solid #1e1e1e',
    letterSpacing: '0.02em',
    fontFamily: 'monospace',
  },
  list: {
    overflowY: 'auto',
    flex: 1,
  },
  categoryHeader: {
    padding: '8px 16px 4px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: '#555',
  },
  item: {
    padding: '8px 16px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    borderLeft: '2px solid transparent',
  },
  itemActive: {
    background: '#252525',
    borderLeft: '2px solid #4a9eff',
  },
  itemTitle: {
    fontSize: 13,
    color: '#e0e0e0',
  },
  itemSubtitle: {
    fontSize: 11,
    color: '#666',
  },
  empty: {
    padding: '24px 16px',
    textAlign: 'center' as const,
    color: '#555',
    fontSize: 13,
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [
      item.title,
      item.subtitle ?? '',
      ...(item.keywords ?? []),
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

function groupByCategory(items: PaletteItem[]): Map<PaletteCategory, PaletteItem[]> {
  const map = new Map<PaletteCategory, PaletteItem[]>();
  for (const item of items) {
    const group = map.get(item.category) ?? [];
    group.push(item);
    map.set(item.category, group);
  }
  return map;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CommandPalette(): React.ReactElement | null {
  const { isOpen, query, activeIndex, close, setQuery, setActiveIndex } = usePaletteStore();

  // Debounce ref
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Input value (local, pre-debounce)
  const [inputValue, setInputValue] = React.useState('');

  // Sync inputValue when palette opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  // Parse scope prefix from query
  const { scope, effectiveQuery } = React.useMemo(() => parseQuery(query), [query]);

  // Build + filter items
  const allItems = React.useMemo(() => {
    if (!isOpen) return [];
    return getPaletteItems();
  }, [isOpen]);

  const filteredItems = React.useMemo((): PaletteItem[] => {
    if (!isOpen) return [];

    // ? scope → show help item
    if (scope === '?') {
      const filtered = filterItems([HELP_ITEM, ...allItems], effectiveQuery);
      return filtered;
    }

    // Category scope (>, #, @, !)
    if (scope !== null) {
      const targetCategory = SCOPE_CATEGORY_MAP[scope];
      const scopedItems = allItems.filter((i) => i.category === targetCategory);
      return filterItems(scopedItems, effectiveQuery);
    }

    // No scope + empty query → defaults
    if (!query.trim()) return getDefaultPaletteItems();

    // No scope + non-empty → filter all
    return filterItems(allItems, effectiveQuery);
  }, [isOpen, query, scope, effectiveQuery, allItems]);

  // Clamp activeIndex when list changes
  React.useEffect(() => {
    if (filteredItems.length === 0) {
      setActiveIndex(0);
    } else {
      setActiveIndex(Math.min(activeIndex, filteredItems.length - 1));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems.length]);

  const runItem = React.useCallback((item: PaletteItem) => {
    close();
    try {
      void item.action();
    } catch (err) {
      console.warn('[CommandPalette] action error:', err);
    }
  }, [close]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(Math.min(activeIndex + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(Math.max(activeIndex - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[activeIndex]) {
          runItem(filteredItems[activeIndex]);
        }
        break;
    }
  }, [activeIndex, filteredItems, close, setActiveIndex, runItem]);

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    // Debounce store update
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(val);
    }, 75);
  }, [setQuery]);

  if (!isOpen) return null;

  const grouped = groupByCategory(filteredItems);

  // Flat index counter for active highlighting across groups
  let flatIndex = 0;

  // Determine scope hint text and style
  const scopeLabel = scope !== null
    ? scope === '>'
      ? '> commands'
      : scope === '#'
      ? '# templates'
      : scope === '@'
      ? '@ workspaces'
      : scope === '!'
      ? '! artifacts'
      : '? help'
    : null;

  return (
    <div
      style={s.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        style={s.modal}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <input
          style={s.input}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          placeholder="Type a command or search…"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
        />

        {/* Hint bar — shows active scope or general shortcuts */}
        {scopeLabel !== null ? (
          <div style={s.scopeActive}>Scope: {scopeLabel} &middot; Esc clear scope</div>
        ) : (
          <div style={s.hint}>↑↓ navigate &middot; Enter select &middot; Esc close &middot; Scopes: <span style={{ fontFamily: 'monospace' }}>&gt; # @ ! ?</span></div>
        )}

        {/* Scope reference line (always visible, dimmer) */}
        {scopeLabel === null && (
          <div style={s.scopeHint}>&gt; commands &nbsp;&nbsp; # templates &nbsp;&nbsp; @ workspaces &nbsp;&nbsp; ! artifacts &nbsp;&nbsp; ? help</div>
        )}

        {/* Results */}
        <div style={s.list}>
          {filteredItems.length === 0 ? (
            <div style={s.empty}>No results for &ldquo;{inputValue}&rdquo;</div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <div style={s.categoryHeader}>{category}</div>
                {items.map((item) => {
                  const idx = flatIndex++;
                  const isActive = idx === activeIndex;
                  return (
                    <div
                      key={item.id}
                      style={{ ...s.item, ...(isActive ? s.itemActive : {}) }}
                      onMouseDown={() => runItem(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <span style={s.itemTitle}>{item.title}</span>
                      {item.subtitle && (
                        <span style={s.itemSubtitle}>{item.subtitle}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
