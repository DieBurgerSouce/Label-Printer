/**
 * Authentication Service
 * Handles user registration, login, and session management
 * Enhanced with:
 * - Failed login attempt tracking (brute-force protection)
 * - Strong password policy (production)
 * - Audit logging
 */
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { Role, User } from '@prisma/client';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../errors/AppError';
import logger from '../utils/logger';
import { getRedisClient } from '../lib/redis';
import { AuditService, AuditContext } from './audit-service';

const SALT_ROUNDS = 12;

// Failed login attempt configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes
const LOGIN_ATTEMPT_PREFIX = 'login_attempts:';

/**
 * Get the current failed login attempt count for an email
 */
async function getLoginAttempts(email: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const attempts = await redis.get(`${LOGIN_ATTEMPT_PREFIX}${email.toLowerCase()}`);
  return attempts ? parseInt(attempts, 10) : 0;
}

/**
 * Increment failed login attempts for an email
 */
async function incrementLoginAttempts(email: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const key = `${LOGIN_ATTEMPT_PREFIX}${email.toLowerCase()}`;
  const attempts = await redis.incr(key);

  // Set expiry on first attempt
  if (attempts === 1) {
    await redis.expire(key, LOCKOUT_DURATION_SECONDS);
  }

  return attempts;
}

/**
 * Clear failed login attempts after successful login
 */
async function clearLoginAttempts(email: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  await redis.del(`${LOGIN_ATTEMPT_PREFIX}${email.toLowerCase()}`);
}

/**
 * Check if account is locked due to too many failed attempts
 */
async function isAccountLocked(
  email: string
): Promise<{ locked: boolean; remainingSeconds: number }> {
  const redis = getRedisClient();
  if (!redis) return { locked: false, remainingSeconds: 0 };

  const key = `${LOGIN_ATTEMPT_PREFIX}${email.toLowerCase()}`;
  const attempts = await getLoginAttempts(email);

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    const ttl = await redis.ttl(key);
    return { locked: true, remainingSeconds: ttl > 0 ? ttl : 0 };
  }

  return { locked: false, remainingSeconds: 0 };
}

/**
 * Validate password strength
 * Production: min 12 chars, uppercase, lowercase, number, special char
 * Development: min 8 chars
 */
function validatePasswordStrength(password: string): void {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Strong password policy for production
    const minLength = 12;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+=[\]{};':"\\|,.<>/?-]/.test(password);

    if (password.length < minLength) {
      throw new ValidationError(`Password must be at least ${minLength} characters in production`);
    }
    if (!hasUppercase) {
      throw new ValidationError('Password must contain at least one uppercase letter');
    }
    if (!hasLowercase) {
      throw new ValidationError('Password must contain at least one lowercase letter');
    }
    if (!hasNumber) {
      throw new ValidationError('Password must contain at least one number');
    }
    if (!hasSpecial) {
      throw new ValidationError(
        'Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)'
      );
    }
  } else {
    // Relaxed policy for development
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
  }
}

// User data without sensitive fields
export type SafeUser = Omit<User, 'password'>;

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Remove sensitive fields from user object
 */
function sanitizeUser(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...safeUser } = user;
  return safeUser;
}

/**
 * Register a new user
 */
export async function registerUser(
  email: string,
  password: string,
  name?: string,
  auditContext?: AuditContext
): Promise<SafeUser> {
  const audit = AuditService.withContext(auditContext || {});

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }

  // Validate password strength (uses environment-based policy)
  validatePasswordStrength(password);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  // Hash password and create user
  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
    },
  });

  logger.info('User registered', { userId: user.id, email: user.email });

  // Audit: Log registration
  await audit.logRegister(user.id, user.email);

  return sanitizeUser(user);
}

/**
 * Authenticate a user with email and password
 * Includes brute-force protection with account lockout
 */
