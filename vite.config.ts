import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Root Vite config — serves/builds the Workbench Shell renderer.
//
// Vite root is set to packages/workbench-shell so it uses that package's
// index.html and src/renderer/index.tsx as the entry point.
// All aliases are resolved from the monorepo root (__dirname here).
// Build output goes to root dist/ so the existing Electron main.ts and
// electron-builder config work without modification.
export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'packages/workbench-shell'),
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
