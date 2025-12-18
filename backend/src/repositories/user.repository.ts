/**
 * User Repository
 * Data access layer for User entity
 */

import { PrismaClient, User, Role, Prisma } from '@prisma/client';
import { BaseRepository, PaginationOptions, PaginatedResult } from './base.repository';
import { ConflictError, NotFoundError, DatabaseError } from '../errors/AppError';
import logger from '../utils/logger';

/**
 * User without password (safe to return to client)
 */
export type SafeUser = Omit<User, 'password'>;

/**
 * Create user input
 */
export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role?: Role;
}

/**
 * Update user input
 */
export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  role?: Role;
  isActive?: boolean;
  emailVerified?: boolean;
  lastLoginAt?: Date;
}

/**
 * User query filters
 */
export interface UserQueryFilters {
  role?: Role;
  isActive?: boolean;
  emailVerified?: boolean;
  search?: string;
}

/**
 * User Repository implementation
 */
export class UserRepository extends BaseRepository<User, CreateUserInput, UpdateUserInput> {
  protected modelName = 'user';
  protected entityName = 'User';

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  protected getModel() {
    return this.prisma.user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
    } catch (error) {
      logger.error('Failed to find user by email', { email, error });
      throw new DatabaseError('Failed to find user');
    }
  }

  /**
   * Find user by email or throw error
   */
  async findByEmailOrThrow(email: string): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  /**
   * Create user with duplicate email check
   */
  async create(data: CreateUserInput): Promise<User> {
    try {
      // Check for existing email
      const existing = await this.findByEmail(data.email);
      if (existing) {
        throw new ConflictError('Email already registered');
      }

      return await this.prisma.user.create({
        data: {
          ...data,
          email: data.email.toLowerCase(),
        },
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      logger.error('Failed to create user', { email: data.email, error });
      throw new DatabaseError('Failed to create user');
    }
  }

  /**
   * Find all users with filters and pagination
   */
  async findAllWithFilters(
    filters: UserQueryFilters = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<SafeUser>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {};

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.emailVerified !== undefined) {
      where.emailVerified = filters.emailVerified;
    }

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    try {
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
          },
        }),
        this.prisma.user.count({ where }),
      ]);

      return {
        data: users as SafeUser[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to find users', { filters, options, error });
      throw new DatabaseError('Failed to fetch users');
    }
  }

  /**
   * Get user without password (safe to return to client)
   */
  async getSafeUser(id: string): Promise<SafeUser> {
    const user = await this.findByIdOrThrow(id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id },
        data: { lastLoginAt: new Date() },
      });
    } catch (error) {
      logger.error('Failed to update last login', { id, error });
      // Don't throw - this is not critical
    }
  }

  /**
   * Verify user email
   */
  async verifyEmail(id: string): Promise<User> {
    return this.update(id, { emailVerified: true });
  }

  /**
   * Deactivate user
   */
  async deactivate(id: string): Promise<User> {
    return this.update(id, { isActive: false });
  }

  /**
   * Reactivate user
   */
  async reactivate(id: string): Promise<User> {
    return this.update(id, { isActive: true });
  }

  /**
   * Count users by role
   */
  async countByRole(role: Role): Promise<number> {
    return this.count({ role });
  }

  /**
   * Check if user is admin
   */
  async isAdmin(id: string): Promise<boolean> {
    const user = await this.findById(id);
    return user?.role === 'ADMIN';
  }
}

// Singleton instance (uses default Prisma client)
let userRepository: UserRepository | null = null;

/**
 * Get singleton UserRepository instance
 */
export function getUserRepository(prisma?: PrismaClient): UserRepository {
  if (!userRepository) {
    const prismaClient = prisma || new PrismaClient();
    userRepository = new UserRepository(prismaClient);
  }
  return userRepository;
}
