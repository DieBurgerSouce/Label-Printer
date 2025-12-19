# Contributing to Screenshot_Algo

Thank you for your interest in contributing to Screenshot_Algo! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Screenshot_Algo.git
   cd Screenshot_Algo
   ```
3. **Install dependencies**:
   ```bash
   npm ci
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Setting Up Development Environment

```bash
# Install dependencies
npm ci

# Start development servers
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

### Using DevContainer (Recommended)

Open the project in VS Code and select "Reopen in Container" when prompted.

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode in tsconfig.json
- Define explicit types (avoid `any`)
- Use interfaces for object shapes

### Code Style

- Use Prettier for formatting
- Use ESLint for linting
- Follow existing patterns in the codebase
- Write self-documenting code

### File Naming

- Use `kebab-case` for file names
- Use `.ts` for TypeScript files
- Use `.tsx` for React components
- Test files: `*.test.ts` or `*.spec.ts`

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(api): add screenshot caching endpoint
fix(worker): resolve memory leak in image processing
docs(readme): update installation instructions
test(api): add integration tests for auth
```

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Run all checks locally**:
   ```bash
   npm run lint
   npm run type-check
   npm test
   ```
4. **Create Pull Request** with clear description
5. **Wait for review** and address feedback
6. **Squash and merge** after approval

### PR Checklist

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No console.log statements
- [ ] No hardcoded secrets

## Testing

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm test -- --testPathPattern=unit

# Integration tests
npm test -- --testPathPattern=integration

# E2E tests
npx playwright test

# With coverage
npm test -- --coverage
```

### Writing Tests

- Place tests in `__tests__/` directory
- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Mock external dependencies

## Questions?

Feel free to open an issue for questions or discussions.

---

Thank you for contributing! 🎉
