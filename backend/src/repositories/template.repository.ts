/**
 * Template Repository
 * Data access layer for Template entity
 */

import { PrismaClient, Template, Prisma } from '@prisma/client';
import { BaseRepository, PaginationOptions, PaginatedResult } from './base.repository';
import { DatabaseError } from '../errors/AppError';
import logger from '../utils/logger';

/**
 * Create template input
 */
export interface CreateTemplateInput {
  name: string;
  description?: string;
  width: number;
  height: number;
  unit?: string;
  dpi?: number;
  layers: Prisma.InputJsonValue;
  backgroundColor?: string;
}

/**
 * Update template input
 */
export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  width?: number;
  height?: number;
  unit?: string;
  dpi?: number;
  layers?: Prisma.InputJsonValue;
  backgroundColor?: string;
}

/**
 * Template query filters
 */
export interface TemplateQueryFilters {
  search?: string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

/**
 * Template with labels count
 */
export interface TemplateWithStats extends Template {
  _count?: {
    labels: number;
    automationJobs: number;
  };
}

/**
 * Template Repository implementation
 */
export class TemplateRepository extends BaseRepository<
  Template,
  CreateTemplateInput,
  UpdateTemplateInput
> {
  protected modelName = 'template';
  protected entityName = 'Template';

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  protected getModel() {
    return this.prisma.template;
  }

  /**
   * Find template by ID with stats
   */
  async findByIdWithStats(id: string): Promise<TemplateWithStats | null> {
    try {
      return await this.prisma.template.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              labels: true,
              automationJobs: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find template with stats', { id, error });
      throw new DatabaseError('Failed to find template');
    }
  }

  /**
   * Find template by name
   */
  async findByName(name: string): Promise<Template | null> {
    try {
      return await this.prisma.template.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
    } catch (error) {
      logger.error('Failed to find template by name', { name, error });
      throw new DatabaseError('Failed to find template');
    }
  }

  /**
   * Find all templates with filters and pagination
   */
  async findAllWithFilters(
    filters: TemplateQueryFilters = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<TemplateWithStats>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.TemplateWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.minWidth !== undefined || filters.maxWidth !== undefined) {
      where.width = {};
      if (filters.minWidth !== undefined) {
        where.width.gte = filters.minWidth;
      }
      if (filters.maxWidth !== undefined) {
        where.width.lte = filters.maxWidth;
      }
    }

    if (filters.minHeight !== undefined || filters.maxHeight !== undefined) {
      where.height = {};
      if (filters.minHeight !== undefined) {
        where.height.gte = filters.minHeight;
      }
      if (filters.maxHeight !== undefined) {
        where.height.lte = filters.maxHeight;
      }
    }

    try {
      const [templates, total] = await Promise.all([
        this.prisma.template.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            _count: {
              select: {
                labels: true,
                automationJobs: true,
              },
            },
          },
        }),
        this.prisma.template.count({ where }),
      ]);

      return {
        data: templates,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to find templates', { filters, options, error });
      throw new DatabaseError('Failed to fetch templates');
    }
  }

  /**
   * Search templates by name or description
   */
  async search(
    query: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<TemplateWithStats>> {
    return this.findAllWithFilters({ search: query }, options);
  }

  /**
   * Duplicate a template
   */
  async duplicate(id: string, newName: string): Promise<Template> {
    try {
      const original = await this.findByIdOrThrow(id);

      const duplicated = await this.prisma.template.create({
        data: {
          name: newName,
          description: original.description ? `Copy of: ${original.description}` : null,
          width: original.width,
          height: original.height,
          unit: original.unit,
          dpi: original.dpi,
          layers: original.layers as Prisma.InputJsonValue,
          backgroundColor: original.backgroundColor,
        },
      });

      logger.info('Duplicated template', { originalId: id, newId: duplicated.id });
      return duplicated;
    } catch (error) {
      logger.error('Failed to duplicate template', { id, newName, error });
      throw new DatabaseError('Failed to duplicate template');
    }
  }

  /**
   * Update template layers
   */
  async updateLayers(id: string, layers: Prisma.InputJsonValue): Promise<Template> {
    try {
      return await this.prisma.template.update({
        where: { id },
        data: { layers },
      });
    } catch (error) {
      logger.error('Failed to update template layers', { id, error });
      throw new DatabaseError('Failed to update template layers');
    }
  }

  /**
   * Get template statistics
   */
  async getStatistics(): Promise<{
    total: number;
    totalLabels: number;
    avgLabelsPerTemplate: number;
    byDimension: Array<{ width: number; height: number; count: number }>;
  }> {
    try {
      const [total, labelStats, dimensionGroups] = await Promise.all([
        this.prisma.template.count(),
        this.prisma.label.groupBy({
          by: ['templateId'],
          _count: { _all: true },
        }),
        this.prisma.template.groupBy({
          by: ['width', 'height'],
          _count: { _all: true },
        }),
      ]);

      const totalLabels = labelStats.reduce((sum, g) => sum + g._count._all, 0);
      const avgLabelsPerTemplate = total > 0 ? Math.round(totalLabels / total) : 0;

      const byDimension = dimensionGroups.map((group) => ({
        width: group.width,
        height: group.height,
        count: group._count._all,
      }));

      return {
        total,
        totalLabels,
        avgLabelsPerTemplate,
        byDimension,
      };
    } catch (error) {
      logger.error('Failed to get template statistics', { error });
      throw new DatabaseError('Failed to get statistics');
    }
  }

  /**
   * Check if template is in use
   */
  async isInUse(id: string): Promise<boolean> {
    try {
      const [labelCount, automationCount] = await Promise.all([
        this.prisma.label.count({ where: { templateId: id } }),
        this.prisma.automationJob.count({ where: { templateId: id } }),
      ]);
      return labelCount > 0 || automationCount > 0;
    } catch (error) {
      logger.error('Failed to check if template is in use', { id, error });
      throw new DatabaseError('Failed to check template usage');
    }
  }

  /**
   * Get most used templates
   */
  async getMostUsed(limit: number = 5): Promise<TemplateWithStats[]> {
    try {
      // Get templates with label counts
      const templates = await this.prisma.template.findMany({
        include: {
          _count: {
            select: {
              labels: true,
              automationJobs: true,
            },
          },
        },
      });

      // Sort by total usage (labels + automation jobs)
      return templates
        .sort((a, b) => {
          const aTotal = (a._count?.labels || 0) + (a._count?.automationJobs || 0);
          const bTotal = (b._count?.labels || 0) + (b._count?.automationJobs || 0);
          return bTotal - aTotal;
        })
        .slice(0, limit);
    } catch (error) {
      logger.error('Failed to get most used templates', { error });
      throw new DatabaseError('Failed to get most used templates');
    }
  }
}

// Singleton instance
let templateRepository: TemplateRepository | null = null;

/**
 * Get singleton TemplateRepository instance
 */
export function getTemplateRepository(prisma?: PrismaClient): TemplateRepository {
  if (!templateRepository) {
    const prismaClient = prisma || new PrismaClient();
    templateRepository = new TemplateRepository(prismaClient);
  }
  return templateRepository;
}
