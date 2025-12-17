/**
 * Article Service - PostgreSQL Database via Prisma
 * ✅ FIXED: Now uses DATABASE instead of local JSON file!
 */

import { prisma } from '../lib/prisma.js';

export interface Article {
  id: string;
  articleNumber: string;
  productName: string;
  description?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  category?: string;
  tieredPrices?: Array<{ quantity: number; price: number | string }>;
  tieredPricesText?: string;
  sourceUrl?: string;
}

export class ArticleService {
  static async getArticleById(id: string): Promise<Article | null> {
    try {
      // Try to find by ID first, then by articleNumber (same logic as API)
      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { id },
            { articleNumber: id }
          ]
        }
      });

      if (!product) {
        console.log(`Article not found with id: ${id}`);
        return null;
      }

      console.log(`✅ Found article ${product.articleNumber} from DATABASE`);

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
        tieredPrices: product.tieredPrices as any || undefined,
        tieredPricesText: product.tieredPricesText || undefined,
        sourceUrl: product.sourceUrl || undefined,
      };
    } catch (error) {
      console.error(`Error fetching article ${id} from DATABASE:`, error);
      return null;
    }
  }

  static async getAllArticles(): Promise<Article[]> {
    try {
      const products = await prisma.product.findMany({
        where: { published: true },
        orderBy: { createdAt: 'desc' }
      });

      // Convert Prisma Products to Article interface
      return products.map(product => ({
        id: product.id,
        articleNumber: product.articleNumber,
        productName: product.productName,
        description: product.description || undefined,
        price: product.price ? Number(product.price) : undefined,
        currency: product.currency || 'EUR',
        imageUrl: product.imageUrl || undefined,
        category: product.category || undefined,
        tieredPrices: product.tieredPrices as any || undefined,
        tieredPricesText: product.tieredPricesText || undefined,
        sourceUrl: product.sourceUrl || undefined,
      }));
    } catch (error) {
      console.error('Error reading articles from DATABASE:', error);
      return [];
    }
  }
}