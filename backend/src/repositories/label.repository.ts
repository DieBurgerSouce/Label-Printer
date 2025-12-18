/**
 * Label Repository
 * Data access layer for Label entity
 */

import { PrismaClient, Label, Prisma } from '@prisma/client';
import { BaseRepository, PaginationOptions, PaginatedResult } from './base.repository';
import { DatabaseError } from '../errors/AppError';
import logger from '../utils/logger';

/**
 * Label status enum
 */
export type LabelStatus = 'pending' | 'rendering' | 'completed' | 'failed';

/**
 * Create label input
 */
export interface CreateLabelInput {
  templateId: string;
  data: Prisma.InputJsonValue;
  status?: LabelStatus;
}

/**
 * Update label input
 */
export interface UpdateLabelInput {
  templateId?: string;
  data?: Prisma.InputJsonValue;
  imageUrl?: string | null;
  pdfUrl?: string | null;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
  status?: LabelStatus;
  error?: string | null;
}

/**
 * Label query filters
 */
export interface LabelQueryFilters {
  templateId?: string;
  status?: LabelStatus;
  hasImage?: boolean;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Label with template info
 */
export interface LabelWithTemplate extends Label {
  template?: {
    id: string;
    name: string;
    width: number;
    height: number;
  };
}

/**
 * Label Repository implementation
 */
export class LabelRepository extends BaseRepository<Label, CreateLabelInput, UpdateLabelInput> {
  protected modelName = 'label';
  protected entityName = 'Label';

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  protected getModel() {
    return this.prisma.label;
  }

  /**
   * Find label by ID with template
   */
  async findByIdWithTemplate(id: string): Promise<LabelWithTemplate | null> {
    try {
      return await this.prisma.label.findUnique({
        where: { id },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              width: true,
              height: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find label with template', { id, error });
      throw new DatabaseError('Failed to find label');
    }
  }

  /**
   * Find all labels with filters and pagination
   */
  async findAllWithFilters(
    filters: LabelQueryFilters = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<LabelWithTemplate>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.LabelWhereInput = {};

    if (filters.templateId) {
      where.templateId = filters.templateId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.hasImage !== undefined) {
      if (filters.hasImage) {
        where.imageUrl = { not: null };
      } else {
        where.imageUrl = null;
      }
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
      const [labels, total] = await Promise.all([
        this.prisma.label.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            template: {
              select: {
                id: true,
                name: true,
                width: true,
                height: true,
              },
            },
          },
        }),
        this.prisma.label.count({ where }),
      ]);

      return {
        data: labels,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to find labels', { filters, options, error });
      throw new DatabaseError('Failed to fetch labels');
    }
  }

  /**
   * Find labels by template
   */
  async findByTemplate(
    templateId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<LabelWithTemplate>> {
    return this.findAllWithFilters({ templateId }, options);
  }

  /**
   * Find labels by status
   */
  async findByStatus(
    status: LabelStatus,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<LabelWithTemplate>> {
    return this.findAllWithFilters({ status }, options);
  }

  /**
   * Find pending labels for rendering
   */
  async findPending(limit: number = 10): Promise<Label[]> {
    try {
      return await this.prisma.label.findMany({
        where: { status: 'pending' },
        take: limit,
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to find pending labels', { error });
      throw new DatabaseError('Failed to fetch pending labels');
    }
  }

  /**
   * Update label status
   */
  async updateStatus(id: string, status: LabelStatus, error?: string): Promise<Label> {
    try {
      const updateData: UpdateLabelInput = { status };
      if (error) {
        updateData.error = error;
      }

      const label = await this.prisma.label.update({
        where: { id },
        data: updateData,
      });

      logger.info('Updated label status', { id, status });
      return label;
    } catch (error) {
      logger.error('Failed to update label status', { id, status, error });
      throw new DatabaseError('Failed to update label status');
    }
  }

  /**
   * Update rendered label
   */
  async updateRendered(
    id: string,
    imageUrl: string,
    width: number,
    height: number,
    fileSize: number
  ): Promise<Label> {
    try {
      return await this.prisma.label.update({
        where: { id },
        data: {
          imageUrl,
          width,
          height,
          fileSize,
          status: 'completed',
        },
      });
    } catch (error) {
      logger.error('Failed to update rendered label', { id, error });
      throw new DatabaseError('Failed to update rendered label');
    }
  }

  /**
   * Batch create labels
   */
  async createMany(labels: CreateLabelInput[]): Promise<{ count: number }> {
    try {
      const result = await this.prisma.label.createMany({
        data: labels,
        skipDuplicates: true,
      });
      logger.info(`Created ${result.count} labels`);
      return result;
    } catch (error) {
      logger.error('Failed to batch create labels', { count: labels.length, error });
      throw new DatabaseError('Failed to create labels');
    }
  }

  /**
   * Batch delete labels
   */
  async deleteMany(ids: string[]): Promise<{ count: number }> {
    try {
      const result = await this.prisma.label.deleteMany({
        where: { id: { in: ids } },
      });
      logger.info(`Deleted ${result.count} labels`);
      return result;
    } catch (error) {
      logger.error('Failed to batch delete labels', { ids, error });
      throw new DatabaseError('Failed to delete labels');
    }
  }

  /**
   * Get label statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byTemplate: Array<{ templateId: string; templateName: string; count: number }>;
    totalFileSize: number;
  }> {
    try {
      const [total, statusGroups, templateGroups, fileSizeSum] = await Promise.all([
        this.prisma.label.count(),
        this.prisma.label.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.label.groupBy({
          by: ['templateId'],
          _count: { _all: true },
        }),
        this.prisma.label.aggregate({
          _sum: { fileSize: true },
        }),
      ]);

      const byStatus: Record<string, number> = {};
      for (const group of statusGroups) {
        byStatus[group.status] = group._count._all;
      }

      // Get template names for the grouped results
      const templateIds = templateGroups.map((g) => g.templateId);
      const templates = await this.prisma.template.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, name: true },
      });
      const templateNameMap = new Map(templates.map((t) => [t.id, t.name]));

      const byTemplate = templateGroups.map((group) => ({
        templateId: group.templateId,
        templateName: templateNameMap.get(group.templateId) || 'Unknown',
        count: group._count._all,
      }));

      return {
        total,
        byStatus,
        byTemplate,
        totalFileSize: fileSizeSum._sum.fileSize || 0,
      };
    } catch (error) {
      logger.error('Failed to get label statistics', { error });
      throw new DatabaseError('Failed to get statistics');
    }
  }

  /**
   * Delete old failed labels (cleanup)
   */
  async deleteOldFailed(olderThan: Date): Promise<{ count: number }> {
    try {
      const result = await this.prisma.label.deleteMany({
        where: {
          status: 'failed',
          updatedAt: { lt: olderThan },
        },
      });
      logger.info(`Deleted ${result.count} old failed labels`);
      return result;
    } catch (error) {
      logger.error('Failed to delete old failed labels', { olderThan, error });
      throw new DatabaseError('Failed to delete old failed labels');
    }
  }
}

// Singleton instance
let labelRepository: LabelRepository | null = null;

/**
 * Get singleton LabelRepository instance
 */
export function getLabelRepository(prisma?: PrismaClient): LabelRepository {
  if (!labelRepository) {
    const prismaClient = prisma || new PrismaClient();
    labelRepository = new LabelRepository(prismaClient);
  }
  return labelRepository;
}
