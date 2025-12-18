/**
 * AutomationJob Repository
 * Data access layer for AutomationJob entity
 */

import { PrismaClient, AutomationJob, Prisma } from '@prisma/client';
import { BaseRepository, PaginationOptions, PaginatedResult } from './base.repository';
import { DatabaseError } from '../errors/AppError';
import logger from '../utils/logger';

/**
 * AutomationJob status enum
 */
export type AutomationJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * AutomationJob stage enum
 */
export type AutomationJobStage = 'crawling' | 'ocr' | 'matching' | 'rendering';

/**
 * Automation job configuration
 */
export interface AutomationJobConfig {
  crawlerConfig?: {
    targetUrl?: string;
    maxProducts?: number;
    delay?: number;
  };
  templateId?: string;
  matchingConfig?: {
    strategy?: string;
    threshold?: number;
  };
}

/**
 * Automation job progress
 */
export interface AutomationJobProgress {
  crawling?: number;
  ocr?: number;
  matching?: number;
  rendering?: number;
}

/**
 * Automation job result summary
 */
export interface AutomationJobResultSummary {
  screenshotsCount?: number;
  ocrSuccess?: number;
  matchedCount?: number;
  labelsGenerated?: number;
}

/**
 * Create automation job input
 */
export interface CreateAutomationJobInput {
  name: string;
  status?: AutomationJobStatus;
  config: Prisma.InputJsonValue;
  templateId?: string;
}

/**
 * Update automation job input
 */
export interface UpdateAutomationJobInput {
  name?: string;
  status?: AutomationJobStatus;
  config?: Prisma.InputJsonValue;
  currentStage?: AutomationJobStage | null;
  progress?: Prisma.InputJsonValue;
  resultSummary?: Prisma.InputJsonValue;
  startedAt?: Date | null;
  completedAt?: Date | null;
  error?: string | null;
  templateId?: string | null;
}

/**
 * AutomationJob query filters
 */
