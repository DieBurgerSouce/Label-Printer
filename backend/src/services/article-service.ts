/**
 * Article Service - PostgreSQL Database via Prisma
 * ✅ FIXED: Now uses DATABASE instead of local JSON file!
 */

import { prisma } from '../lib/prisma.js';
import type { JsonValue } from '@prisma/client/runtime/library';
import logger from '../utils/logger.js';

/** Tiered price entry structure */
interface TieredPriceEntry {
  quantity: number;
  price: number | string;
}

/** Helper to safely parse tiered prices from Prisma JsonValue */
function parseTieredPrices(json: JsonValue | null): TieredPriceEntry[] | undefined {
  if (!json || !Array.isArray(json)) return undefined;
  return json as unknown as TieredPriceEntry[];
}

export interface Article {
  id: string;
  articleNumber: string;
  productName: string;
  description?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  category?: string;
  tieredPrices?: TieredPriceEntry[];
  tieredPricesText?: string;
  sourceUrl?: string;
}

export class ArticleService {
  static async getArticleById(id: string): Promise<Article | null> {
    try {
      // Try to find by ID first, then by articleNumber (same logic as API)
      const product = await prisma.product.findFirst({
        where: {
          OR: [{ id }, { articleNumber: id }],
        },
      });

      if (!product) {
        logger.debug('Article not found', { id });
        return null;
      }

      logger.debug('Found article from database', { articleNumber: product.articleNumber });

      // Convert Prisma Product to Article interface
      return {
        id: product.id,
        articleNumber: product.articleNumber,
        productName: product.productName,
        description: product.description || undefined,
        price: product.price ? Number(product.price) : undefined,
        currency: product.currency || 'EUR',
        imageUrl: product.imageUrl || undefined,
        category: product.category || undefined,
        tieredPrices: parseTieredPrices(product.tieredPrices),
        tieredPricesText: product.tieredPricesText || undefined,
        sourceUrl: product.sourceUrl || undefined,
      };
    } catch (error) {
      logger.error('Error fetching article from database', { id, error });
      return null;
    }
  }

  static async getAllArticles(): Promise<Article[]> {
    try {
      const products = await prisma.product.findMany({
        where: { published: true },
        orderBy: { createdAt: 'desc' },
      });

      // Convert Prisma Products to Article interface
      return products.map((product) => ({
        id: product.id,
        articleNumber: product.articleNumber,
        productName: product.productName,
        description: product.description || undefined,
        price: product.price ? Number(product.price) : undefined,
        currency: product.currency || 'EUR',
        imageUrl: product.imageUrl || undefined,
        category: product.category || undefined,
        tieredPrices: parseTieredPrices(product.tieredPrices),
        tieredPricesText: product.tieredPricesText || undefined,
        sourceUrl: product.sourceUrl || undefined,
      }));
    } catch (error) {
      logger.error('Error reading articles from database', { error });
      return [];
    }
  }
}
