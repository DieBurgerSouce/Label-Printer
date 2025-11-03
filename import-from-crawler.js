const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';
const jobId = process.argv[2] || 'f9e895c0-2e5c-43e5-a523-c75775425e5c';

async function importArticles() {
  console.log('📦 IMPORTIERE ARTIKEL AUS CRAWLER-JOB');
  console.log('='.repeat(80));
  console.log(`Job ID: ${jobId}\n`);

  try {
    // Get crawler job results
    const jobResponse = await axios.get(`${API_BASE}/crawler/jobs/${jobId}`);
    const job = jobResponse.data.data;

    if (!job.results?.screenshots || job.results.screenshots.length === 0) {
      console.log('❌ Keine Screenshots im Job gefunden!');
      return;
    }

    console.log(`✅ Gefunden: ${job.results.screenshots.length} Produkt(e)\n`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const screenshot of job.results.screenshots) {
      // Extract data from screenshot metadata
      const productImage = screenshot.metadata?.targetedScreenshots?.find(s => s.type === 'product-image');
      const titleScreenshot = screenshot.metadata?.targetedScreenshots?.find(s => s.type === 'title');
      const descScreenshot = screenshot.metadata?.targetedScreenshots?.find(s => s.type === 'description');

      // Extract article number from path
      const articleMatch = screenshot.imagePath?.match(/\/(\d+)\//);
      const articleNumber = articleMatch ? articleMatch[1] : null;

      if (!articleNumber) {
        console.log('⚠️  Kein Artikelnummer gefunden, überspringe...');
        skipped++;
        continue;
      }

      // Get title from page title or URL
      const pageTitleMatch = screenshot.metadata?.pageTitle?.match(/^(.+?)\s*\|/);
      const productName = pageTitleMatch ? pageTitleMatch[1].trim() : `Artikel ${articleNumber}`;

      const articleData = {
        articleNumber,
        productName,
        description: screenshot.metadata?.pageTitle || '',
        price: 0.01, // Placeholder price
        tieredPricesText: screenshot.metadata?.layoutType === 'tiered_price' ? 'Staffelpreise verfügbar' : null,
        currency: 'EUR',
        imageUrl: screenshot.productUrl,
        thumbnailUrl: screenshot.productUrl,
        sourceUrl: screenshot.productUrl,
        crawlJobId: jobId,
        verified: false,
        published: true
      };

      try {
        const response = await axios.post(`${API_BASE}/articles`, articleData);
        console.log(`✅ Importiert: Artikel ${articleNumber} - ${productName.substring(0, 50)}...`);
        imported++;
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`⚠️  Übersprungen: Artikel ${articleNumber} existiert bereits`);
          skipped++;
        } else {
          console.log(`❌ Fehler: Artikel ${articleNumber} - ${error.response?.data?.error || error.message}`);
          errors++;
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 IMPORT-ZUSAMMENFASSUNG');
    console.log('='.repeat(80));
    console.log(`✅ Importiert: ${imported}`);
    console.log(`⚠️  Übersprungen: ${skipped}`);
    console.log(`❌ Fehler: ${errors}`);
    console.log('\n✅ Frontend: http://localhost:3001');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Fehler:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

importArticles();
