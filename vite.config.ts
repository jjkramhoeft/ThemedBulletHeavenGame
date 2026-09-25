import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { port: 8080 },
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
