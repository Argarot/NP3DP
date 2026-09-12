import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  // Numerical/export fixtures are CPU-heavy. Timing acceptance is measured
  // separately; avoid oversubscribing laptops or applying a 5 s UI timeout.
  test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'], maxWorkers: 2, testTimeout: 30_000 },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { chunkSizeWarningLimit: 650 },
});
