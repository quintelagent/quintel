import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['engine/test/**/*.test.ts', 'worker/test/**/*.test.ts', 'web/test/**/*.test.ts'],
    testTimeout: 120000,
  },
});
