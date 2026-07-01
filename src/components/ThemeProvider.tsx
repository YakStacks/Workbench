import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'midnight';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  cycleTheme: () => {},
});

const STORAGE_KEY = 'workbench-theme';
const THEMES: Theme[] = ['light', 'dark', 'midnight'];

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.includes(stored as Theme)) {
      return stored as Theme;
    }
  } catch {}
  return 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  }, [theme, setTheme]);

  // Apply on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const icons: Record<Theme, string> = {
    light: '\u2600',   // sun
    dark: '\u263E',     // moon
    midnight: '\u2726', // star
  };

  return (
    <div className="theme-toggle">
      {THEMES.map(t => (
        <button
          key={t}
          className={`theme-toggle-btn${theme === t ? ' active' : ''}`}
          onClick={() => setTheme(t)}
          title={t.charAt(0).toUpperCase() + t.slice(1)}
        >
          {icons[t]}
        </button>
      ))}
    </div>
  );
}
