/**
 * Import articles from export file for fresh installations
 * This script imports all articles from data/articles-export.json
 */

import { prisma } from '../lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

interface ExportedArticle {
  id?: string;
  articleNumber: string;
  productName: string;
  description?: string;
  price?: number;
  tieredPricesText?: string;
  tieredPrices?: any;
  currency?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  ean?: string;
  manufacturer?: string;
  category?: string;
  sourceUrl?: string;
  crawlJobId?: string;
  ocrConfidence?: number;
  verified?: boolean;
  published?: boolean;
}

async function importArticlesFresh() {
  console.log('========================================');
  console.log('FRESH INSTALL: IMPORTING ARTICLES');
  console.log('========================================\n');

  try {
    // Load export file
    const exportPath = path.join(__dirname, '../../../data/articles-export.json');

    if (!fs.existsSync(exportPath)) {
      console.error('ERROR: Export file not found at data/articles-export.json');
      process.exit(1);
    }

    console.log('Loading articles from export file...');
    const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));

    const articles: ExportedArticle[] = exportData.articles;
    const metadata = exportData.metadata;

    console.log(`Found ${articles.length} articles to import`);
    console.log(`Export date: ${metadata.exportDate}`);
    console.log(`Categories: FROM_EXCEL=${metadata.categories.FROM_EXCEL}, SHOP_ONLY=${metadata.categories.SHOP_ONLY}`);
    console.log(`Needs tier quantities: ${metadata.categories.NEEDS_TIER_QUANTITIES}\n`);

    // Import in batches
    const BATCH_SIZE = 50;
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(articles.length / BATCH_SIZE);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} articles)...`);

      for (const article of batch) {
        try {
          // Check if article already exists
          const existing = await prisma.product.findUnique({
            where: { articleNumber: article.articleNumber }
          });

          if (existing) {
            console.log(`  Skipping ${article.articleNumber} - already exists`);
            skipped++;
            continue;
          }

          // Create article
          await prisma.product.create({
            data: {
              articleNumber: article.articleNumber,
              productName: article.productName,
              description: article.description || null,
              price: article.price || null,
              tieredPricesText: article.tieredPricesText || null,
              tieredPrices: article.tieredPrices || null,
              currency: article.currency || 'EUR',
              imageUrl: article.imageUrl || null,
              thumbnailUrl: article.thumbnailUrl || null,
              ean: article.ean || null,
              manufacturer: article.manufacturer || null,
              category: article.category || null,
              sourceUrl: article.sourceUrl || 'imported',
              crawlJobId: article.crawlJobId || null,
              ocrConfidence: article.ocrConfidence || null,
              verified: article.verified || false,
              published: article.published !== false
            }
          });

          imported++;

          // Show progress
          if (imported % 10 === 0) {
            process.stdout.write(`  Imported: ${imported} articles\r`);
          }
        } catch (error: any) {
          console.error(`  ERROR importing ${article.articleNumber}: ${error.message}`);
          errors++;
        }
      }
    }

    console.log('\n\n========================================');
    console.log('IMPORT COMPLETE!');
    console.log('========================================');
    console.log(`Total articles: ${articles.length}`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Skipped (already exist): ${skipped}`);
    console.log(`Errors: ${errors}`);

    // Verify categories
    const fromExcel = await prisma.product.count({
      where: { category: 'FROM_EXCEL' }
    });
    const shopOnly = await prisma.product.count({
      where: { category: 'SHOP_ONLY' }
    });
    const needsTier = await prisma.product.count({
      where: { manufacturer: 'NEEDS_TIER_QUANTITIES' }
    });

    console.log('\nCategory verification:');
    console.log(`  FROM_EXCEL: ${fromExcel}`);
    console.log(`  SHOP_ONLY: ${shopOnly}`);
    console.log(`  NEEDS_TIER_QUANTITIES: ${needsTier}`);

    if (imported > 0) {
      console.log('\n✓ Articles imported successfully!');
      console.log('The system is ready to use.');
    }

  } catch (error) {
    console.error('Fatal error during import:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run import
importArticlesFresh();