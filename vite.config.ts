import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Root Vite config — serves/builds the Workbench Shell renderer.
//
// MAILMAN TEST BUILD: root is temporarily pointed at the classic src/App.tsx
// UI (the 2.0.0-dev Chains UI) so the chain:run IPC handler can be exercised
// interactively. Switch root back to 'packages/workbench-shell' for the
// Maestro shell build.
export default defineConfig({
  plugins: [react()],
  root: __dirname,
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      // Sub-path Core aliases (specific before barrel — Vite first-match wins)
      '@workbench/core/events': resolve(__dirname, 'src/core/events.ts'),
      '@workbench/core/runner': resolve(__dirname, 'src/core/runner.ts'),
      '@workbench/core': resolve(__dirname, 'src/core/index.ts'),
      // Shell sub-path aliases (used by /apps/*)
      '@workbench/shell/types': resolve(__dirname, 'packages/workbench-shell/src/types.ts'),
      '@workbench/shell/runtime': resolve(__dirname, 'packages/workbench-shell/src/runtime/runtimeContext.ts'),
      // Per-app aliases
      '@workbench-apps/maestro': resolve(__dirname, 'apps/maestro/index.tsx'),
      '@workbench-apps/butler': resolve(__dirname, 'apps/butler/index.tsx'),
      '@workbench-apps/pipewrench': resolve(__dirname, 'apps/pipewrench/index.tsx'),
    },
  },
  server: {
    port: 5173, // matches main.ts dev loadURL
  },
});
