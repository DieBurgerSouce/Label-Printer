# Your First Pull Request

Welcome to the team! This guide will help you make your first contribution to Screenshot_Algo.

## Prerequisites

Before you start, ensure you have:
- [ ] Completed [dev-setup.md](./dev-setup.md)
- [ ] Access to the GitHub repository
- [ ] Slack access to #dev-team channel
- [ ] Local development environment running

## Step 1: Find a Good First Issue

### Where to Look
1. **GitHub Issues** labeled `good-first-issue`
2. **Documentation improvements** (always welcome!)
3. **Test coverage** improvements
4. **Small bug fixes**

### Claim an Issue
1. Comment on the issue: "I'd like to work on this"
2. Wait for assignment or approval
3. Ask questions in the issue thread

## Step 2: Create a Branch

### Branch Naming Convention
```bash
# Feature
git checkout -b feature/ISSUE-123-add-new-feature

# Bug fix
git checkout -b fix/ISSUE-456-fix-login-bug

# Documentation
git checkout -b docs/ISSUE-789-update-readme

# Chore/maintenance
git checkout -b chore/ISSUE-012-update-dependencies
```

### Example
```bash
# Fetch latest changes
git checkout main
git pull origin main

# Create your branch
git checkout -b feature/ISSUE-100-add-dark-mode
```

## Step 3: Make Your Changes

### Code Guidelines

#### TypeScript/JavaScript
```typescript
// Use descriptive variable names
const userPreferences = getUserPreferences(); // Good
const x = getUP(); // Bad

// Add types to function parameters and return values
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Use async/await over .then()
async function fetchData(): Promise<Data> {
  const response = await api.get('/data');
  return response.data;
}
```

#### React Components
```tsx
// Use functional components with TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  disabled = false
}) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};
```

### Testing Requirements

Every PR should include tests:

```typescript
// Unit test example
describe('calculateTotal', () => {
  it('should return sum of item prices', () => {
    const items = [
      { name: 'A', price: 10 },
      { name: 'B', price: 20 }
    ];

    expect(calculateTotal(items)).toBe(30);
  });

  it('should return 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });
});
```

Run tests locally:
```bash
npm test
npm test -- --coverage
```

## Step 4: Commit Your Changes

### Commit Message Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, missing semicolons)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```bash
# Simple commit
git commit -m "feat(auth): add password reset functionality"

# With body
git commit -m "fix(api): handle null response from external service

The external screenshot API sometimes returns null instead of an error.
This commit adds null checking to prevent crashes.

Fixes #123"
```

### Pre-commit Checks
Our pre-commit hooks will automatically:
- Run ESLint
- Run Prettier
- Run TypeScript type checking
- Run affected tests

If checks fail, fix the issues before committing.

## Step 5: Push and Create PR

### Push Your Branch
```bash
git push -u origin feature/ISSUE-100-add-dark-mode
```

### Create Pull Request

1. Go to GitHub repository
2. Click "Compare & pull request"
3. Fill in the PR template:

```markdown
## Summary
Brief description of what this PR does.

## Changes
- Added dark mode toggle component
- Updated theme context
- Added localStorage persistence

## Testing
- [ ] Unit tests pass
- [ ] Manual testing completed
- [ ] Tested in Chrome, Firefox, Safari

## Screenshots
[If UI changes, add before/after screenshots]

## Related Issues
Closes #100
```

## Step 6: Address Review Feedback

### Common Feedback Types

1. **Code Style**
   - Follow the suggested changes
   - Ask if unclear why

2. **Logic Issues**
   - Discuss if you disagree
   - Provide reasoning for your approach

3. **Missing Tests**
   - Add requested tests
   - Ensure coverage is adequate

4. **Documentation**
   - Update comments/docs as requested
   - Keep README current

### Responding to Reviews
```bash
# Make requested changes
git add .
git commit -m "fix: address review feedback"
git push
```

Or amend if minor:
```bash
git add .
git commit --amend --no-edit
git push --force-with-lease
```

## Step 7: Merge!

Once approved:
1. Ensure CI passes (green checkmarks)
2. Squash and merge (preferred)
3. Delete your branch
4. Celebrate your first contribution!

## Common First PR Pitfalls

### Avoid These
- **Too large**: Keep PRs focused, < 400 lines ideal
- **No tests**: Always include tests
- **Breaking changes**: Discuss major changes first
- **Ignoring linting**: Fix all lint errors
- **Force pushing after review**: Reviewers lose context

### Do These
- **Small, focused changes**: One feature per PR
- **Clear descriptions**: Help reviewers understand
- **Respond promptly**: Keep momentum
- **Ask questions**: We're here to help!

## Getting Help

### Stuck?
1. Check existing documentation
2. Search closed PRs for similar changes
3. Ask in #dev-team Slack channel
4. Pair with a teammate

### Code Review Taking Long?
- Ping the reviewer politely after 24 hours
- Ask in Slack for another reviewer
- Keep PRs small for faster reviews

## Celebrate!

After your PR is merged:
- You're officially a contributor!
- Your code is in production
- Add it to your portfolio/resume
- Help review others' PRs

---

**Questions?** Ask in #dev-team
**Improvements to this guide?** Submit a PR!
