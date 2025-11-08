/**
 * Import articles from export file for fresh installations
 * This script imports all articles from data/articles-export.json
 * JavaScript version for easy execution without TypeScript
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api/articles';

async function importArticlesFresh() {
  console.log('========================================');
  console.log('FRESH INSTALL: IMPORTING ARTICLES');
  console.log('========================================\n');

  try {
    // Load export file
    const exportPath = path.join(__dirname, '../data/articles-export.json');

    if (!fs.existsSync(exportPath)) {
      console.error('ERROR: Export file not found at data/articles-export.json');
      process.exit(1);
    }

    console.log('Loading articles from export file...');
    const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));

    const articles = exportData.articles;
    const metadata = exportData.metadata;

    console.log(`Found ${articles.length} articles to import`);
    console.log(`Export date: ${metadata.exportDate}`);
    console.log(`Categories: FROM_EXCEL=${metadata.categories.FROM_EXCEL}, SHOP_ONLY=${metadata.categories.SHOP_ONLY}`);
    console.log(`Needs tier quantities: ${metadata.categories.NEEDS_TIER_QUANTITIES}\n`);

    // Import in batches
    const BATCH_SIZE = 20;
    let imported = 0;
    let skipped = 0;
    let errors = [];

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(articles.length / BATCH_SIZE);

      console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} articles)...`);

      // Try to import batch
      for (const article of batch) {
        try {
          // Remove id field if present (will be generated)
          const { id, ...articleData } = article;

          const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(articleData)
          });

          if (response.ok) {
            imported++;
            process.stdout.write(`  ✓ Imported: ${imported} articles\r`);
          } else if (response.status === 409) {
            // Article already exists
            skipped++;
          } else {
            const error = await response.text();
            errors.push({ article: article.articleNumber, error });
          }
        } catch (error) {
          errors.push({ article: article.articleNumber, error: error.message });
        }
      }

      // Add small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n\n========================================');
    console.log('IMPORT COMPLETE!');
    console.log('========================================');
    console.log(`Total articles: ${articles.length}`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Skipped (already exist): ${skipped}`);
    console.log(`Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\nFirst 5 errors:');
      errors.slice(0, 5).forEach(err => {
        console.log(`  - ${err.article}: ${err.error}`);
      });
    }

    // Verify import via API
    const verifyResponse = await fetch(`${API_URL}?limit=1`);
    const verifyData = await verifyResponse.json();
    console.log(`\nVerification: ${verifyData.total || 0} articles in system`);

    if (imported > 0) {
      console.log('\n✓ Articles imported successfully!');
      console.log('The system is ready to use.');
    } else if (skipped === articles.length) {
      console.log('\n✓ All articles already exist in the system.');
    }

  } catch (error) {
    console.error('Fatal error during import:', error);
    process.exit(1);
  }
}

// Run import
importArticlesFresh();