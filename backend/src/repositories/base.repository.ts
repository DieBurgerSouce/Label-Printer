/**
 * Base Repository
 * Abstract base class for all repositories implementing common CRUD operations
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, DatabaseError } from '../errors/AppError';
import logger from '../utils/logger';

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Base repository interface
 */
export interface IBaseRepository<T, CreateInput, UpdateInput> {
  findById(id: string): Promise<T | null>;
  findByIdOrThrow(id: string): Promise<T>;
  findAll(options?: PaginationOptions): Promise<PaginatedResult<T>>;
  create(data: CreateInput): Promise<T>;
  update(id: string, data: UpdateInput): Promise<T>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  count(where?: object): Promise<number>;
}

/**
 * Prisma model delegate interface (simplified for flexibility)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaModelDelegate = any;

/**
 * Base repository implementation with common CRUD operations
 * Extend this class for entity-specific repositories
 */
export abstract class BaseRepository<T, CreateInput, UpdateInput>
  implements IBaseRepository<T, CreateInput, UpdateInput>
{
  protected prisma: PrismaClient;
  protected abstract modelName: string;
  protected abstract entityName: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get the Prisma model delegate (must be implemented by subclass)
   */
  protected abstract getModel(): PrismaModelDelegate;

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const model = this.getModel();
      return await model.findUnique({ where: { id } });
    } catch (error) {
      logger.error(`Failed to find ${this.entityName} by ID`, { id, error });
      throw new DatabaseError(`Failed to find ${this.entityName}`);
    }
  }

  /**
   * Find entity by ID or throw NotFoundError
   */
  async findByIdOrThrow(id: string): Promise<T> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new NotFoundError(`${this.entityName} not found`);
    }
    return entity;
  }

  /**
   * Find all entities with pagination
   */
  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<T>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    try {
      const model = this.getModel();
      const [data, total] = await Promise.all([
        model.findMany({
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        model.count(),
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(`Failed to find all ${this.entityName}s`, { options, error });
      throw new DatabaseError(`Failed to fetch ${this.entityName}s`);
    }
  }

  /**
   * Create new entity
   */
  async create(data: CreateInput): Promise<T> {
    try {
      const model = this.getModel();
      const entity = await model.create({ data });
      logger.info(`Created ${this.entityName}`, { id: (entity as { id: string }).id });
      return entity;
    } catch (error) {
      logger.error(`Failed to create ${this.entityName}`, { data, error });
      throw new DatabaseError(`Failed to create ${this.entityName}`);
    }
  }

  /**
   * Update existing entity
   */
  async update(id: string, data: UpdateInput): Promise<T> {
    try {
      // Verify entity exists
      await this.findByIdOrThrow(id);

      const model = this.getModel();
      const entity = await model.update({ where: { id }, data });
      logger.info(`Updated ${this.entityName}`, { id });
      return entity;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error(`Failed to update ${this.entityName}`, { id, data, error });
      throw new DatabaseError(`Failed to update ${this.entityName}`);
    }
  }

  /**
   * Delete entity
   */
  async delete(id: string): Promise<void> {
    try {
      // Verify entity exists
      await this.findByIdOrThrow(id);

      const model = this.getModel();
      await model.delete({ where: { id } });
      logger.info(`Deleted ${this.entityName}`, { id });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error(`Failed to delete ${this.entityName}`, { id, error });
      throw new DatabaseError(`Failed to delete ${this.entityName}`);
    }
  }

  /**
   * Check if entity exists
   */
  async exists(id: string): Promise<boolean> {
    const entity = await this.findById(id);
    return entity !== null;
  }

  /**
   * Count entities
   */
  async count(where?: object): Promise<number> {
    try {
      const model = this.getModel();
      return await model.count(where ? { where } : undefined);
    } catch (error) {
      logger.error(`Failed to count ${this.entityName}s`, { where, error });
      throw new DatabaseError(`Failed to count ${this.entityName}s`);
    }
  }
}
