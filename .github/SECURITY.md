# Security Policy

## Supported Versions

The following versions of Screenshot_Algo are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow responsible disclosure practices.

### For Critical Vulnerabilities

**DO NOT** open a public GitHub issue for critical security vulnerabilities.

Instead, please report them using one of these methods:

1. **GitHub Security Advisory** (Preferred)
   - Go to [Security Advisories](https://github.com/benfi/Screenshot_Algo/security/advisories/new)
   - Create a new private security advisory

2. **Email**
   - Send details to: security@example.com
   - Use PGP encryption if available (key available on request)

### What to Include

When reporting a vulnerability, please include:

- **Description**: A clear description of the vulnerability
- **Impact**: What could an attacker accomplish?
- **Reproduction Steps**: How to reproduce the issue
- **Affected Versions**: Which versions are affected?
- **Suggested Fix**: If you have ideas for a fix

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 5 business days
- **Resolution Target**: Within 90 days for critical issues

### What to Expect

1. **Acknowledgment**: We'll acknowledge receipt of your report
2. **Assessment**: We'll assess the severity and impact
3. **Fix Development**: We'll work on a fix if needed
4. **Coordinated Disclosure**: We'll coordinate with you on disclosure timing
5. **Credit**: We'll credit you in our security advisory (if desired)

## Security Best Practices

### For Users

- Keep your dependencies up to date
- Use environment variables for sensitive configuration
- Never commit secrets to version control
- Use HTTPS for all communications
- Review third-party dependencies before adding them

### For Contributors

- Follow secure coding practices
- Never log sensitive information
- Validate all user input
- Use parameterized queries
- Keep dependencies updated
- Run `npm audit` regularly

## Security Features

Screenshot_Algo implements the following security measures:

- **Dependency Scanning**: Automated scanning via Dependabot and npm audit
- **Code Scanning**: CodeQL analysis on all PRs
- **Secret Detection**: Pre-commit hooks to prevent secret commits
- **Access Control**: Principle of least privilege
- **Secure Defaults**: Security-focused default configurations

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [npm Security Best Practices](https://docs.npmjs.com/policies/security)

## Hall of Fame

We appreciate security researchers who help keep Screenshot_Algo secure:

<!-- Add names of security researchers who have responsibly disclosed vulnerabilities -->

---

Thank you for helping keep Screenshot_Algo and its users safe!
