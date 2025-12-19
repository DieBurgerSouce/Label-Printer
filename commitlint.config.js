/**
 * Commitlint Configuration
 * Enforces Conventional Commits format
 * https://conventionalcommits.org/
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],

  // Custom rules
  rules: {
    // Type must be one of these values
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation only
        'style',    // Code style (formatting, semicolons, etc.)
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf',     // Performance improvement
        'test',     // Adding or correcting tests
        'build',    // Build system or external dependencies
        'ci',       // CI configuration
        'chore',    // Other changes that don't modify src or test files
        'revert',   // Reverts a previous commit
        'wip',      // Work in progress (for draft PRs)
      ],
    ],

    // Type must be lowercase
    'type-case': [2, 'always', 'lower-case'],

    // Type cannot be empty
    'type-empty': [2, 'never'],

    // Subject cannot be empty
    'subject-empty': [2, 'never'],

    // Subject must be sentence case (first letter lowercase)
    'subject-case': [2, 'always', 'sentence-case'],

    // Subject max length
    'subject-max-length': [2, 'always', 100],

    // No period at the end of subject
    'subject-full-stop': [2, 'never', '.'],

    // Header max length (type + scope + subject)
    'header-max-length': [2, 'always', 120],

    // Body max line length
    'body-max-line-length': [1, 'always', 100],

    // Footer max line length
    'footer-max-line-length': [1, 'always', 100],

    // Scope is optional but if provided must be lowercase
    'scope-case': [2, 'always', 'lower-case'],

    // Allowed scopes (optional - uncomment and customize if needed)
    // 'scope-enum': [
    //   2,
    //   'always',
    //   ['api', 'frontend', 'backend', 'ci', 'deps', 'docs', 'config'],
    // ],
  },

  // Help URL shown when commit message is invalid
  helpUrl: 'https://www.conventionalcommits.org/en/v1.0.0/',

  // Prompt settings for interactive commit (if using @commitlint/cz-commitlint)
  prompt: {
    settings: {},
    messages: {
      skip: ':skip',
      max: 'max %d chars',
      min: 'min %d chars',
      emptyWarning: 'can not be empty',
      upperLimitWarning: 'over limit',
      lowerLimitWarning: 'below limit',
    },
    questions: {
      type: {
        description: 'Select the type of change you are committing',
        enum: {
          feat: {
            description: 'A new feature',
            title: 'Features',
            emoji: '✨',
          },
          fix: {
            description: 'A bug fix',
            title: 'Bug Fixes',
            emoji: '🐛',
          },
          docs: {
            description: 'Documentation only changes',
            title: 'Documentation',
            emoji: '📚',
          },
          style: {
            description: 'Code style changes (formatting, semicolons, etc.)',
            title: 'Styles',
            emoji: '💎',
          },
          refactor: {
            description: 'A code change that neither fixes a bug nor adds a feature',
            title: 'Code Refactoring',
            emoji: '📦',
          },
          perf: {
            description: 'A code change that improves performance',
            title: 'Performance',
            emoji: '🚀',
          },
          test: {
            description: 'Adding or correcting tests',
            title: 'Tests',
            emoji: '🚨',
          },
          build: {
            description: 'Changes to build system or dependencies',
            title: 'Builds',
            emoji: '🛠',
          },
          ci: {
            description: 'Changes to CI configuration files and scripts',
            title: 'CI',
            emoji: '⚙️',
          },
          chore: {
            description: 'Other changes that don\'t modify src or test files',
            title: 'Chores',
            emoji: '♻️',
          },
          revert: {
            description: 'Reverts a previous commit',
            title: 'Reverts',
            emoji: '🗑',
          },
        },
      },
      scope: {
        description: 'What is the scope of this change (e.g. api, frontend, backend)',
      },
      subject: {
        description: 'Write a short, imperative tense description of the change',
      },
      body: {
        description: 'Provide a longer description of the change (optional)',
      },
      isBreaking: {
        description: 'Are there any breaking changes?',
      },
      breakingBody: {
        description: 'Describe the breaking changes',
      },
      breaking: {
        description: 'Describe the breaking changes',
      },
      isIssueAffected: {
        description: 'Does this change affect any open issues?',
      },
      issuesBody: {
        description: 'Add issue references (e.g. "fix #123", "close #456")',
      },
      issues: {
        description: 'Add issue references (e.g. "fix #123", "close #456")',
      },
    },
  },
};
