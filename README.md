# Workbench

A minimal Electron + Vite + React + TypeScript desktop app for task running, model config, and plugin tools.

## Features
- Tabs: Tasks, Models, Plugins
- All network/API key access via main process IPC
- Plugin system (see ./plugins)

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```
2. Start Vite dev server:
   ```
   npm run dev
   ```
3. In another terminal, start Electron:
   ```
   npm start
   ```

## Plugin Example
See ./plugins/asamPromptBuilder for a sample plugin.

## Notes
- No auto-updates, marketplace, or complex styling.
- Config is stored locally using electron-store.
