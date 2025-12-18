/**
 * Product Repository
 * Data access layer for Product entity
 */

import { PrismaClient, Product, Prisma } from '@prisma/client';
import { BaseRepository, PaginationOptions, PaginatedResult } from './base.repository';
import { DatabaseError } from '../errors/AppError';
import logger from '../utils/logger';

/**
 * Create product input
 */
export interface CreateProductInput {
  articleNumber: string;
  productName: string;
  sourceUrl: string;
  description?: string;
  price?: number;
  priceType?: string;
  tieredPrices?: Prisma.InputJsonValue;
  tieredPricesText?: string;
  currency?: string;
  category?: string;
  manufacturer?: string;
  ean?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  crawlJobId?: string;
  ocrConfidence?: number;
}

/**
 * Update product input
 */
export interface UpdateProductInput {
  articleNumber?: string;
  productName?: string;
  sourceUrl?: string;
  description?: string;
  price?: number;
  priceType?: string;
  tieredPrices?: Prisma.InputJsonValue;
  tieredPricesText?: string;
  currency?: string;
  category?: string;
  manufacturer?: string;
  ean?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  crawlJobId?: string;
  ocrConfidence?: number;
}

/**
 * Product query filters
 */
export interface ProductQueryFilters {
  category?: string;
  manufacturer?: string;
  minPrice?: number;
  maxPrice?: number;
  hasImage?: boolean;
  search?: string;
  crawlJobId?: string;
}

/**
 * Product Repository implementation
 */
export class ProductRepository extends BaseRepository<
  Product,
  CreateProductInput,
  UpdateProductInput
> {
  protected modelName = 'product';
  protected entityName = 'Product';

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  protected getModel() {
    return this.prisma.product;
  }

  /**
   * Find product by article number
   */
  async findByArticleNumber(articleNumber: string): Promise<Product | null> {
    try {
      return await this.prisma.product.findUnique({
        where: { articleNumber },
      });
    } catch (error) {
      logger.error('Failed to find product by article number', { articleNumber, error });
      throw new DatabaseError('Failed to find product');
    }
  }

  /**
   * Find product by EAN
   */
  async findByEan(ean: string): Promise<Product | null> {
    try {
      return await this.prisma.product.findFirst({
        where: { ean },
      });
    } catch (error) {
      logger.error('Failed to find product by EAN', { ean, error });
      throw new DatabaseError('Failed to find product');
    }
  }

  /**
   * Find all products with filters and pagination
   */
  async findAllWithFilters(
    filters: ProductQueryFilters = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Product>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ProductWhereInput = {};

    if (filters.category) {
      where.category = { contains: filters.category, mode: 'insensitive' };
    }

    if (filters.manufacturer) {
      where.manufacturer = { contains: filters.manufacturer, mode: 'insensitive' };
    }

    if (filters.crawlJobId) {
      where.crawlJobId = filters.crawlJobId;
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) {
        where.price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.price.lte = filters.maxPrice;
      }
    }

    if (filters.hasImage !== undefined) {
      if (filters.hasImage) {
        where.imageUrl = { not: null };
      } else {
        where.imageUrl = null;
      }
    }

    if (filters.search) {
      where.OR = [
        { productName: { contains: filters.search, mode: 'insensitive' } },
        { articleNumber: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { ean: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    try {
      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prisma.product.count({ where }),
      ]);

      return {
        data: products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to find products', { filters, options, error });
      throw new DatabaseError('Failed to fetch products');
    }
  }

  /**
   * Find products by category
   */
  async findByCategory(
    category: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Product>> {
    return this.findAllWithFilters({ category }, options);
  }

  /**
   * Find products by manufacturer
   */
  async findByManufacturer(
    manufacturer: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Product>> {
    return this.findAllWithFilters({ manufacturer }, options);
  }

  /**
   * Search products by text
   */
  async search(query: string, options: PaginationOptions = {}): Promise<PaginatedResult<Product>> {
    return this.findAllWithFilters({ search: query }, options);
  }

  /**
   * Batch create products
   */
  async createMany(products: CreateProductInput[]): Promise<{ count: number }> {
    try {
      const result = await this.prisma.product.createMany({
        data: products,
        skipDuplicates: true,
      });
      logger.info(`Created ${result.count} products`);
      return result;
    } catch (error) {
      logger.error('Failed to batch create products', { count: products.length, error });
      throw new DatabaseError('Failed to create products');
    }
  }

  /**
   * Batch update products
   */
  async updateMany(ids: string[], data: UpdateProductInput): Promise<{ count: number }> {
    try {
      const result = await this.prisma.product.updateMany({
        where: { id: { in: ids } },
        data,
      });
      logger.info(`Updated ${result.count} products`);
      return result;
    } catch (error) {
      logger.error('Failed to batch update products', { ids, error });
      throw new DatabaseError('Failed to update products');
    }
  }

  /**
   * Batch delete products
   */
  async deleteMany(ids: string[]): Promise<{ count: number }> {
    try {
      const result = await this.prisma.product.deleteMany({
        where: { id: { in: ids } },
      });
      logger.info(`Deleted ${result.count} products`);
      return result;
    } catch (error) {
      logger.error('Failed to batch delete products', { ids, error });
      throw new DatabaseError('Failed to delete products');
    }
  }

  /**
   * Get unique categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const result = await this.prisma.product.findMany({
        where: { category: { not: null } },
        select: { category: true },
        distinct: ['category'],
      });
      return result.map((p) => p.category!).filter(Boolean);
    } catch (error) {
      logger.error('Failed to get categories', { error });
      throw new DatabaseError('Failed to get categories');
    }
  }

  /**
   * Get unique manufacturers
   */
  async getManufacturers(): Promise<string[]> {
    try {
      const result = await this.prisma.product.findMany({
        where: { manufacturer: { not: null } },
        select: { manufacturer: true },
        distinct: ['manufacturer'],
      });
      return result.map((p) => p.manufacturer!).filter(Boolean);
    } catch (error) {
      logger.error('Failed to get manufacturers', { error });
      throw new DatabaseError('Failed to get manufacturers');
    }
  }

  /**
   * Get products statistics
   */
  async getStatistics(): Promise<{
    total: number;
    withImages: number;
    withPrice: number;
    byCategory: Record<string, number>;
  }> {
    try {
      const [total, withImages, withPrice, categoryGroups] = await Promise.all([
        this.prisma.product.count(),
        this.prisma.product.count({ where: { imageUrl: { not: null } } }),
        this.prisma.product.count({ where: { price: { not: null } } }),
        this.prisma.product.groupBy({
          by: ['category'],
          _count: { _all: true },
        }),
      ]);

      const byCategory: Record<string, number> = {};
      for (const group of categoryGroups) {
        if (group.category) {
          byCategory[group.category] = group._count._all;
        }
      }

      return { total, withImages, withPrice, byCategory };
    } catch (error) {
      logger.error('Failed to get product statistics', { error });
      throw new DatabaseError('Failed to get statistics');
    }
  }

  /**
   * Find products by crawl job
   */
  async findByCrawlJob(
    crawlJobId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Product>> {
    return this.findAllWithFilters({ crawlJobId }, options);
  }
}

// Singleton instance
let productRepository: ProductRepository | null = null;

/**
 * Get singleton ProductRepository instance
 */
export function getProductRepository(prisma?: PrismaClient): ProductRepository {
  if (!productRepository) {
    const prismaClient = prisma || new PrismaClient();
    productRepository = new ProductRepository(prismaClient);
  }
  return productRepository;
}
