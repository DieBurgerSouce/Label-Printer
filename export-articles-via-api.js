/**
 * Export all articles via API for deployment package
 * Fetches all articles from the local API endpoint
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api/articles';

async function exportAllArticles() {
  console.log('========================================');
  console.log('EXPORTING ALL ARTICLES FROM DATABASE');
  console.log('========================================\n');

  try {
    // Fetch ALL articles
    console.log('Fetching all articles from API...');

    let allArticles = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${API_URL}?page=${page}&limit=100`);
      const result = await response.json();

      if (result.data && result.data.length > 0) {
        allArticles = allArticles.concat(result.data);
        console.log(`Page ${page}: Fetched ${result.data.length} articles (Total: ${allArticles.length})`);
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`\nTotal articles fetched: ${allArticles.length}`);

    // Count by category
    const categories = {
      FROM_EXCEL: 0,
      SHOP_ONLY: 0,
      NEEDS_TIER_QUANTITIES: 0,
      OTHER: 0
    };

    allArticles.forEach(article => {
      if (article.category === 'FROM_EXCEL') {
        categories.FROM_EXCEL++;
      } else if (article.category === 'SHOP_ONLY') {
        categories.SHOP_ONLY++;
      } else {
        categories.OTHER++;
      }

      // Also check manufacturer field for NEEDS_TIER_QUANTITIES
      if (article.manufacturer === 'NEEDS_TIER_QUANTITIES') {
        categories.NEEDS_TIER_QUANTITIES++;
      }
    });

    console.log('\nArticle Categories:');
    console.log(`  FROM_EXCEL: ${categories.FROM_EXCEL}`);
    console.log(`  SHOP_ONLY: ${categories.SHOP_ONLY}`);
    console.log(`  NEEDS_TIER_QUANTITIES: ${categories.NEEDS_TIER_QUANTITIES}`);
    console.log(`  OTHER/Uncategorized: ${categories.OTHER}`);

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

    // Create data directory
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save main export file
    const exportPath = path.join(dataDir, 'articles-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`\nMain export saved to: data/articles-export.json`);

    // Save timestamped backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupPath = path.join(dataDir, `articles-export-${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`Backup saved to: data/articles-export-${timestamp}.json`);

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
        productName: a.productName,
        price: a.price,
        category: a.category
      }))
    };

    fs.writeFileSync(
      path.join(dataDir, 'export-summary.json'),
      JSON.stringify(summary, null, 2),
      'utf-8'
    );
    console.log(`Summary saved to: data/export-summary.json`);

    console.log('\n========================================');
    console.log('EXPORT COMPLETE!');
    console.log(`Successfully exported ${allArticles.length} articles`);
    console.log('========================================');

  } catch (error) {
    console.error('Error exporting articles:', error);
    process.exit(1);
  }
}

// Run export
exportAllArticles();