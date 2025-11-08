/**
 * Reprocess existing screenshot job with the FIXED code
 * This will take the screenshots from job 03662514-c9b0-444e-8d5d-2f34d71b224e
 * and save all products to the database using the new extractedData structure
 */

const fs = require('fs').promises;
const path = require('path');
const { RobustOCRService } = require('./dist/services/robust-ocr-service.js');
const { ProductService } = require('./dist/services/product-service.js');
const { v4: uuidv4 } = require('uuid');

const JOB_ID = '03662514-c9b0-444e-8d5d-2f34d71b224e';
const BASE_DIR = `data/screenshots/${JOB_ID}`;

async function reprocessJob() {
  console.log('\n🔄 Reprocessing existing job with FIXED code');
  console.log('='.repeat(70));
  console.log(`Job ID: ${JOB_ID}`);
  console.log(`Base Dir: ${BASE_DIR}`);
  console.log('='.repeat(70));

  try {
    // Get all article folders
    const folders = await fs.readdir(BASE_DIR);

    // Filter to only article number folders (digits with optional suffix)
    const articleFolders = folders.filter(f => /^\d+(-[A-Z]+)?$/.test(f));

    console.log(`\n📂 Found ${articleFolders.length} article folders`);
    console.log(`   First few: ${articleFolders.slice(0, 5).join(', ')}...`);

    // Initialize RobustOCRService
    console.log('\n🔧 Initializing RobustOCRService...');
    const robustOCRService = new RobustOCRService();
    await robustOCRService.initialize();

    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: []
    };

    console.log('\n📊 Processing articles...\n');

    // Process each article
    for (const folder of articleFolders) {
      try {
        // Note: folder name IS the article identifier (may have suffix like "1138" or "5020-GE")
        // Extract pure article number for database (remove suffix like "-GE", "-M", etc.)
        const articleNumber = folder.split('-')[0];

        console.log(`  [${results.processed + 1}/${articleFolders.length}] Processing ${folder} (article: ${articleNumber})...`);

        // processArticleElements expects BASE_DIR and will look for BASE_DIR/{folder}/html-data.json
        // We need to pass the folder name (not articleNumber) to find the correct path
        const robustResult = await robustOCRService.processArticleElements(BASE_DIR, folder);

        if (!robustResult.success) {
          console.log(`    ⚠️  Extraction failed for ${articleNumber}`);
          results.skipped++;
          results.processed++;
          continue;
        }

        // Convert to format expected by product-service (FIXED VERSION)
        const ocrResult = {
          id: uuidv4(),
          screenshotId: uuidv4(),
          success: robustResult.success,
          productUrl: `https://shop.firmenich.de/product/${articleNumber}`,
          confidence: robustResult.confidence?.overall || 0,
          extractedData: {
            articleNumber: articleNumber,  // Use pure article number (without suffix)
            productName: robustResult.data.productName || '',
            description: robustResult.data.description || '',
            price: robustResult.data.price || 0,
            tieredPrices: robustResult.data.tieredPrices || [],
            tieredPricesText: robustResult.data.tieredPricesText || '',
            ean: robustResult.data.ean || null,
            sourceUrl: `https://shop.firmenich.de/product/${articleNumber}`
          }
        };

        // Save using ProductService
        const productResults = await ProductService.processOcrResultsFromAutomation(
          [ocrResult],
          JOB_ID
        );

        results.created += productResults.created;
        results.updated += productResults.updated;
        results.skipped += productResults.skipped;
        results.errors += productResults.errors;

        if (productResults.created > 0) {
          console.log(`    ✅ Created: ${articleNumber} - ${robustResult.data.productName}`);
        } else if (productResults.updated > 0) {
          console.log(`    🔄 Updated: ${articleNumber} - ${robustResult.data.productName}`);
        } else if (productResults.skipped > 0) {
          console.log(`    ⏭️  Skipped: ${articleNumber}`);
        }

        results.processed++;

      } catch (error) {
        console.error(`    ❌ Error processing ${folder}:`, error.message);
        results.errors++;
        results.errorDetails.push({ folder, error: error.message });
        results.processed++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 REPROCESSING COMPLETE');
    console.log('='.repeat(70));
    console.log(`Total Processed: ${results.processed}`);
    console.log(`✅ Created:      ${results.created}`);
    console.log(`🔄 Updated:      ${results.updated}`);
    console.log(`⏭️  Skipped:      ${results.skipped}`);
    console.log(`❌ Errors:       ${results.errors}`);

    if (results.errorDetails.length > 0) {
      console.log('\nError Details:');
      results.errorDetails.forEach(e => {
        console.log(`  - ${e.folder}: ${e.error}`);
      });
    }

    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Fatal error during reprocessing:', error);
    throw error;
  }
}

reprocessJob()
  .then(() => {
    console.log('\n✅ Reprocessing job completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Reprocessing job failed:', error);
    process.exit(1);
  });
