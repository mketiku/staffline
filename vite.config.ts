/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5274,
    proxy: {
      '/transcribe': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
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
