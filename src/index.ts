import { initializeBrowserManager, getBrowserManager } from './services/browser-manager';
import { getURLExtractor } from './services/url-extractor';
import { getQueueService } from './services/queue-service';
import { createLogger } from './utils/logger';
import config from './config';

const logger = createLogger('Main');

/**
 * Main application entry point
 * Extracts URLs and queues screenshot jobs
 */
async function main() {
  try {
    logger.info('Starting Screenshot Scraper', {
      shopUrl: config.shop.url,
      concurrency: config.queue.concurrency,
    });

    // Initialize browser manager
    logger.info('Initializing browser manager...');
    await initializeBrowserManager();

    // Extract URLs from sitemap
    logger.info('Extracting URLs from sitemap...');
    const urlExtractor = getURLExtractor();
    const urls = await urlExtractor.extractFromSitemap();

    if (urls.length === 0) {
      logger.warn('No URLs found in sitemap');
      return;
    }

    logger.info(`Found ${urls.length} product URLs`);

    // Add jobs to queue
    logger.info('Adding jobs to queue...');
    const queueService = getQueueService();

    const jobs = urls.map((source) => ({
      url: source.url,
      productId: source.productId,
      category: source.category,
    }));

    await queueService.addBulkJobs(jobs);

    logger.info('Jobs added to queue successfully', { count: jobs.length });
    logger.info('Start the worker to process jobs: npm run worker');

    // Get queue stats
    const stats = await queueService.getStats();
    logger.info('Queue statistics', stats);

    // Cleanup
    await queueService.close();
    const browserManager = getBrowserManager();
    await browserManager.shutdown();

    logger.info('Application completed successfully');
  } catch (error) {
    logger.error('Application error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message });
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main();
}

export default main;