export async function loginUser(
  email: string,
  password: string,
  auditContext?: AuditContext
): Promise<SafeUser> {
  const audit = AuditService.withContext(auditContext || {});

  // Check if account is locked due to too many failed attempts
  const lockStatus = await isAccountLocked(email);
  if (lockStatus.locked) {
    const minutesRemaining = Math.ceil(lockStatus.remainingSeconds / 60);
    logger.warn('Login attempt on locked account', { email, minutesRemaining });

    // Audit: Log failed login on locked account
    await audit.logLoginFailed(email, 'Account is locked');

    throw new UnauthorizedError(
      `Account temporarily locked due to too many failed login attempts. Try again in ${minutesRemaining} minute(s).`
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    // Increment attempts even for non-existent users to prevent enumeration timing attacks
    await incrementLoginAttempts(email);
    logger.warn('Failed login - user not found', { email });

    // Audit: Log failed login
    await audit.logLoginFailed(email, 'User not found');

    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    logger.warn('Failed login - account disabled', { email, userId: user.id });

    // Audit: Log failed login
    await audit.logLoginFailed(email, 'Account is disabled');

    throw new UnauthorizedError('Account is disabled');
  }

  const isValid = await verifyPassword(password, user.password);

  if (!isValid) {
    const attempts = await incrementLoginAttempts(email);
    const remainingAttempts = MAX_LOGIN_ATTEMPTS - attempts;

    logger.warn('Failed login - invalid password', {
      email,
      userId: user.id,
      failedAttempts: attempts,
      remainingAttempts: Math.max(0, remainingAttempts),
    });

    // Audit: Log failed login
    await audit.logLoginFailed(email, 'Invalid password');

    if (remainingAttempts <= 0) {
      // Audit: Log account lockout
      await audit.logAccountLocked(email, attempts);

      throw new UnauthorizedError(
        `Account locked due to too many failed login attempts. Try again in ${LOCKOUT_DURATION_SECONDS / 60} minutes.`
      );
    }

    throw new UnauthorizedError('Invalid email or password');
  }

  // Clear failed attempts on successful login
  await clearLoginAttempts(email);

  // Update last login time
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info('User logged in successfully', { userId: user.id, email: user.email });

  // Audit: Log successful login
  await audit.logLoginSuccess(user.id, user.email);

  return sanitizeUser(user);
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  return sanitizeUser(user);
}

/**
 * Update user profile
 */
export async function updateUser(
  id: string,
  data: { name?: string; email?: string }
): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  // If email is being changed, check for conflicts
  if (data.email && data.email.toLowerCase() !== user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictError('Email already in use');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email.toLowerCase() }),
    },
  });

  logger.info('User updated', { userId: id });

  return sanitizeUser(updatedUser);
}

/**
 * Change user password
 */
export async function changePassword(
  id: string,
  currentPassword: string,
  newPassword: string,
  auditContext?: AuditContext
): Promise<void> {
  const audit = AuditService.withContext(auditContext || {});

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.password);

  if (!isValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Validate new password (uses environment-based policy)
  validatePasswordStrength(newPassword);

  // Ensure new password is different from current
  const isSamePassword = await verifyPassword(newPassword, user.password);
  if (isSamePassword) {
    throw new ValidationError('New password must be different from current password');
  }

  // Hash and save new password
  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword },
  });

  logger.info('Password changed', { userId: id });

  // Audit: Log password change
  await audit.logPasswordChange(id);
}

/**
 * Check if a user has a specific role
 */
export function hasRole(user: SafeUser, requiredRole: Role): boolean {
  // ADMIN has access to everything
  if (user.role === 'ADMIN') return true;

  return user.role === requiredRole;
}

/**
 * Admin: Get all users
 */
export async function getAllUsers(): Promise<SafeUser[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return users.map(sanitizeUser);
}

/**
 * Admin: Update user role
 */
export async function updateUserRole(
  id: string,
  role: Role,
  auditContext?: AuditContext
): Promise<SafeUser> {
  const audit = AuditService.withContext(auditContext || {});

  // Get current user for old role
  const currentUser = await prisma.user.findUnique({ where: { id } });
  const oldRole = currentUser?.role;

  const user = await prisma.user.update({
    where: { id },
    data: { role },
  });

  logger.info('User role updated', { userId: id, newRole: role });

  // Audit: Log role change
  await audit.logUserRoleChange(id, oldRole || 'UNKNOWN', role);

  return sanitizeUser(user);
}

/**
 * Admin: Deactivate user
 */
export async function deactivateUser(id: string, auditContext?: AuditContext): Promise<void> {
  const audit = AuditService.withContext(auditContext || {});

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  logger.info('User deactivated', { userId: id });

  // Audit: Log user deactivation
  await audit.logUserDeactivate(id);
}
