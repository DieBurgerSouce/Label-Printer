/**
 * Export all articles from database for deployment package
 * This creates a complete backup of all articles with their full data
 */

import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

async function exportAllArticles() {
  console.log('========================================');
  console.log('EXPORTING ALL ARTICLES FROM DATABASE');
  console.log('========================================\n');

  try {
    // Fetch ALL articles with all fields
    console.log('Fetching all articles from database...');
    const allArticles = await prisma.product.findMany({
      orderBy: { articleNumber: 'asc' },
      select: {
        id: true,
        articleNumber: true,
        productName: true,
        description: true,
        price: true,
        tieredPricesText: true,
        tieredPrices: true,
        currency: true,
        imageUrl: true,
        thumbnailUrl: true,
        ean: true,
        manufacturer: true,
        category: true,
        sourceUrl: true,
        crawlJobId: true,
        ocrConfidence: true,
        verified: true,
        published: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log(`Found ${allArticles.length} articles`);

    // Count by category
    const categories = {
      FROM_EXCEL: 0,
      SHOP_ONLY: 0,
      NEEDS_TIER_QUANTITIES: 0,
      OTHER: 0
    };

    allArticles.forEach(article => {
      if (article.category === 'FROM_EXCEL') categories.FROM_EXCEL++;
      else if (article.category === 'SHOP_ONLY') categories.SHOP_ONLY++;
      else if (article.manufacturer === 'NEEDS_TIER_QUANTITIES') categories.NEEDS_TIER_QUANTITIES++;
      else categories.OTHER++;
    });

    console.log('\nArticle Categories:');
    console.log(`  FROM_EXCEL: ${categories.FROM_EXCEL}`);
    console.log(`  SHOP_ONLY: ${categories.SHOP_ONLY}`);
    console.log(`  NEEDS_TIER_QUANTITIES: ${categories.NEEDS_TIER_QUANTITIES}`);
    console.log(`  OTHER: ${categories.OTHER}`);

    // Create export object
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalArticles: allArticles.length,
        categories: categories,
        version: '1.0.0',
        exportedFrom: 'Screenshot_Algo System'
      },
      articles: allArticles
    };

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const exportPath = path.join(__dirname, '../../../../data');

    // Create data directory if it doesn't exist
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }

    const filename = `articles-export-${timestamp}.json`;
    const filepath = path.join(exportPath, filename);

    console.log(`\nSaving to: ${filename}`);
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2), 'utf-8');

    // Also create a copy without timestamp for easy access
    const mainExportPath = path.join(exportPath, 'articles-export.json');
    fs.writeFileSync(mainExportPath, JSON.stringify(exportData, null, 2), 'utf-8');

    console.log('Export completed successfully!');
    console.log(`\nFiles created:`);
    console.log(`  - data/${filename}`);
    console.log(`  - data/articles-export.json`);

    // Create summary file
    const summary = {
      exportDate: new Date().toISOString(),
      statistics: {
        total: allArticles.length,
        fromExcel: categories.FROM_EXCEL,
        shopOnly: categories.SHOP_ONLY,
        needsTierQuantities: categories.NEEDS_TIER_QUANTITIES,
        other: categories.OTHER
      },
      sampleArticles: allArticles.slice(0, 5).map(a => ({
        articleNumber: a.articleNumber,
        productName: a.productName
      }))
    };

    fs.writeFileSync(
      path.join(exportPath, 'export-summary.json'),
      JSON.stringify(summary, null, 2),
      'utf-8'
    );

    console.log('  - data/export-summary.json');
    console.log('\n========================================');
    console.log('EXPORT COMPLETE!');
    console.log('========================================');

  } catch (error) {
    console.error('Error exporting articles:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run export
exportAllArticles();