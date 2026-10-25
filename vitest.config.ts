import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Test-only config, kept separate from vite.config.ts and intentionally
// excluded from `tsc -b` to avoid the dual-Vite-version type clash between
// Vite 8 (rolldown) and the Vite bundled inside Vitest. Vitest reads this at
// runtime, so it does not need to be part of the typed production build.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Both setups run: testing-library cleanup (component tests) + the
    // fake-indexeddb install (data-layer tests). jsdom has no IndexedDB, so the
    // second file provides it.
    setupFiles: ['./src/test/setup.ts', './src/data/__tests__/setup.ts'],
    css: false,
  },
})
