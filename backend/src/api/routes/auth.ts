/**
 * Authentication Routes
 * Login, logout, register, and profile management
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../../services/auth-service';
import { isAuthenticated, requireRole, setSessionUser, clearSession } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import { sendSuccess, handleError } from '../../utils/api-response';

const router = Router();

// ========================================
// VALIDATION SCHEMAS
// ========================================

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email('Invalid email format').optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// ========================================
// PUBLIC ROUTES
// ========================================

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
  '/register',
  validateRequest(registerSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      const user = await authService.registerUser(email, password, name);

      // Auto-login after registration
      setSessionUser(req, user);

      return sendSuccess(res, { user }, 'Registration successful', 201);
    } catch (error) {
      return handleError(res, error, 'Registration failed');
    }
  }
);

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', validateRequest(loginSchema, 'body'), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await authService.loginUser(email, password);

    // Set session
    setSessionUser(req, user);

    return sendSuccess(res, { user });
  } catch (error) {
    return handleError(res, error, 'Login failed');
  }
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    await clearSession(req);
    res.clearCookie('session_id');
    return sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    return handleError(res, error, 'Logout failed');
  }
});

// ========================================
// AUTHENTICATED ROUTES
// ========================================

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', isAuthenticated, async (req: Request, res: Response) => {
  try {
    // User is already attached by isAuthenticated middleware
    return sendSuccess(res, { user: req.user });
  } catch (error) {
    return handleError(res, error, 'Failed to get profile');
  }
});

/**
 * PUT /api/auth/me
 * Update current user profile
 */
router.put(
  '/me',
  isAuthenticated,
  validateRequest(updateProfileSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { name, email } = req.body;

      const user = await authService.updateUser(userId, { name, email });

      // Update session with new user data
      setSessionUser(req, user);

      return sendSuccess(res, { user });
    } catch (error) {
      return handleError(res, error, 'Failed to update profile');
    }
  }
);

/**
 * POST /api/auth/change-password
 * Change password for current user
 */
router.post(
  '/change-password',
  isAuthenticated,
  validateRequest(changePasswordSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      await authService.changePassword(userId, currentPassword, newPassword);

      return sendSuccess(res, { message: 'Password changed successfully' });
    } catch (error) {
      return handleError(res, error, 'Failed to change password');
    }
  }
);

// ========================================
// ADMIN ROUTES
// ========================================

/**
 * GET /api/auth/users
 * Get all users (Admin only)
 */
router.get(
  '/users',
  isAuthenticated,
  requireRole('ADMIN'),
  async (_req: Request, res: Response) => {
    try {
      const users = await authService.getAllUsers();
      return sendSuccess(res, { users });
    } catch (error) {
      return handleError(res, error, 'Failed to get users');
    }
  }
);

/**
 * PUT /api/auth/users/:id/role
 * Update user role (Admin only)
 */
router.put(
  '/users/:id/role',
  isAuthenticated,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!['USER', 'ADMIN'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role. Must be USER or ADMIN',
        });
      }

      const user = await authService.updateUserRole(id, role);
      return sendSuccess(res, { user });
    } catch (error) {
      return handleError(res, error, 'Failed to update user role');
    }
  }
);

/**
 * DELETE /api/auth/users/:id
 * Deactivate user (Admin only)
 */
router.delete(
  '/users/:id',
  isAuthenticated,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Prevent self-deactivation
      if (req.user!.id === id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot deactivate your own account',
        });
      }

      await authService.deactivateUser(id);
      return sendSuccess(res, { message: 'User deactivated' });
    } catch (error) {
      return handleError(res, error, 'Failed to deactivate user');
    }
  }
);

export default router;
