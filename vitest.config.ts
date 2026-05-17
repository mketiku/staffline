import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  // vitest bundles vite 6 types; root has vite 8 — Plugin types are structurally incompatible
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [react() as any, tailwindcss() as any],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/lib/audio.worker.ts',
        'src/test/**',
        '**/*.d.ts',
      ],
      thresholds: { lines: 70, statements: 70, branches: 70, functions: 60 },
    },
  },
});
