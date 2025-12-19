# Branch Protection Rules

This document outlines the branch protection rules configured for the Screenshot_Algo repository.

## Protected Branches

### `main` Branch

The `main` branch is the production-ready branch. All code in `main` should be:
- Tested and reviewed
- Ready for deployment
- Free of known critical bugs

**Protection Rules:**

| Rule | Setting | Description |
|------|---------|-------------|
| Require pull request reviews | ✅ 1 review required | All changes must be reviewed |
| Dismiss stale reviews | ✅ Enabled | Reviews are dismissed on new commits |
| Require status checks | ✅ Required | CI must pass before merge |
| Require branches up to date | ✅ Enabled | Branch must be up to date with main |
| Require signed commits | ⚠️ Recommended | GPG signed commits encouraged |
| Include administrators | ✅ Enabled | Rules apply to admins too |
| Allow force pushes | ❌ Disabled | Never force push to main |
| Allow deletions | ❌ Disabled | Cannot delete main branch |

**Required Status Checks:**
- `ci` - Continuous Integration (lint, test, build)
- `security-scan` - Security vulnerability scanning
- `coverage` - Code coverage check (minimum 70%)

### `develop` Branch

The `develop` branch is for active development. Features are merged here first.

**Protection Rules:**

| Rule | Setting | Description |
|------|---------|-------------|
| Require pull request reviews | ✅ 1 review required | Code review required |
| Dismiss stale reviews | ✅ Enabled | Reviews dismissed on changes |
| Require status checks | ✅ Required | CI must pass |
| Require branches up to date | ⚠️ Recommended | Keep up to date when possible |
| Allow force pushes | ❌ Disabled | No force pushes |

**Required Status Checks:**
- `ci` - Continuous Integration
- `lint` - Code linting

## Branch Naming Convention

| Pattern | Purpose | Example |
|---------|---------|---------|
| `main` | Production | - |
| `develop` | Development | - |
| `feature/*` | New features | `feature/add-screenshot-api` |
| `fix/*` | Bug fixes | `fix/image-quality-issue` |
| `hotfix/*` | Production hotfixes | `hotfix/critical-security-patch` |
| `release/*` | Release preparation | `release/v1.2.0` |
| `docs/*` | Documentation | `docs/update-readme` |
| `chore/*` | Maintenance tasks | `chore/update-deps` |

## Pull Request Process

### Creating a PR

1. **Branch from `develop`** for features/fixes
2. **Use conventional commit messages**
3. **Fill out the PR template completely**
4. **Ensure all checks pass**
5. **Request review from appropriate team members**

### Reviewing a PR

Reviewers should check:
- [ ] Code quality and style
- [ ] Test coverage
- [ ] Documentation updates
- [ ] Security implications
- [ ] Performance impact
- [ ] Breaking changes

### Merging a PR

1. **Squash and merge** for feature branches (clean history)
2. **Merge commit** for release branches (preserve history)
3. **Delete branch** after merge
4. **Verify deployment** (if applicable)

## CODEOWNERS

Code owners are automatically requested for review based on file paths:

```
# Default owner
* @benfi

# Specific areas (example)
# /src/api/ @backend-team
# /frontend/ @frontend-team
# /.github/ @devops-team
```

## Bypass Rules

In emergency situations, administrators may bypass rules with:
- Clear documentation of the bypass reason
- Immediate follow-up to restore normal process
- Post-incident review if applicable

**Bypass should be used only for:**
- Critical security patches
- Production emergencies
- Time-sensitive regulatory requirements

## Configuration in GitHub

To configure these rules in GitHub:

1. Go to **Settings** > **Branches**
2. Click **Add rule** or edit existing rule
3. Enter branch name pattern (e.g., `main`)
4. Configure protection settings as documented above
5. Click **Create** or **Save changes**

## Enforcement

These rules are enforced by:
- GitHub branch protection settings
- CI/CD pipeline checks
- Code review requirements
- Pre-commit and pre-push hooks

---

Last Updated: 2024-01-01
