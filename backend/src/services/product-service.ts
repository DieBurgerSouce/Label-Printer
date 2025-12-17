/**
 * Product Service
 * Manages product creation and updates from crawled data
 */
import { prisma } from '../lib/prisma';
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

      // CRITICAL: Validate we have actual product data
      const hasProductName = !!(ocrResult.productName || screenshot.productName);
      const hasDescription = !!(ocrResult.fullText && ocrResult.fullText.length > 10);

      if (!hasProductName && !hasDescription) {
        console.log(`❌ SKIPPING ${ocrResult.articleNumber}: No product name AND no description - failed OCR extraction`);
        return null;
      }

      const productData = {
        articleNumber: ocrResult.articleNumber,
        productName: ocrResult.productName || screenshot.productName || 'Unknown Product',
        description: ocrResult.fullText?.substring(0, 500), // First 500 chars
        price: ocrResult.price !== undefined ? ocrResult.price : 0,
        priceType: (ocrResult as any).priceType || 'normal', // auf_anfrage, normal, tiered, unknown
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
        // ALWAYS update if existing product has placeholder name (broken data)
        const hasPlaceholderName = existing.productName?.startsWith('Product ');
        const hasNoDescription = !existing.description || existing.description.trim() === '';
        const hasNoPrice = existing.price === null || existing.price === 0;
        const isBroken = hasPlaceholderName || (hasNoDescription && hasNoPrice);

        // Update if: broken data OR higher confidence OR no confidence info
        if (isBroken || !ocrResult.confidence || !existing.ocrConfidence || ocrResult.confidence > existing.ocrConfidence) {
          // CRITICAL: Preserve existing images if new data has no images
          // This prevents image loss during re-crawl when screenshots aren't regenerated
          const updateData = {
            ...productData,
            imageUrl: productData.imageUrl || existing.imageUrl,
            thumbnailUrl: productData.thumbnailUrl || existing.thumbnailUrl
          };

          const updated = await prisma.product.update({
            where: { id: existing.id },
            data: updateData
          });
          if (isBroken) {
            console.log(`Force-updated broken product: ${updated.articleNumber} (had placeholder/incomplete data)`);
          } else {
            console.log(`Updated product: ${updated.articleNumber} (higher confidence)`);
          }
          return updated;
        } else {
          console.log(`Skipped update for ${existing.articleNumber} (lower confidence, data already complete)`);
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
          // DEFENSIVE: Try to get extractedData from multiple possible locations
          let extractedData = ocrResult.extractedData || ocrResult;

          // Get article number from ANY available location
          const articleNumber = extractedData.articleNumber ||
                                ocrResult.articleNumber ||
                                ocrResult?.extractedData?.articleNumber;

          // DEBUG: Log what we received
          console.log(`🐛 DEBUG ocrResult:`, {
            success: ocrResult.success,
            status: ocrResult.status,
            hasExtractedData: !!ocrResult.extractedData,
            hasTopLevelArticleNumber: !!ocrResult.articleNumber,
            extractedDataArticleNumber: ocrResult.extractedData?.articleNumber,
            finalArticleNumber: articleNumber,
            ocrResultKeys: Object.keys(ocrResult).slice(0, 10) // First 10 keys
          });

          // Skip ONLY if no article number found anywhere
          if (!articleNumber) {
            console.log(`⚠️ Skipping product: No article number found in any location`, {
              hasOcrResult: !!ocrResult,
              ocrResultType: typeof ocrResult,
              hasExtractedData: !!ocrResult?.extractedData,
              sampleKeys: Object.keys(ocrResult || {}).slice(0, 5)
            });
            results.skipped++;
            continue;
          }

          // Ensure extractedData has article number
          if (!extractedData.articleNumber) {
            extractedData.articleNumber = articleNumber;
          }

          // CRITICAL: Validate that we have actual data
          // If both productName AND description are empty, this is a failed extraction
          // DO NOT save placeholder products - skip them instead
          if (!extractedData.productName && !extractedData.description) {
            console.log(`❌ SKIPPING ${extractedData.articleNumber}: No product name AND no description - failed extraction`);
            return null; // Skip this product instead of saving garbage
          }

          // Add fallback for missing product name (only if we have a description)
          if (!extractedData.productName) {
            extractedData.productName = `Product ${extractedData.articleNumber}`;
          }

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
          let screenshotArticleNumber = null;

          // CRITICAL: Extract the article number from screenshotPath
          // Screenshot service uses /\d{3,}/ regex which ONLY matches base numbers (e.g., "3556")
          // HTML extraction uses /\d+[A-Za-z0-9\-./]*/ which matches variants (e.g., "3556-ST")
          // So screenshots are in /3556/ folder but extracted articleNumber is "3556-ST"
          // We MUST extract the folder name from screenshotPath!
          if (ocrResult.screenshotPath) {
            // Extract article folder from path like "data/screenshots/{jobId}/3556/product-image.png"
            const pathMatch = ocrResult.screenshotPath.match(/\/screenshots\/[^\/]+\/([^\/]+)\//);
            if (pathMatch && pathMatch[1]) {
              screenshotArticleNumber = pathMatch[1];
              console.log(`📁 Extracted screenshot folder: ${screenshotArticleNumber} from path: ${ocrResult.screenshotPath}`);
            }
          }

          // Try to find screenshots for this article
          if (crawlJobId && screenshotArticleNumber) {
            // Use the folder name from screenshotPath (this is where images actually are!)
            const expectedPath = `/api/images/screenshots/${crawlJobId}/${screenshotArticleNumber}/product-image.png`;
            imageUrl = expectedPath;
            // Use article-number as thumbnail
            thumbnailUrl = `/api/images/screenshots/${crawlJobId}/${screenshotArticleNumber}/article-number.png`;
          }

          const productData = {
            articleNumber: extractedData.articleNumber,
            productName: extractedData.productName || 'Unknown Product',
            description: extractedData.description?.substring(0, 500), // First 500 chars
            price: extractedData.price ? parseFloat(extractedData.price) : null,
            priceType: extractedData.priceType || 'normal',
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

          // FUZZY MATCHING: Handle variant suffixes (e.g., "3556-ST" should match "3556")
          // Extract base article number (remove variant suffix after dash)
          const baseArticleNumber = extractedData.articleNumber.split('-')[0];

          const existing = await prisma.product.findFirst({
            where: {
              OR: [
                // Exact match: "3556-ST" = "3556-ST"
                { articleNumber: extractedData.articleNumber },
                // Base match: "3556-ST" → matches "3556"
                { articleNumber: baseArticleNumber },
                // Variant pattern match: "3556" in DB should match "3556-ST" from HTML
                { articleNumber: { startsWith: baseArticleNumber + '-' } }
              ]
            }
          });

          if (existing) {
            // ALWAYS update existing product with new crawl data (regardless of confidence)
            // This ensures products stay fresh with latest shop data
            // UPDATE with NEW article number from shop (the extracted one is the correct one)
            await prisma.product.update({
              where: { id: existing.id },
              data: productData // Use all new data including correct article number
            });
            console.log(`✅ Updated product: ${existing.articleNumber} → ${extractedData.articleNumber} (confidence: ${productData.ocrConfidence})`);
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
