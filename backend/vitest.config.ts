/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    // Enable proper ESM mocking by inlining dependencies
    server: {
      deps: {
        inline: [/\.js$/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'src/scripts/**', // Exclude standalone scripts
      ],
      thresholds: {
        // Start with realistic thresholds, increase over time
        lines: 10,
        functions: 10,
        branches: 10,
        statements: 10,
      },
    },
    // Setup file for test utilities
    setupFiles: ['./tests/setup.ts'],
    // Test timeout
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
