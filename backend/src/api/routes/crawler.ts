/**
 * Crawler API Routes
 * Endpoints for web crawling and screenshot capture
 */

import { Router, Request, Response } from 'express';
import { webCrawlerService } from '../../services/web-crawler-service';
import { CrawlConfig } from '../../types/crawler-types';

const router = Router();

/**
 * POST /api/crawler/start
 * Start a new crawl job
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { shopUrl, config } = req.body;

    if (!shopUrl) {
      return res.status(400).json({
        success: false,
        error: 'Shop URL is required'
      });
    }

    // Validate URL
    try {
      new URL(shopUrl);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    const job = await webCrawlerService.startCrawl(shopUrl, config as Partial<CrawlConfig>);

    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        shopUrl: job.shopUrl,
        config: job.config
      }
    });

  } catch (error) {
    console.error('Start crawl error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start crawl'
    });
  }
});

/**
 * GET /api/crawler/jobs/:id
 * Get crawl job status and results
 */
router.get('/jobs/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = webCrawlerService.getJob(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Calculate variant statistics
    const baseProducts = job.results.screenshots.filter(
      s => !s.metadata?.variantInfo || s.metadata.variantInfo.isBaseProduct
    );
    const variants = job.results.screenshots.filter(
      s => s.metadata?.variantInfo && !s.metadata.variantInfo.isBaseProduct
    );

    // Group variants by parent URL
    const variantsByProduct = new Map<string, any[]>();
    variants.forEach(variant => {
      const parentUrl = variant.metadata?.variantInfo?.parentUrl || variant.productUrl;
      if (!variantsByProduct.has(parentUrl)) {
        variantsByProduct.set(parentUrl, []);
      }
      variantsByProduct.get(parentUrl)?.push(variant);
    });

    res.json({
      success: true,
      data: {
        ...job,
        variantStats: {
          totalProducts: baseProducts.length,
          totalVariants: variants.length,
          totalScreenshots: job.results.screenshots.length,
          variantsByProduct: Array.from(variantsByProduct.entries()).map(([url, variants]) => ({
            productUrl: url,
            variantCount: variants.length,
            variants: variants.map(v => ({
              label: v.metadata?.variantInfo?.label,
              articleNumber: v.metadata?.articleNumber
            }))
          }))
        }
      }
    });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job'
    });
  }
});

/**
 * GET /api/crawler/jobs
 * Get all crawl jobs
 */
router.get('/jobs', (_req: Request, res: Response) => {
  try {
    const jobs = webCrawlerService.getAllJobs();

    res.json({
      success: true,
      data: {
        total: jobs.length,
        jobs: jobs.map(job => ({
          id: job.id,
          shopUrl: job.shopUrl,
          status: job.status,
          productsFound: job.results.productsFound,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          duration: job.results.duration,
          error: job.error
        }))
      }
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get jobs'
    });
  }
});

/**
 * POST /api/crawler/stop/:id
 * Stop a running crawl job
 */
router.post('/stop/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stopped = await webCrawlerService.stopJob(id);

    if (!stopped) {
      return res.status(400).json({
        success: false,
        error: 'Job not found or not running'
      });
    }

    res.json({
      success: true,
      message: 'Job stopped successfully'
    });

  } catch (error) {
    console.error('Stop job error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop job'
    });
  }
});

/**
 * GET /api/crawler/screenshots/:jobId
 * Get screenshots for a specific job
 */
router.get('/screenshots/:jobId', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = webCrawlerService.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: {
        total: job.results.screenshots.length,
        screenshots: job.results.screenshots.map(screenshot => ({
          id: screenshot.id,
          url: screenshot.url,
          imagePath: screenshot.imagePath,
          thumbnailPath: screenshot.thumbnailPath,
          metadata: screenshot.metadata,
          extractedElements: screenshot.extractedElements
        }))
      }
    });

  } catch (error) {
    console.error('Get screenshots error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get screenshots'
    });
  }
});

/**
 * POST /api/crawler/detect
 * Auto-detect product selectors from a URL
 */
router.post('/detect', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // This would be implemented with the product detector service
    res.json({
      success: true,
      message: 'Product detection endpoint - implementation pending',
      data: null
    });

  } catch (error) {
    console.error('Detect error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect products'
    });
  }
});

/**
 * DELETE /api/crawler/cleanup
 * Clean up old completed jobs
 */
router.delete('/cleanup', (req: Request, res: Response) => {
  try {
    const { maxAgeHours } = req.query;
    const maxAge = maxAgeHours ? parseInt(maxAgeHours as string) * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    webCrawlerService.cleanupOldJobs(maxAge);

    res.json({
      success: true,
      message: 'Old jobs cleaned up successfully'
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup jobs'
    });
  }
});

export default router;