export interface AutomationJobQueryFilters {
  status?: AutomationJobStatus;
  currentStage?: AutomationJobStage;
  templateId?: string;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * AutomationJob with template info
 */
export interface AutomationJobWithTemplate extends AutomationJob {
  template?: {
    id: string;
    name: string;
  } | null;
}

/**
 * AutomationJob Repository implementation
 */
export class AutomationJobRepository extends BaseRepository<
  AutomationJob,
  CreateAutomationJobInput,
  UpdateAutomationJobInput
> {
  protected modelName = 'automationJob';
  protected entityName = 'AutomationJob';

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  protected getModel() {
    return this.prisma.automationJob;
  }

  /**
   * Find automation job by ID with template
   */
  async findByIdWithTemplate(id: string): Promise<AutomationJobWithTemplate | null> {
    try {
      return await this.prisma.automationJob.findUnique({
        where: { id },
        include: {
          template: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find automation job with template', { id, error });
      throw new DatabaseError('Failed to find automation job');
    }
  }

  /**
   * Find all automation jobs with filters and pagination
   */
  async findAllWithFilters(
    filters: AutomationJobQueryFilters = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AutomationJobWithTemplate>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.AutomationJobWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.currentStage) {
      where.currentStage = filters.currentStage;
    }

    if (filters.templateId) {
      where.templateId = filters.templateId;
    }

    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
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
      const [jobs, total] = await Promise.all([
        this.prisma.automationJob.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            template: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        this.prisma.automationJob.count({ where }),
      ]);

      return {
        data: jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to find automation jobs', { filters, options, error });
      throw new DatabaseError('Failed to fetch automation jobs');
    }
  }

  /**
   * Find automation jobs by status
   */
  async findByStatus(
    status: AutomationJobStatus,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<AutomationJobWithTemplate>> {
    return this.findAllWithFilters({ status }, options);
  }

  /**
   * Find active automation jobs (pending or running)
   */
  async findActive(): Promise<AutomationJob[]> {
    try {
      return await this.prisma.automationJob.findMany({
        where: {
          status: { in: ['pending', 'running'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find active automation jobs', { error });
      throw new DatabaseError('Failed to fetch active automation jobs');
    }
  }

  /**
   * Update automation job status
   */
  async updateStatus(
    id: string,
    status: AutomationJobStatus,
    error?: string
  ): Promise<AutomationJob> {
    try {
      const updateData: UpdateAutomationJobInput = { status };

      if (status === 'running') {
        updateData.startedAt = new Date();
      } else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        updateData.completedAt = new Date();
      }

      if (error) {
        updateData.error = error;
      }

      const job = await this.prisma.automationJob.update({
        where: { id },
        data: updateData,
      });

      logger.info('Updated automation job status', { id, status });
      return job;
    } catch (error) {
      logger.error('Failed to update automation job status', { id, status, error });
      throw new DatabaseError('Failed to update automation job status');
    }
  }

  /**
   * Update automation job stage
   */
  async updateStage(id: string, stage: AutomationJobStage): Promise<AutomationJob> {
    try {
      return await this.prisma.automationJob.update({
        where: { id },
        data: { currentStage: stage },
      });
    } catch (error) {
      logger.error('Failed to update automation job stage', { id, stage, error });
      throw new DatabaseError('Failed to update automation job stage');
    }
  }

  /**
   * Update automation job progress
   */
  async updateProgress(id: string, progress: AutomationJobProgress): Promise<AutomationJob> {
    try {
      return await this.prisma.automationJob.update({
        where: { id },
        data: { progress: progress as Prisma.InputJsonValue },
      });
    } catch (error) {
      logger.error('Failed to update automation job progress', { id, progress, error });
      throw new DatabaseError('Failed to update automation job progress');
    }
  }

  /**
   * Update automation job result summary
   */
  async updateResultSummary(
    id: string,
    resultSummary: AutomationJobResultSummary
  ): Promise<AutomationJob> {
    try {
      return await this.prisma.automationJob.update({
        where: { id },
        data: { resultSummary: resultSummary as Prisma.InputJsonValue },
      });
    } catch (error) {
      logger.error('Failed to update automation job result summary', { id, resultSummary, error });
      throw new DatabaseError('Failed to update automation job result summary');
    }
  }

  /**
   * Complete automation job with summary
   */
  async complete(id: string, resultSummary: AutomationJobResultSummary): Promise<AutomationJob> {
    try {
      return await this.prisma.automationJob.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          resultSummary: resultSummary as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      logger.error('Failed to complete automation job', { id, error });
      throw new DatabaseError('Failed to complete automation job');
    }
  }

  /**
   * Get automation job statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byStage: Record<string, number>;
    avgDurationMs: number;
    successRate: number;
  }> {
    try {
      const [total, statusGroups, stageGroups, completedJobs] = await Promise.all([
        this.prisma.automationJob.count(),
        this.prisma.automationJob.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.automationJob.groupBy({
          by: ['currentStage'],
          _count: { _all: true },
          where: { currentStage: { not: null } },
        }),
        this.prisma.automationJob.findMany({
          where: {
            status: { in: ['completed', 'failed'] },
            startedAt: { not: null },
            completedAt: { not: null },
          },
          select: {
            status: true,
            startedAt: true,
            completedAt: true,
          },
        }),
      ]);

      const byStatus: Record<string, number> = {};
      for (const group of statusGroups) {
        byStatus[group.status] = group._count._all;
      }

      const byStage: Record<string, number> = {};
      for (const group of stageGroups) {
        if (group.currentStage) {
          byStage[group.currentStage] = group._count._all;
        }
      }

      // Calculate average duration and success rate
      let totalDuration = 0;
      let completedCount = 0;
      let successCount = 0;

      for (const job of completedJobs) {
        if (job.startedAt && job.completedAt) {
          totalDuration += job.completedAt.getTime() - job.startedAt.getTime();
          completedCount++;
        }
        if (job.status === 'completed') {
          successCount++;
        }
      }

      const avgDurationMs = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;
      const successRate =
        completedJobs.length > 0 ? Math.round((successCount / completedJobs.length) * 100) : 0;

      return {
        total,
        byStatus,
        byStage,
        avgDurationMs,
        successRate,
      };
    } catch (error) {
      logger.error('Failed to get automation job statistics', { error });
      throw new DatabaseError('Failed to get statistics');
    }
  }

  /**
   * Delete old completed automation jobs (cleanup)
   */
  async deleteOldCompleted(olderThan: Date): Promise<{ count: number }> {
    try {
      const result = await this.prisma.automationJob.deleteMany({
        where: {
          status: { in: ['completed', 'failed', 'cancelled'] },
          completedAt: { lt: olderThan },
        },
      });
      logger.info(`Deleted ${result.count} old automation jobs`);
      return result;
    } catch (error) {
      logger.error('Failed to delete old automation jobs', { olderThan, error });
      throw new DatabaseError('Failed to delete old automation jobs');
    }
  }

  /**
   * Get recent automation jobs
   */
  async getRecent(limit: number = 10): Promise<AutomationJobWithTemplate[]> {
    try {
      return await this.prisma.automationJob.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          template: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get recent automation jobs', { error });
      throw new DatabaseError('Failed to get recent automation jobs');
    }
  }
}

// Singleton instance
let automationJobRepository: AutomationJobRepository | null = null;

/**
 * Get singleton AutomationJobRepository instance
 */
export function getAutomationJobRepository(prisma?: PrismaClient): AutomationJobRepository {
  if (!automationJobRepository) {
    const prismaClient = prisma || new PrismaClient();
    automationJobRepository = new AutomationJobRepository(prismaClient);
  }
  return automationJobRepository;
}
