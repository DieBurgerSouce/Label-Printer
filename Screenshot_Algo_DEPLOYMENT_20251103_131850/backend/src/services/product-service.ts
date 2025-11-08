/**
 * Product Service
 * Manages product creation and updates from crawled data
 */
import { prisma } from '../lib/supabase';
import type { OcrResult, Screenshot } from '@prisma/client';

export interface CreateProductFromOcrParams {
  ocrResult: OcrResult;
  screenshot: Screenshot;
  crawlJobId?: string;
}

export class ProductService {
  /**
   * Create or update a product from OCR results
   */
  static async createOrUpdateFromOcr({
    ocrResult,
    screenshot,
    crawlJobId
  }: CreateProductFromOcrParams) {
    try {
      // Skip if OCR failed or no article number found
      if (ocrResult.status !== 'completed' || !ocrResult.articleNumber) {
        console.log(`Skipping product creation: OCR status=${ocrResult.status}, articleNumber=${ocrResult.articleNumber}`);
        return null;
      }

      const productData = {
        articleNumber: ocrResult.articleNumber,
        productName: ocrResult.productName || screenshot.productName || 'Unknown Product',
        description: ocrResult.fullText?.substring(0, 500), // First 500 chars
        price: ocrResult.price || 0,
        tieredPrices: ocrResult.tieredPrices as any || [],
        tieredPricesText: (ocrResult as any).tieredPricesText || null, // Raw text from OCR (e.g., "ab 7 Stück: 190,92 EUR\nab 24 Stück: 180,60 EUR")
        imageUrl: screenshot.imageUrl,
        thumbnailUrl: screenshot.thumbnailUrl,
        ean: ocrResult.ean,
        sourceUrl: screenshot.productUrl,
        crawlJobId,
        ocrConfidence: ocrResult.confidence,
        verified: false,
        published: true
      };

      // Try to find existing product by article number
      const existing = await prisma.product.findUnique({
        where: { articleNumber: ocrResult.articleNumber }
      });

      if (existing) {
        // Update existing product if new data has higher confidence
        if (!ocrResult.confidence || !existing.ocrConfidence || ocrResult.confidence > existing.ocrConfidence) {
          const updated = await prisma.product.update({
            where: { id: existing.id },
            data: productData
          });
          console.log(`Updated product: ${updated.articleNumber}`);
          return updated;
        } else {
          console.log(`Skipped update for ${existing.articleNumber} (lower confidence)`);
          return existing;
        }
      } else {
        // Create new product
        const created = await prisma.product.create({
          data: productData
        });
        console.log(`Created new product: ${created.articleNumber}`);
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating product from OCR:', error);
      return null;
    }
  }

  /**
   * Batch create products from multiple OCR results
   */
  static async batchCreateFromOcr(
    ocrResults: (OcrResult & { screenshot: Screenshot })[],
    crawlJobId?: string
  ) {
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };

    for (const ocrResult of ocrResults) {
      try {
        const product = await this.createOrUpdateFromOcr({
          ocrResult,
          screenshot: ocrResult.screenshot,
          crawlJobId
        });

        if (product) {
          // Check if it was created or updated by comparing timestamps
          const wasJustCreated = new Date(product.createdAt).getTime() === new Date(product.updatedAt).getTime();
          if (wasJustCreated) {
            results.created++;
          } else {
            results.updated++;
          }
        } else {
          results.skipped++;
        }
      } catch (error) {
        console.error('Error processing OCR result:', error);
        results.errors++;
      }
    }

    return results;
  }

  /**
   * Process all OCR results from a crawl job
   */
  static async processOcrResultsFromCrawlJob(crawlJobId: string) {
    try {
      // Get all completed OCR results from this crawl job
      const ocrResults = await prisma.ocrResult.findMany({
        where: {
          screenshot: {
            crawlJobId
          },
          status: 'completed',
          articleNumber: { not: null }
        },
        include: {
          screenshot: true
        }
      });

      console.log(`Processing ${ocrResults.length} OCR results from crawl job ${crawlJobId}`);

      const results = await this.batchCreateFromOcr(ocrResults, crawlJobId);

      console.log(`Product processing complete:`, results);

      return results;
    } catch (error) {
      console.error('Error processing OCR results from crawl job:', error);
      throw error;
    }
  }

