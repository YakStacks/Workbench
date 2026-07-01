import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Reset modules between test files to isolate Zustand store state
    isolate: true,
    // Use fake timers by default so TTL setTimeout tests are deterministic
    fakeTimers: {
      // Don't auto-install; tests opt-in with vi.useFakeTimers()
      install: false,
    },
  },
});
