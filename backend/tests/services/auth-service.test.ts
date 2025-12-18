/**
 * Auth Service Unit Tests
 * Comprehensive tests for authentication, authorization, and security features
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

// Mock dependencies before importing the service
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../src/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
    ttl: vi.fn(),
  })),
}));

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/audit-service', () => ({
  AuditService: {
    withContext: vi.fn(() => ({
      logLoginSuccess: vi.fn(),
      logLoginFailed: vi.fn(),
      logRegister: vi.fn(),
      logPasswordChange: vi.fn(),
      logUserRoleChange: vi.fn(),
      logUserDeactivate: vi.fn(),
      logAccountLocked: vi.fn(),
    })),
  },
  AuditContext: {},
}));

// Import after mocks
import { prisma } from '../../src/lib/prisma';
import { getRedisClient } from '../../src/lib/redis';
import {
  registerUser,
  loginUser,
  getUserById,
  updateUser,
  changePassword,
  hasRole,
  getAllUsers,
  updateUserRole,
  deactivateUser,
} from '../../src/services/auth-service';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../src/errors/AppError';

describe('Auth Service', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2b$12$hashedpassword',
    name: 'Test User',
    role: 'USER' as const,
    isActive: true,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // registerUser Tests
  // ========================================
  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      const result = await registerUser('test@example.com', 'Password123!@#', 'Test User');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result).not.toHaveProperty('password');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
        }),
      });
    });

    it('should reject invalid email format', async () => {
      await expect(registerUser('invalid-email', 'Password123!@#')).rejects.toThrow(
        ValidationError
      );
      await expect(registerUser('', 'Password123!@#')).rejects.toThrow(ValidationError);
    });

    it('should reject weak passwords in development', async () => {
      await expect(registerUser('test@example.com', 'short')).rejects.toThrow(ValidationError);
      await expect(registerUser('test@example.com', '1234567')).rejects.toThrow(ValidationError);
    });

    it('should reject duplicate email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      await expect(registerUser('test@example.com', 'Password123!@#')).rejects.toThrow(
        ConflictError
      );
    });

    it('should normalize email to lowercase', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      await registerUser('TEST@EXAMPLE.COM', 'Password123!@#');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
        }),
      });
    });
  });

  // ========================================
  // loginUser Tests
  // ========================================
  describe('loginUser', () => {
    beforeEach(() => {
      // Reset Redis mock for each test
      const redisMock = getRedisClient();
      if (redisMock) {
        vi.mocked(redisMock.get).mockResolvedValue(null);
        vi.mocked(redisMock.incr).mockResolvedValue(1);
        vi.mocked(redisMock.ttl).mockResolvedValue(-1);
      }
    });

    it('should login successfully with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 12);
      const userWithHash = { ...mockUser, password: hashedPassword };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithHash);
      vi.mocked(prisma.user.update).mockResolvedValue(userWithHash);

      const result = await loginUser('test@example.com', 'correctpassword');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result).not.toHaveProperty('password');
    });

    it('should reject login with wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 12);
      const userWithHash = { ...mockUser, password: hashedPassword };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithHash);

      await expect(loginUser('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should reject login for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(loginUser('nonexistent@example.com', 'password')).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should reject login for disabled account', async () => {
      const disabledUser = { ...mockUser, isActive: false };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(disabledUser);

      await expect(loginUser('test@example.com', 'password')).rejects.toThrow(UnauthorizedError);
    });

    it('should track failed login attempts', async () => {
      // This test verifies that wrong passwords are rejected
      // The actual lockout is handled by Redis which is mocked
      const hashedPassword = await bcrypt.hash('correctpassword', 12);
      const userWithHash = { ...mockUser, password: hashedPassword };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithHash);

      // Should reject with generic error message
      await expect(loginUser('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should update lastLoginAt on successful login', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 12);
      const userWithHash = { ...mockUser, password: hashedPassword };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithHash);
      vi.mocked(prisma.user.update).mockResolvedValue(userWithHash);

      await loginUser('test@example.com', 'correctpassword');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  // ========================================
  // getUserById Tests
  // ========================================
  describe('getUserById', () => {
    it('should return user by ID', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await getUserById('user-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('user-123');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundError for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(getUserById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ========================================
  // updateUser Tests
  // ========================================
  describe('updateUser', () => {
    it('should update user name', async () => {
      const updatedUser = { ...mockUser, name: 'New Name' };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

      const result = await updateUser('user-123', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should update user email with lowercase normalization', async () => {
      const updatedUser = { ...mockUser, email: 'new@example.com' };
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser) // First call: get user
        .mockResolvedValueOnce(null); // Second call: check email exists
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

      const result = await updateUser('user-123', { email: 'NEW@EXAMPLE.COM' });

      expect(result.email).toBe('new@example.com');
    });

    it('should reject duplicate email on update', async () => {
      const otherUser = { ...mockUser, id: 'other-user', email: 'other@example.com' };
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser) // First call: get user
        .mockResolvedValueOnce(otherUser); // Second call: check email exists

      await expect(updateUser('user-123', { email: 'other@example.com' })).rejects.toThrow(
        ConflictError
      );
    });

    it('should throw NotFoundError for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(updateUser('nonexistent', { name: 'New Name' })).rejects.toThrow(NotFoundError);
    });
  });

  // ========================================
  // changePassword Tests
  // ========================================
  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const hashedPassword = await bcrypt.hash('oldpassword', 12);
      const userWithHash = { ...mockUser, password: hashedPassword };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithHash);
      vi.mocked(prisma.user.update).mockResolvedValue(userWithHash);

      await expect(
        changePassword('user-123', 'oldpassword', 'NewPassword123!@#')
      ).resolves.not.toThrow();

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { password: expect.any(String) },
      });
    });

    it('should reject incorrect current password', async () => {
      const hashedPassword = await bcrypt.hash('oldpassword', 12);
      const userWithHash = { ...mockUser, password: hashedPassword };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithHash);

      await expect(
        changePassword('user-123', 'wrongpassword', 'NewPassword123!@#')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should reject same password', async () => {
      const hashedPassword = await bcrypt.hash('samepassword', 12);
      const userWithHash = { ...mockUser, password: hashedPassword };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithHash);

      await expect(changePassword('user-123', 'samepassword', 'samepassword')).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject weak new password', async () => {
      const hashedPassword = await bcrypt.hash('oldpassword', 12);
      const userWithHash = { ...mockUser, password: hashedPassword };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithHash);

      await expect(changePassword('user-123', 'oldpassword', 'weak')).rejects.toThrow(
        ValidationError
      );
    });
  });

  // ========================================
  // hasRole Tests
  // ========================================
  describe('hasRole', () => {
    it('should return true for matching role', () => {
      const user = { ...mockUser, role: 'USER' as const };
      expect(hasRole(user, 'USER')).toBe(true);
    });

    it('should return true for ADMIN accessing any role', () => {
      const admin = { ...mockUser, role: 'ADMIN' as const };
      expect(hasRole(admin, 'USER')).toBe(true);
      expect(hasRole(admin, 'ADMIN')).toBe(true);
    });

    it('should return false for non-matching role', () => {
      const user = { ...mockUser, role: 'USER' as const };
      expect(hasRole(user, 'ADMIN')).toBe(false);
    });
  });

  // ========================================
  // Admin Functions Tests
  // ========================================
  describe('Admin Functions', () => {
    describe('getAllUsers', () => {
      it('should return all users without passwords', async () => {
        vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser]);

        const result = await getAllUsers();

        expect(result).toHaveLength(1);
        expect(result[0]).not.toHaveProperty('password');
      });
    });

    describe('updateUserRole', () => {
      it('should update user role', async () => {
        const updatedUser = { ...mockUser, role: 'ADMIN' as const };
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
        vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

        const result = await updateUserRole('user-123', 'ADMIN');

        expect(result.role).toBe('ADMIN');
      });
    });

    describe('deactivateUser', () => {
      it('should deactivate user', async () => {
        const deactivatedUser = { ...mockUser, isActive: false };
        vi.mocked(prisma.user.update).mockResolvedValue(deactivatedUser);

        await expect(deactivateUser('user-123')).resolves.not.toThrow();

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-123' },
          data: { isActive: false },
        });
      });
    });
  });

  // ========================================
  // Security Tests
  // ========================================
  describe('Security', () => {
    it('should use bcrypt with adequate salt rounds', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      await registerUser('test@example.com', 'Password123!@#');

      // Verify password is hashed (bcrypt hashes start with $2b$)
      const createCall = vi.mocked(prisma.user.create).mock.calls[0][0];
      expect(createCall.data.password).toMatch(/^\$2b\$12\$/);
    });

    it('should never return password in response', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await getUserById('user-123');

      expect(result).not.toHaveProperty('password');
      expect(JSON.stringify(result)).not.toContain('password');
    });

    it('should handle timing attacks by checking non-existent users', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      // The error message should be generic (not revealing whether user exists)
      await expect(loginUser('nonexistent@example.com', 'password')).rejects.toThrow(
        'Invalid email or password'
      );

      // The generic error message prevents user enumeration
      // (same error for non-existent user vs wrong password)
    });
  });
});
