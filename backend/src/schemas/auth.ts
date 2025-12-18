/**
 * Authentication Zod Schemas
 * Validation schemas for authentication and user operations
 */

import { z } from 'zod';
import { idSchema, emailSchema, nonEmptyString } from './common';

// =============================================================================
// User Roles
// =============================================================================

export const userRoleSchema = z.enum(['USER', 'ADMIN']);
export type UserRole = z.infer<typeof userRoleSchema>;

// =============================================================================
// Password Validation
// =============================================================================

/**
 * Password requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Simple password for development (less strict)
 */
export const simplePasswordSchema = z.string().min(6, 'Password must be at least 6 characters');

// Use strict password in production, simple in development
const isProduction = process.env.NODE_ENV === 'production';
export const effectivePasswordSchema = isProduction ? passwordSchema : simplePasswordSchema;

// =============================================================================
// Authentication Requests
// =============================================================================

/**
 * User registration
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: effectivePasswordSchema,
  name: z.string().min(2).max(100).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * User login
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: nonEmptyString,
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Password change
 */
export const changePasswordSchema = z.object({
  currentPassword: nonEmptyString,
  newPassword: effectivePasswordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Password reset request
 */
export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

/**
 * Password reset confirmation
 */
export const confirmPasswordResetSchema = z.object({
  token: nonEmptyString,
  newPassword: effectivePasswordSchema,
});

export type ConfirmPasswordResetInput = z.infer<typeof confirmPasswordResetSchema>;

// =============================================================================
// User Profile
// =============================================================================

/**
 * Update user profile
 */
export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: emailSchema.optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// =============================================================================
// Admin Operations
// =============================================================================

/**
 * Update user role (admin only)
 */
export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

/**
 * User ID parameter
 */
export const userIdParamSchema = z.object({
  id: idSchema,
});

// =============================================================================
// Session
// =============================================================================

/**
 * Session info
 */
export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.date(),
  expiresAt: z.date(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type Session = z.infer<typeof sessionSchema>;

// =============================================================================
// Safe User (without password)
// =============================================================================

/**
 * User without sensitive data
 */
export const safeUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: userRoleSchema,
  isActive: z.boolean(),
  emailVerified: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().nullable(),
});

export type SafeUser = z.infer<typeof safeUserSchema>;
