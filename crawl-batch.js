/**
 * Batch Crawling Script for Stable Large-Scale Processing
 * This script processes articles in manageable batches to prevent memory issues
 * and ensure stable operation for 100-2000 articles
 */

const axios = require('axios');
const fs = require('fs').promises;

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_DELAY_BETWEEN_BATCHES = 60000; // 60 seconds
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 5000; // 5 seconds

class BatchCrawler {
  constructor(config = {}) {
    this.batchSize = config.batchSize || DEFAULT_BATCH_SIZE;
    this.delayBetweenBatches = config.delayBetweenBatches || DEFAULT_DELAY_BETWEEN_BATCHES;
    this.retryAttempts = config.retryAttempts || DEFAULT_RETRY_ATTEMPTS;
    this.retryDelay = config.retryDelay || DEFAULT_RETRY_DELAY;
    this.progressFile = config.progressFile || 'crawl-progress.json';

    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      retried: 0,
      batches: 0,
      startTime: Date.now()
    };

    this.failedUrls = [];
    this.progress = null;
  }

  /**
   * Load progress from file to resume interrupted crawls
   */
  async loadProgress() {
    try {
      const data = await fs.readFile(this.progressFile, 'utf8');
      this.progress = JSON.parse(data);
      console.log(`📂 Resuming from previous session:`, this.progress);
      return true;
    } catch (error) {
      console.log('🆕 Starting fresh crawl session');
      return false;
    }
  }

  /**
   * Save progress to file
   */
  async saveProgress(currentBatch, totalBatches, processedUrls) {
    const progress = {
      currentBatch,
      totalBatches,
      processedUrls,
      stats: this.stats,
      failedUrls: this.failedUrls,
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(this.progressFile, JSON.stringify(progress, null, 2));
  }

  /**
   * Retry mechanism for failed operations
   */
  async withRetry(fn, operation = 'Operation') {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        console.log(`⚠️ ${operation} failed (attempt ${attempt}/${this.retryAttempts}): ${error.message}`);

        if (attempt === this.retryAttempts) {
          throw error;
        }

        this.stats.retried++;
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check system health before processing batch
   */
  async checkSystemHealth() {
    try {
      const response = await axios.get(`${API_URL}/health`);
      const health = response.data;

      // Check memory usage
      if (health.memory && health.memory.percentage > 85) {
        console.log('⚠️ High memory usage detected. Waiting for cleanup...');
        await this.sleep(30000); // Wait 30 seconds

        // Trigger garbage collection if available
        if (global.gc) {
          console.log('🧹 Running garbage collection...');
          global.gc();
        }
      }

      return true;
    } catch (error) {
      console.error('❌ System health check failed:', error.message);
      return false;
    }
  }

  /**
   * Process a single URL with retry logic
   */
  async processUrl(url) {
    return await this.withRetry(async () => {
      console.log(`   🔄 Processing: ${url}`);

      const response = await axios.post(
        `${API_URL}/crawler/start`,
        {
          urls: [url],
          config: {
            captureSelectors: true,
            headless: true,
            scrollDelay: 1500,
            pageLoadDelay: 2000,
            enableVariantDetection: true, // New feature
            maxVariantsPerProduct: 10    // Limit variants to prevent loops
          }
        },
        { timeout: 120000 } // 2 minute timeout
      );

      const jobId = response.data.data?.jobId || response.data.id;
      if (!jobId) {
        throw new Error('No job ID received from crawler');
      }

      // Wait for job completion
      let job;
      let pollAttempts = 0;
      const maxPollAttempts = 60; // 5 minutes max

      while (pollAttempts < maxPollAttempts) {
        await this.sleep(5000); // Poll every 5 seconds

        const statusResponse = await axios.get(`${API_URL}/crawler/jobs/${jobId}`);
        job = statusResponse.data.data || statusResponse.data;

        if (job.status === 'completed') {
          console.log(`   ✅ Success: Found ${job.results?.productsFound || 0} products`);
          return { success: true, productsFound: job.results?.productsFound || 0 };
        } else if (job.status === 'failed') {
          throw new Error(`Job failed: ${job.error || 'Unknown error'}`);
        }

        pollAttempts++;
      }

      throw new Error('Job timeout - took longer than 5 minutes');
    }, `Crawl ${url}`);
  }

  /**
   * Process a batch of URLs
   */
  async processBatch(urls, batchNumber, totalBatches) {
    console.log(`\n📦 BATCH ${batchNumber}/${totalBatches}`);
    console.log(`   Processing ${urls.length} URLs...`);

    const batchStats = {
      successful: 0,
      failed: 0,
      productsFound: 0
    };

    // Process URLs sequentially to avoid overload
    for (const url of urls) {
      try {
        const result = await this.processUrl(url);
        batchStats.successful++;
        batchStats.productsFound += result.productsFound;
        this.stats.successful++;
      } catch (error) {
        console.error(`   ❌ Failed: ${url} - ${error.message}`);
        batchStats.failed++;
        this.stats.failed++;
        this.failedUrls.push({ url, error: error.message });
      }

      this.stats.totalProcessed++;

      // Small delay between URLs to prevent overload
      await this.sleep(2000);
    }

    console.log(`\n📊 Batch ${batchNumber} Summary:`);
    console.log(`   ✅ Successful: ${batchStats.successful}/${urls.length}`);
    console.log(`   ❌ Failed: ${batchStats.failed}/${urls.length}`);
    console.log(`   📦 Products found: ${batchStats.productsFound}`);

    return batchStats;
  }

  /**
   * Main crawl function
   */
  async crawlShop(shopUrl, options = {}) {
    console.log('\n🚀 BATCH CRAWLER v2.0 - STABLE EDITION');
    console.log('=====================================');
    console.log(`📍 Shop URL: ${shopUrl}`);
    console.log(`⚙️ Configuration:`);
    console.log(`   - Batch Size: ${this.batchSize}`);
    console.log(`   - Delay Between Batches: ${this.delayBetweenBatches / 1000}s`);
    console.log(`   - Retry Attempts: ${this.retryAttempts}`);

    try {
      // Load previous progress if exists
      const hasProgress = await this.loadProgress();

      let urlsToProcess = [];
      let startBatch = 1;

      if (hasProgress && this.progress.processedUrls) {
        // Resume from where we left off
        startBatch = this.progress.currentBatch + 1;
        this.stats = this.progress.stats;
        this.failedUrls = this.progress.failedUrls || [];

        // Get remaining URLs (you would need to load these from your source)
        // For now, we'll skip this part
        console.log('⚠️ Resume feature requires URL list - starting fresh instead');
        hasProgress = false;
      }

      if (!hasProgress) {
        // Fetch all product URLs from the shop
        console.log('\n🔍 Fetching product URLs from shop...');

        const response = await this.withRetry(async () => {
          return await axios.post(`${API_URL}/crawler/discover`, {
            shopUrl,
            config: {
              maxProducts: options.maxProducts || 2000,
              followPagination: true
            }
          });
        }, 'URL Discovery');

        urlsToProcess = response.data.urls || [];
        console.log(`✅ Found ${urlsToProcess.length} product URLs`);
      }

      if (urlsToProcess.length === 0) {
        console.log('⚠️ No URLs to process');
        return;
      }

      // Split URLs into batches
      const batches = [];
      for (let i = 0; i < urlsToProcess.length; i += this.batchSize) {
        batches.push(urlsToProcess.slice(i, i + this.batchSize));
      }

      console.log(`\n📊 Processing ${urlsToProcess.length} URLs in ${batches.length} batches`);

      // Process each batch
      for (let i = startBatch - 1; i < batches.length; i++) {
        const batchNumber = i + 1;

        // Check system health before processing
        const isHealthy = await this.checkSystemHealth();
        if (!isHealthy) {
          console.log('⚠️ System unhealthy, waiting before continuing...');
          await this.sleep(60000); // Wait 1 minute
        }

        // Process the batch
        await this.processBatch(batches[i], batchNumber, batches.length);
        this.stats.batches++;

        // Save progress
        const processedUrls = urlsToProcess.slice(0, (i + 1) * this.batchSize);
        await this.saveProgress(batchNumber, batches.length, processedUrls);

        // Delay between batches (except for the last one)
        if (i < batches.length - 1) {
          console.log(`\n⏸️ Cooling down for ${this.delayBetweenBatches / 1000} seconds...`);
          await this.sleep(this.delayBetweenBatches);

          // Optional: Restart Docker container to clear memory (requires docker access)
          if (options.restartBetweenBatches) {
            console.log('🔄 Restarting backend container...');
            try {
              require('child_process').execSync('docker-compose restart backend', {
                stdio: 'inherit'
              });
              await this.sleep(30000); // Wait for container to be ready
            } catch (error) {
              console.error('⚠️ Could not restart container:', error.message);
            }
          }
        }
      }

      // Final summary
      const duration = (Date.now() - this.stats.startTime) / 1000;
      console.log('\n' + '='.repeat(50));
      console.log('✅ CRAWL COMPLETED!');
      console.log('='.repeat(50));
      console.log(`📊 Final Statistics:`);
      console.log(`   - Total Processed: ${this.stats.totalProcessed}`);
      console.log(`   - Successful: ${this.stats.successful}`);
      console.log(`   - Failed: ${this.stats.failed}`);
      console.log(`   - Retried: ${this.stats.retried}`);
      console.log(`   - Batches: ${this.stats.batches}`);
      console.log(`   - Duration: ${Math.round(duration / 60)} minutes`);
      console.log(`   - Average: ${(duration / this.stats.totalProcessed).toFixed(2)}s per URL`);

      if (this.failedUrls.length > 0) {
        console.log(`\n⚠️ Failed URLs (${this.failedUrls.length}):`);
        await fs.writeFile('failed-urls.json', JSON.stringify(this.failedUrls, null, 2));
        console.log('   Saved to failed-urls.json for retry');
      }

      // Clean up progress file on success
      try {
        await fs.unlink(this.progressFile);
      } catch (error) {
        // Ignore if file doesn't exist
      }

    } catch (error) {
      console.error('\n❌ Fatal error:', error);
      throw error;
    }
  }

  /**
   * Retry failed URLs from previous run
   */
  async retryFailed() {
    try {
      const data = await fs.readFile('failed-urls.json', 'utf8');
      const failed = JSON.parse(data);

      console.log(`\n🔄 Retrying ${failed.length} failed URLs...`);

      const urls = failed.map(f => f.url);
      const batches = [];

      for (let i = 0; i < urls.length; i += this.batchSize) {
        batches.push(urls.slice(i, i + this.batchSize));
      }

      for (let i = 0; i < batches.length; i++) {
        await this.processBatch(batches[i], i + 1, batches.length);

        if (i < batches.length - 1) {
          await this.sleep(this.delayBetweenBatches);
        }
      }

    } catch (error) {
      console.error('❌ Error retrying failed URLs:', error);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const options = {
    shopUrl: null,
    batchSize: DEFAULT_BATCH_SIZE,
    delayBetweenBatches: DEFAULT_DELAY_BETWEEN_BATCHES,
    maxProducts: 2000,
    retryFailed: false,
    restartBetweenBatches: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--retry-failed') {
      options.retryFailed = true;
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--delay=')) {
      options.delayBetweenBatches = parseInt(arg.split('=')[1]) * 1000;
    } else if (arg.startsWith('--max-products=')) {
      options.maxProducts = parseInt(arg.split('=')[1]);
    } else if (arg === '--restart-containers') {
      options.restartBetweenBatches = true;
    } else if (!arg.startsWith('--')) {
      options.shopUrl = arg;
    }
  }

  const crawler = new BatchCrawler({
    batchSize: options.batchSize,
    delayBetweenBatches: options.delayBetweenBatches
  });

  try {
    if (options.retryFailed) {
      await crawler.retryFailed();
    } else if (options.shopUrl) {
      await crawler.crawlShop(options.shopUrl, options);
    } else {
      console.log('📖 Usage:');
      console.log('  node crawl-batch.js [shop-url] [options]');
      console.log('');
      console.log('Options:');
      console.log('  --batch-size=50        Number of URLs per batch');
      console.log('  --delay=60             Delay between batches in seconds');
      console.log('  --max-products=2000    Maximum products to crawl');
      console.log('  --retry-failed         Retry URLs from failed-urls.json');
      console.log('  --restart-containers   Restart Docker between batches');
      console.log('');
      console.log('Examples:');
      console.log('  node crawl-batch.js https://shop.firmenich.de');
      console.log('  node crawl-batch.js https://shop.firmenich.de --batch-size=25 --delay=120');
      console.log('  node crawl-batch.js --retry-failed');
    }
  } catch (error) {
    console.error('❌ Crawl failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = BatchCrawler;