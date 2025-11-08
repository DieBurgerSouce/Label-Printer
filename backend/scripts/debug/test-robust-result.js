const { RobustOCRService } = require('./dist/services/robust-ocr-service.js');

async function test() {
  const robustOCRService = new RobustOCRService();
  await robustOCRService.initialize();

  // Use an existing screenshot from the last crawl
  const screenshotDir = 'data/screenshots';
  const fs = require('fs').promises;

  // Find the latest job folder
  const jobs = await fs.readdir(screenshotDir);
  const latestJob = jobs.filter(f => f.match(/^[a-f0-9-]{36}$/)).sort().reverse()[0];

  if (!latestJob) {
    console.log('No job folders found');
    return;
  }

  console.log(`Using job: ${latestJob}`);

  // Find an article folder
  const articles = await fs.readdir(`${screenshotDir}/${latestJob}`);
  const firstArticle = articles.find(f => /^\d+/.test(f));

  if (!firstArticle) {
    console.log('No article folders found');
    return;
  }

  console.log(`Testing article: ${firstArticle}`);
  const articleNumber = firstArticle.split('-')[0];

  const result = await robustOCRService.processArticleElements(`${screenshotDir}/${latestJob}`, articleNumber);

  console.log('\n📊 robustResult:');
  console.log('  success:', result.success);
  console.log('  articleNumber (top-level):', result.articleNumber);
  console.log('  data.articleNumber:', result.data?.articleNumber);
  console.log('  data:', JSON.stringify(result.data, null, 2));

  await robustOCRService.cleanup();
}

test().catch(console.error);
