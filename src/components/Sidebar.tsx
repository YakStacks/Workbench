import React from 'react';
import { ThemeToggle } from './ThemeProvider';

export type SidebarView =
  | 'chat'
  | 'tools'
  | 'assets'
  | 'runs'
  | 'doctor'
  | 'settings'
  | 'files'
  | 'chains'
  | 'mcp';

interface SidebarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  onNewChat: () => void;
}

const NAV_ITEMS: { view: SidebarView; icon: string; label: string }[] = [
  { view: 'chat', icon: '\u{1F4AC}', label: 'Chat' },
  { view: 'tools', icon: '\u{1F527}', label: 'Tools' },
  { view: 'assets', icon: '\u{1F4CE}', label: 'Assets' },
  { view: 'runs', icon: '\u25B6\uFE0F', label: 'Runs' },
  { view: 'doctor', icon: '\u{1FA7A}', label: 'Doctor' },
];

const MORE_ITEMS: { view: SidebarView; icon: string; label: string }[] = [
  { view: 'files', icon: '\u{1F4C2}', label: 'Files' },
  { view: 'chains', icon: '\u26D3\uFE0F', label: 'Chains' },
  { view: 'mcp', icon: '\u{1F50C}', label: 'MCP' },
  { view: 'settings', icon: '\u2699\uFE0F', label: 'Settings' },
];

export function Sidebar({ activeView, onViewChange, onNewChat }: SidebarProps) {
  return (
    <nav className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <span style={{ fontSize: 18 }}>{'\u2692\uFE0F'}</span>
        Workbench
      </div>

      {/* New Chat button */}
      <div style={{ padding: '0 10px 4px' }}>
        <button
          className="sidebar-item"
          onClick={onNewChat}
          style={{
            background: 'var(--accent-muted)',
            color: 'var(--accent)',
            justifyContent: 'center',
            fontWeight: 600,
          }}
        >
          + New Chat
        </button>
      </div>

      {/* Main navigation */}
      <div className="sidebar-section">
        <div className="sidebar-label">Navigation</div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.view}
            className={`sidebar-item${activeView === item.view ? ' active' : ''}`}
            onClick={() => onViewChange(item.view)}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </button>
        ))}

        <div className="sidebar-label">More</div>
        {MORE_ITEMS.map(item => (
          <button
            key={item.view}
            className={`sidebar-item${activeView === item.view ? ' active' : ''}`}
            onClick={() => onViewChange(item.view)}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Footer with theme toggle */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
