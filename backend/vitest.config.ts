/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', '**/*.js', '**/*.d.ts'],
    // ESM Mocking configuration
    deps: {
      // Inline modules for proper ESM mocking with .js extensions
      inline: [
        /\.js$/,
        // Inline problematic ESM modules
        '@prisma/client',
        'ioredis',
      ],
    },
    // Mock resolution for .js extensions in TypeScript
    alias: {
      // Map .js imports to .ts files for proper mocking
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'src/scripts/**', // Exclude standalone scripts
        'tests/**', // Exclude test files from coverage
      ],
      thresholds: {
        // Enterprise-grade coverage thresholds (enforced in CI)
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    // Setup file for test utilities
    setupFiles: ['./tests/setup.ts'],
    // Test timeout
    testTimeout: 30000,
    // Pool configuration for better isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Better for mocking
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
