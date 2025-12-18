/**
 * Authentication Service
 * Handles user registration, login, and session management
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

const SALT_ROUNDS = 12;

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
  name?: string
): Promise<SafeUser> {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }

  // Validate password strength
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

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

  return sanitizeUser(user);
}

/**
 * Authenticate a user with email and password
 */
export async function loginUser(email: string, password: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    // Use generic message to prevent user enumeration
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is disabled');
  }

  const isValid = await verifyPassword(password, user.password);

  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Update last login time
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info('User logged in', { userId: user.id, email: user.email });

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
  newPassword: string
): Promise<void> {
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

  // Validate new password
  if (newPassword.length < 8) {
    throw new ValidationError('New password must be at least 8 characters');
  }

  // Hash and save new password
  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword },
  });

  logger.info('Password changed', { userId: id });
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
export async function updateUserRole(id: string, role: Role): Promise<SafeUser> {
  const user = await prisma.user.update({
    where: { id },
    data: { role },
  });

  logger.info('User role updated', { userId: id, newRole: role });

  return sanitizeUser(user);
}

/**
 * Admin: Deactivate user
 */
export async function deactivateUser(id: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  logger.info('User deactivated', { userId: id });
}
