/**
 * CrawlJob Repository
 * Data access layer for CrawlJob entity
 */

import { PrismaClient, CrawlJob, Prisma } from '@prisma/client';
import { BaseRepository, PaginationOptions, PaginatedResult } from './base.repository';
import { DatabaseError } from '../errors/AppError';
import logger from '../utils/logger';

/**
 * CrawlJob status enum
 */
export type CrawlJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Create crawl job input
 */
export interface CreateCrawlJobInput {
  name: string;
  targetUrl: string;
  maxProducts?: number;
  status?: CrawlJobStatus;
}

/**
 * Update crawl job input
 */
export interface UpdateCrawlJobInput {
  name?: string;
  status?: CrawlJobStatus;
  targetUrl?: string;
  maxProducts?: number;
  productsFound?: number;
  productsScraped?: number;
  currentPage?: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string | null;
}

/**
 * CrawlJob query filters
 */
export interface CrawlJobQueryFilters {
  status?: CrawlJobStatus;
  targetUrl?: string;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * CrawlJob with screenshots count
 */
export interface CrawlJobWithStats extends CrawlJob {
  _count?: {
    screenshots: number;
  };
}

/**
 * CrawlJob Repository implementation
 */
export class CrawlJobRepository extends BaseRepository<
  CrawlJob,
  CreateCrawlJobInput,
  UpdateCrawlJobInput
> {
  protected modelName = 'crawlJob';
  protected entityName = 'CrawlJob';

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  protected getModel() {
    return this.prisma.crawlJob;
  }

  /**
   * Find crawl job by ID with screenshots count
   */
  async findByIdWithStats(id: string): Promise<CrawlJobWithStats | null> {
    try {
      return await this.prisma.crawlJob.findUnique({
        where: { id },
        include: {
          _count: {
            select: { screenshots: true },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find crawl job with stats', { id, error });
      throw new DatabaseError('Failed to find crawl job');
    }
  }

  /**
   * Find all crawl jobs with filters and pagination
   */
  async findAllWithFilters(
    filters: CrawlJobQueryFilters = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<CrawlJobWithStats>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.CrawlJobWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.targetUrl) {
      where.targetUrl = { contains: filters.targetUrl, mode: 'insensitive' };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { targetUrl: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) {
        where.createdAt.gte = filters.createdAfter;
      }
      if (filters.createdBefore) {
        where.createdAt.lte = filters.createdBefore;
      }
    }

    try {
      const [crawlJobs, total] = await Promise.all([
        this.prisma.crawlJob.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            _count: {
              select: { screenshots: true },
            },
          },
        }),
        this.prisma.crawlJob.count({ where }),
      ]);

      return {
        data: crawlJobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to find crawl jobs', { filters, options, error });
      throw new DatabaseError('Failed to fetch crawl jobs');
    }
  }

  /**
   * Find crawl jobs by status
   */
  async findByStatus(
    status: CrawlJobStatus,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<CrawlJobWithStats>> {
    return this.findAllWithFilters({ status }, options);
  }

  /**
   * Find active crawl jobs (pending or running)
   */
  async findActive(): Promise<CrawlJob[]> {
    try {
      return await this.prisma.crawlJob.findMany({
        where: {
          status: { in: ['pending', 'running'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find active crawl jobs', { error });
      throw new DatabaseError('Failed to fetch active crawl jobs');
    }
  }

  /**
   * Update crawl job status
   */
  async updateStatus(id: string, status: CrawlJobStatus, error?: string): Promise<CrawlJob> {
    try {
      const updateData: UpdateCrawlJobInput = { status };

      if (status === 'running') {
        updateData.startedAt = new Date();
      } else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        updateData.completedAt = new Date();
      }

      if (error) {
        updateData.error = error;
      }

      const crawlJob = await this.prisma.crawlJob.update({
        where: { id },
        data: updateData,
      });

      logger.info('Updated crawl job status', { id, status });
      return crawlJob;
    } catch (error) {
      logger.error('Failed to update crawl job status', { id, status, error });
      throw new DatabaseError('Failed to update crawl job status');
    }
  }

  /**
   * Update crawl job progress
   */
  async updateProgress(
    id: string,
    productsFound: number,
    productsScraped: number,
    currentPage: number
  ): Promise<CrawlJob> {
    try {
      return await this.prisma.crawlJob.update({
        where: { id },
        data: {
          productsFound,
          productsScraped,
          currentPage,
        },
      });
    } catch (error) {
      logger.error('Failed to update crawl job progress', { id, error });
      throw new DatabaseError('Failed to update crawl job progress');
    }
  }

  /**
   * Get crawl job statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalProducts: number;
    avgProductsPerJob: number;
  }> {
    try {
      const [total, statusGroups, productStats] = await Promise.all([
        this.prisma.crawlJob.count(),
        this.prisma.crawlJob.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.crawlJob.aggregate({
          _sum: { productsScraped: true },
          _avg: { productsScraped: true },
        }),
      ]);

      const byStatus: Record<string, number> = {};
      for (const group of statusGroups) {
        byStatus[group.status] = group._count._all;
      }

      return {
        total,
        byStatus,
        totalProducts: productStats._sum.productsScraped || 0,
        avgProductsPerJob: Math.round(productStats._avg.productsScraped || 0),
      };
    } catch (error) {
      logger.error('Failed to get crawl job statistics', { error });
      throw new DatabaseError('Failed to get statistics');
    }
  }

  /**
   * Delete old completed crawl jobs (cleanup)
   */
  async deleteOldCompleted(olderThan: Date): Promise<{ count: number }> {
    try {
      const result = await this.prisma.crawlJob.deleteMany({
        where: {
          status: { in: ['completed', 'failed', 'cancelled'] },
          completedAt: { lt: olderThan },
        },
      });
      logger.info(`Deleted ${result.count} old crawl jobs`);
      return result;
    } catch (error) {
      logger.error('Failed to delete old crawl jobs', { olderThan, error });
      throw new DatabaseError('Failed to delete old crawl jobs');
    }
  }
}

// Singleton instance
let crawlJobRepository: CrawlJobRepository | null = null;

/**
 * Get singleton CrawlJobRepository instance
 */
export function getCrawlJobRepository(prisma?: PrismaClient): CrawlJobRepository {
  if (!crawlJobRepository) {
    const prismaClient = prisma || new PrismaClient();
    crawlJobRepository = new CrawlJobRepository(prismaClient);
  }
  return crawlJobRepository;
}
