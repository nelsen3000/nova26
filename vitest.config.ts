import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    include: ['src/**/*.test.ts', 'src/**/*-tests.ts', 'convex/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'convex/**/*.ts'],
      exclude: ['src/test/**', 'src/**/*.test.ts', 'convex/**/*.test.ts'],
    },
  },
});
