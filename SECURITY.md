# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue
2. Email security concerns to the maintainers
3. Include detailed information about the vulnerability
4. Provide steps to reproduce if possible

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity

## Security Best Practices

### For Contributors

1. **Never commit secrets** (API keys, passwords, tokens)
2. **Use environment variables** for sensitive data
3. **Validate all inputs** on both client and server
4. **Sanitize outputs** to prevent XSS
5. **Use parameterized queries** to prevent SQL injection
6. **Keep dependencies updated** with security patches

### Environment Variables

Required secrets should be in `.env` (never committed):

```bash
# .env.example (safe to commit)
DATABASE_URL=postgresql://user:password@localhost:5432/db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-here
API_KEY=your-api-key
```

### Pre-commit Checks

We use pre-commit hooks to detect secrets:

```bash
# Install hooks
npm run prepare

# Run manually
npx detect-secrets scan
```

## Security Features

### Authentication

- JWT-based authentication
- Secure password hashing (bcrypt)
- Session management
- Rate limiting

### Data Protection

- HTTPS enforced in production
- Input validation with Zod
- SQL injection prevention
- XSS protection

### Infrastructure

- Docker container security
- Non-root container users
- Network isolation
- Resource limits

## Dependency Security

### Automated Scanning

- Dependabot for dependency updates
- npm audit in CI/CD pipeline
- Snyk integration (optional)

### Manual Checks

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Force fix (may have breaking changes)
npm audit fix --force
```

## Incident Response

In case of a security incident:

1. **Contain** - Isolate affected systems
2. **Assess** - Determine scope and impact
3. **Notify** - Inform affected parties
4. **Fix** - Implement patches
5. **Review** - Post-incident analysis

## Security Contacts

For security concerns, contact the maintainers through:
- Private GitHub Security Advisory
- Direct email to maintainers

---

Thank you for helping keep Screenshot_Algo secure! 🔒
