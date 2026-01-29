# Workbench

A minimal Electron + Vite + React + TypeScript desktop app for task running, model config, and plugin tools.

## Features
- Tabs: Tasks, Models, Plugins
- All network/API key access via main process IPC
- Plugin system (see ./plugins)

## Getting Started


## Usage

- **Dev mode:**
  ```
  npm run dev
  ```
  (Starts both Vite and Electron for live development)

- **Production build:**
  ```
  npm run build && npm run start
  ```
  (Builds static assets and launches Electron with production bundle)

## Plugin Example
See ./plugins/asamPromptBuilder for a sample plugin.

## Notes
- No auto-updates, marketplace, or complex styling.
- Config is stored locally using electron-store.
