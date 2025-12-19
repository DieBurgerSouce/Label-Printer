/**
 * lint-staged Configuration
 * Runs linters on git staged files
 * https://github.com/okonet/lint-staged
 */

module.exports = {
  // TypeScript and JavaScript files
  '*.{ts,tsx,js,jsx}': [
    // Run ESLint with auto-fix
    'eslint --fix --max-warnings=0',
    // Run Prettier
    'prettier --write',
  ],

  // TypeScript type checking (only check, don't modify)
  '*.{ts,tsx}': () => 'tsc --noEmit',

  // JSON files
  '*.json': [
    'prettier --write',
  ],

  // Markdown files
  '*.md': [
    'prettier --write',
    'markdownlint --fix',
  ],

  // YAML files
  '*.{yml,yaml}': [
    'prettier --write',
    'yamllint -c .yamllint.yml',
  ],

  // CSS/SCSS files
  '*.{css,scss,sass}': [
    'prettier --write',
  ],

  // HTML files
  '*.html': [
    'prettier --write',
  ],

  // Shell scripts
  '*.sh': [
    'shellcheck',
  ],

  // Dockerfile
  'Dockerfile*': [
    'hadolint --ignore DL3008 --ignore DL3018',
  ],

  // Package.json - sort and format
  'package.json': [
    'prettier --write',
    // Optionally run npm audit on package changes
    // 'npm audit --audit-level=moderate',
  ],

  // Prevent committing secrets
  '*': [
    // Check for secrets (if detect-secrets is installed)
    // 'detect-secrets-hook --baseline .secrets.baseline',
  ],
};
