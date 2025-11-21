/**
 * Cleanup Corrupted Articles Script
 *
 * Finds and re-crawls articles with:
 * - OCR confidence < 100% (indicates OCR data instead of HTML)
 * - Encoding corruption (é, ™, ©, cookie banner text)
 * - Missing or invalid data
 *
 * Usage:
 *   npm run cleanup-corrupted-articles
 */

import { prisma } from '../lib/supabase.js';
import dataValidationService from '../services/data-validation-service.js';
import puppeteer from 'puppeteer';
import htmlExtractionService from '../services/html-extraction-service.js';
import { preciseScreenshotService } from '../services/precise-screenshot-service.js';
import * as path from 'path';

interface CorruptedArticle {
  id: string;
  articleNumber: string;
  productName: string;
  sourceUrl: string | null;
  ocrConfidence: number | null;
  corruptionScore: number;
  issues: string[];
}

async function findCorruptedArticles(): Promise<CorruptedArticle[]> {
  console.log('\n🔍 Scanning database for corrupted articles...\n');

  // Find articles with OCR confidence < 100% (not from HTML extraction)
  const articles = await prisma.product.findMany({
    where: {
      OR: [
        { ocrConfidence: { lt: 100 } },
        { ocrConfidence: null }
      ]
    },
    select: {
      id: true,
      articleNumber: true,
      productName: true,
      description: true,
      sourceUrl: true,
      ocrConfidence: true,
      tieredPricesText: true,
      price: true,
      tieredPrices: true,
      priceType: true
    }
  });

  console.log(`📊 Found ${articles.length} articles with ocrConfidence < 100%`);

  // Check each article for corruption
  const corrupted: CorruptedArticle[] = [];

  for (const article of articles) {
    const corruptionCheck = dataValidationService.detectCorruptedData(article as any);

    if (corruptionCheck.isCorrupted || !article.sourceUrl) {
      corrupted.push({
        id: article.id,
        articleNumber: article.articleNumber,
        productName: article.productName || 'Unknown',
        sourceUrl: article.sourceUrl,
        ocrConfidence: article.ocrConfidence || 0,
        corruptionScore: corruptionCheck.corruptionScore,
        issues: corruptionCheck.issues
      });
    }
  }

  console.log(`\n❌ Found ${corrupted.length} corrupted articles:\n`);

  // Display corrupted articles
  for (const article of corrupted) {
    console.log(`📦 Article ${article.articleNumber}: "${article.productName}"`);
    console.log(`   OCR Confidence: ${article.ocrConfidence}%`);
    console.log(`   Corruption Score: ${(article.corruptionScore * 100).toFixed(1)}%`);
    console.log(`   Issues:`);
    for (const issue of article.issues) {
      console.log(`      - ${issue}`);
    }
    console.log(`   Source URL: ${article.sourceUrl || 'MISSING'}`);
    console.log('');
  }

  return corrupted;
}

async function recrawlArticle(article: CorruptedArticle, browser: any): Promise<boolean> {
  if (!article.sourceUrl) {
    console.log(`   ⚠️ Skipping ${article.articleNumber}: No source URL`);
    return false;
  }

  try {
    console.log(`   🔄 Re-crawling ${article.articleNumber}...`);

    const page = await browser.newPage();

    // Navigate to product page
    await page.goto(article.sourceUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for page to stabilize
    await new Promise(r => setTimeout(r, 2000));

    // Extract clean HTML data
    const htmlData = await htmlExtractionService.extractProductData(page);

    console.log(`   ✅ Extracted clean data:`);
    console.log(`      Product: ${htmlData.productName}`);
    console.log(`      Article: ${htmlData.articleNumber}`);
    console.log(`      Price: ${htmlData.price || 'N/A'}`);
    console.log(`      Tiered: ${htmlData.tieredPrices?.length || 0} tiers`);

    // Validate extracted data
    const validation = dataValidationService.validateProductData(htmlData as any);

    if (!validation.isValid) {
      console.log(`   ⚠️ Validation warnings:`);
      for (const warning of validation.warnings) {
        console.log(`      - ${warning}`);
      }
    }

    // Update database with clean data
    await prisma.product.update({
      where: { id: article.id },
      data: {
        productName: htmlData.productName || article.productName,
        description: htmlData.description || '',
        price: htmlData.price || 0,
        priceType: htmlData.priceType || 'normal',
        tieredPrices: (htmlData.tieredPrices || []) as any, // Cast to any for Prisma Json type
        tieredPricesText: htmlData.tieredPricesText || null,
        ocrConfidence: 100, // Mark as HTML-extracted (100% confidence)
        updatedAt: new Date()
      }
    });

    console.log(`   ✅ Updated article ${article.articleNumber} in database`);

    await page.close();
    return true;

  } catch (error: any) {
    console.log(`   ❌ Failed to re-crawl ${article.articleNumber}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  🧹 Cleanup Corrupted Articles                ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Find corrupted articles
    const corrupted = await findCorruptedArticles();

    if (corrupted.length === 0) {
      console.log('✅ No corrupted articles found! Database is clean.\n');
      return;
    }

    // Ask for confirmation (in production, you'd want user input here)
    console.log(`⚠️ Found ${corrupted.length} corrupted articles.\n`);
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    await new Promise(r => setTimeout(r, 5000));

    // Step 2: Launch browser for re-crawling
    console.log('🌐 Launching browser...\n');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Step 3: Re-crawl each article
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < corrupted.length; i++) {
      const article = corrupted[i];
      console.log(`\n[${i + 1}/${corrupted.length}] Processing ${article.articleNumber}...`);

      const success = await recrawlArticle(article, browser);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Wait between requests to be polite
      if (i < corrupted.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    await browser.close();

    // Step 4: Summary
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  📊 Cleanup Summary                            ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    console.log(`✅ Successfully cleaned: ${successCount} articles`);
    console.log(`❌ Failed: ${failCount} articles`);
    console.log(`📊 Total processed: ${corrupted.length} articles\n`);

  } catch (error: any) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { findCorruptedArticles, recrawlArticle };
