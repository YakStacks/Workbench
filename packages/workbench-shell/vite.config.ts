import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Workbench Shell — renderer build config
// Core is resolved via path alias; no Core source is bundled into Shell.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Sub-path imports — only browser-safe Core files.
      // The barrel (index.ts) re-exports doctor.ts which uses Node built-ins.
      '@workbench/core/events': resolve(__dirname, '../../src/core/events.ts'),
      '@workbench/core/runner': resolve(__dirname, '../../src/core/runner.ts'),
      // Full barrel alias kept for future type-only imports (no tree includes doctor)
      '@workbench/core': resolve(__dirname, '../../src/core/index.ts'),
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
