/**
 * Start test job with only 10 articles
 */
const fetch = require('node-fetch');

async function startTestJob() {
  console.log('\n🧪 Starting test job with 10 articles...\n');

  try {
    const response = await fetch('http://localhost:3001/api/automation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopUrl: 'https://shop.firmenich.de',
        templateId: '288454ba-6155-47c2-bc69-ee186f6103b7',
        startPage: 1,
        maxPages: 1,
        targetCount: 10, // Only 10 articles
        batchSize: 10,
        enableScreenshots: true,
        enableOCR: true,
        enableLabels: false
      })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success && data.data) {
      console.log(`✅ Job started: ${data.data.id}\n`);
      console.log(`📊 Monitor at: http://localhost:3000/automation\n`);
      console.log(`🔍 Job ID: ${data.data.id}\n`);
    } else {
      console.log(`❌ Failed to start job: ${data.error || 'Unknown error'}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

startTestJob();
