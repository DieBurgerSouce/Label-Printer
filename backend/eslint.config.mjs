import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.js', '!eslint.config.js'],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,

  // Prettier config (disables conflicting rules)
  prettierConfig,

  // Custom configuration for TypeScript files
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // Prettier integration
      'prettier/prettier': ['error', { endOfLine: 'auto' }],

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',

      // Console rules - allow logging
      'no-console': ['warn', { allow: ['warn', 'error', 'log', 'info'] }],
    },
  }
);
