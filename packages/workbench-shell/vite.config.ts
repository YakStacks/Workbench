import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Workbench Shell — renderer build config
// Core is resolved via path alias; no Core source is bundled into Shell.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Core sub-path imports — specific before barrel (Vite first-match wins)
      '@workbench/core/events': resolve(__dirname, '../../src/core/events.ts'),
      '@workbench/core/runner': resolve(__dirname, '../../src/core/runner.ts'),
      '@workbench/core': resolve(__dirname, '../../src/core/index.ts'),
      // Shell sub-path aliases for use by apps in /apps/*
      '@workbench/shell/types': resolve(__dirname, 'src/types.ts'),
      '@workbench/shell/runtime': resolve(__dirname, 'src/runtime/runtimeContext.ts'),
      // Per-app aliases
      '@workbench-apps/maestro': resolve(__dirname, '../../apps/maestro/index.tsx'),
      '@workbench-apps/butler': resolve(__dirname, '../../apps/butler/index.tsx'),
      '@workbench-apps/pipewrench': resolve(__dirname, '../../apps/pipewrench/index.tsx'),
    },
  },
  server: {
    port: 5174, // distinct from root's 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