  /**
   * Process OCR results directly from automation job
   */
  static async processOcrResultsFromAutomation(ocrResults: any[], crawlJobId?: string) {
    try {
      const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      };

      for (const ocrResult of ocrResults) {
        try {
          // Skip if OCR failed or no article number found
          if (!ocrResult.success || !ocrResult.extractedData?.articleNumber) {
            console.log(`Skipping product: no article number`);
            results.skipped++;
            continue;
          }

          const extractedData = ocrResult.extractedData;

          // Parse tiered prices if they're a string
          let tieredPrices = [];
          if (extractedData.tieredPrices) {
            try {
              tieredPrices = typeof extractedData.tieredPrices === 'string'
                ? JSON.parse(extractedData.tieredPrices)
                : extractedData.tieredPrices;
            } catch (e) {
              console.log('Failed to parse tiered prices:', e);
            }
          }

          // Find the product image screenshot path
          let imageUrl = null;
          let thumbnailUrl = null;

          // Try to find screenshots for this article
          if (crawlJobId && extractedData.articleNumber) {
            // Build the expected path for the product image
            const expectedPath = `/api/images/screenshots/${crawlJobId}/${extractedData.articleNumber}/product-image.png`;
            imageUrl = expectedPath;
            // Use article-number as thumbnail
            thumbnailUrl = `/api/images/screenshots/${crawlJobId}/${extractedData.articleNumber}/article-number.png`;
          }

          const productData = {
            articleNumber: extractedData.articleNumber,
            productName: extractedData.productName || 'Unknown Product',
            description: extractedData.description?.substring(0, 500), // First 500 chars
            price: parseFloat(extractedData.price) || 0,
            tieredPrices: tieredPrices,
            tieredPricesText: extractedData.tieredPricesText || null, // Raw OCR text for labels
            imageUrl: imageUrl, // Set the image URL
            thumbnailUrl: thumbnailUrl, // Set the thumbnail URL
            ean: extractedData.ean,
            sourceUrl: ocrResult.productUrl || extractedData.sourceUrl || 'https://shop.firmenich.de', // Use product URL from OCR result
            crawlJobId,
            ocrConfidence: ocrResult.confidence || 0,
            verified: false,
            published: true
          };

          // Try to find existing product by article number
          const existing = await prisma.product.findUnique({
            where: { articleNumber: extractedData.articleNumber }
          });

          if (existing) {
            // ALWAYS update existing product with new crawl data (regardless of confidence)
            // This ensures products stay fresh with latest shop data
            const updated = await prisma.product.update({
              where: { id: existing.id },
              data: productData
            });
            console.log(`✅ Updated product: ${updated.articleNumber} (confidence: ${productData.ocrConfidence})`);
            results.updated++;
          } else {
            // Create new product
            const created = await prisma.product.create({
              data: productData
            });
            console.log(`✅ Created new product: ${created.articleNumber}`);
            results.created++;
          }
        } catch (error) {
          console.error('Error processing OCR result:', error);
          results.errors++;
        }
      }

      console.log(`Product processing complete:`, results);
      return results;
    } catch (error) {
      console.error('Error processing OCR results from automation:', error);
      throw error;
    }
  }

  /**
   * Get products statistics
   */
  static async getStats() {
    const [total, withImages, verified, byCategory] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { imageUrl: { not: null } } }),
      prisma.product.count({ where: { verified: true } }),
      prisma.product.groupBy({
        by: ['category'],
        _count: true,
        where: { category: { not: null } }
      })
    ]);

    return {
      total,
      withImages,
      verified,
      categories: byCategory.map(c => ({
        name: c.category,
        count: c._count
      }))
    };
  }

  /**
   * Search products
   */
  static async search(query: string, limit = 20) {
    return prisma.product.findMany({
      where: {
        OR: [
          { articleNumber: { contains: query, mode: 'insensitive' } },
          { productName: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ],
        published: true
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
  }
}
