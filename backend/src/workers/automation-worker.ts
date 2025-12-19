/**
 * Automation Worker
 * Processes automation jobs from the BullMQ queue
 *
 * This worker handles the complete automation workflow:
 * 1. Crawling - Capture screenshots from shop URLs
 * 2. OCR - Extract text from screenshots
 * 3. Product Save - Save extracted data to database
 * 4. (Optional) Matching - Match with Excel data
 * 5. (Optional) Rendering - Generate labels
 */

import { Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { webCrawlerService } from '../services/web-crawler-service';
import { robustOCRService } from '../services/robust-ocr-service';
import { ProductService } from '../services/product-service';
import { AutomationJob, AutomationConfig } from '../types/automation-types';
import {
  queueService,
  QUEUE_NAMES,
  AutomationJobData,
  AutomationJobResult,
} from '../services/queue-service';
import {
  emitJobCreated,
  emitJobUpdated,
  emitJobCompleted,
  emitJobFailed,
} from '../services/automation';
import logger from '../utils/logger';
import prisma from '../lib/prisma';

// Job state stored in Redis via BullMQ job data
interface JobState {
  job: AutomationJob;
  lastUpdated: string;
}

/**
 * Initialize and start the automation worker
 */
export function startAutomationWorker(): void {
  const worker = queueService.registerWorker<AutomationJobData, AutomationJobResult>(
    QUEUE_NAMES.AUTOMATION,
    processAutomationJob,
    1 // Process one job at a time
  );

  if (worker) {
    logger.info('Automation worker started');
  } else {
    logger.error('Failed to start automation worker');
  }
}

/**
 * Process a single automation job
 */
async function processAutomationJob(
  bullmqJob: Job<AutomationJobData, AutomationJobResult>
): Promise<AutomationJobResult> {
  const { config, jobId } = bullmqJob.data;
  const startTime = Date.now();

  logger.info('Processing automation job', {
    jobId,
    shopUrl: config.shopUrl,
    bullmqJobId: bullmqJob.id,
  });

  // Initialize job state
  const job: AutomationJob = {
    id: jobId,
    name: config.name || `Automation ${new Date().toISOString()}`,
    status: 'pending',
    config,
    progress: {
      currentStep: 'crawling',
      totalSteps: 4,
      currentStepProgress: 0,
      productsFound: 0,
      productsProcessed: 0,
      labelsGenerated: 0,
      errors: [],
    },
    results: {
      screenshots: [],
      ocrResults: [],
      matchResults: [],
      labels: [],
      summary: {
        totalProducts: 0,
        successfulOCR: 0,
        failedOCR: 0,
        successfulMatches: 0,
        failedMatches: 0,
        labelsGenerated: 0,
        averageConfidence: 0,
        totalProcessingTime: 0,
      },
    },
    createdAt: new Date(bullmqJob.data.createdAt),
    updatedAt: new Date(),
  };

  // Save initial state to database
  await saveJobState(job);

  // Emit WebSocket event: Job Created
  emitJobCreated(job);

  try {
    // Step 1: Crawl website
    await stepCrawl(job, bullmqJob);

    // Step 2: OCR Processing
    await stepOCR(job, bullmqJob);

    // Step 2.5: Save products to database
    await stepSaveProducts(job, bullmqJob);

    // Complete
    job.status = 'completed';
    job.completedAt = new Date();
    job.results.summary.totalProcessingTime = Date.now() - startTime;
    job.updatedAt = new Date();

    await saveJobState(job);

    logger.info(`Automation job completed: ${jobId}`, {
      products: job.results.summary.totalProducts,
      labelsGenerated: job.results.summary.labelsGenerated,
      processingTime: job.results.summary.totalProcessingTime,
    });

    // Emit WebSocket event: Job Completed
    emitJobCompleted(job);

    return {
      success: true,
      jobId,
      summary: job.results.summary,
    };
  } catch (error: any) {
    logger.error(`Automation job failed: ${jobId}`, { error: error.message });

    job.status = 'failed';
    job.error = error.message;
    job.updatedAt = new Date();

    await saveJobState(job);

    // Emit WebSocket event: Job Failed
    emitJobFailed(job, error.message, job.progress.currentStep);

    return {
      success: false,
      jobId,
      error: error.message,
    };
  }
}

/**
 * Save job state to database for persistence
 */
async function saveJobState(job: AutomationJob): Promise<void> {
  try {
    await prisma.automationJobState.upsert({
      where: { jobId: job.id },
      update: {
        status: job.status,
        progress: JSON.stringify(job.progress),
        results: JSON.stringify(job.results),
        error: job.error,
        updatedAt: new Date(),
        completedAt: job.completedAt,
      },
      create: {
        jobId: job.id,
        name: job.name,
        config: JSON.stringify(job.config),
        status: job.status,
        progress: JSON.stringify(job.progress),
        results: JSON.stringify(job.results),
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    // Log but don't fail the job - database state is optional
    logger.warn('Failed to save job state to database', { jobId: job.id, error });
  }
}

/**
 * Load job state from database
 */
export async function loadJobState(jobId: string): Promise<AutomationJob | null> {
  try {
    const state = await prisma.automationJobState.findUnique({
      where: { jobId },
    });

    if (!state) return null;

    return {
      id: state.jobId,
      name: state.name,
      status: state.status as AutomationJob['status'],
      config: JSON.parse(state.config as string),
      progress: JSON.parse(state.progress as string),
      results: JSON.parse(state.results as string),
      error: state.error ?? undefined,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      completedAt: state.completedAt ?? undefined,
    };
  } catch (error) {
    logger.error('Failed to load job state from database', { jobId, error });
    return null;
  }
}

/**
 * Get all job states from database
 */
export async function getAllJobStates(): Promise<AutomationJob[]> {
  try {
    const states = await prisma.automationJobState.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100 jobs
    });

    return states.map((state) => ({
      id: state.jobId,
      name: state.name,
      status: state.status as AutomationJob['status'],
      config: JSON.parse(state.config as string),
      progress: JSON.parse(state.progress as string),
      results: JSON.parse(state.results as string),
      error: state.error ?? undefined,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      completedAt: state.completedAt ?? undefined,
    }));
  } catch (error) {
    logger.error('Failed to load job states from database', { error });
    return [];
  }
}

/**
 * Step 1: Crawl website
 */
async function stepCrawl(
  job: AutomationJob,
  bullmqJob: Job<AutomationJobData, AutomationJobResult>
): Promise<void> {
  logger.info(`Step 1/4: Crawling ${job.config.shopUrl}...`);
  job.status = 'crawling';
  job.progress.currentStep = 'crawling';
  job.progress.currentStepProgress = 0;

  emitJobUpdated(job.id, job.status, 25, 'crawling');
  await bullmqJob.updateProgress(10);

  const crawlConfig = {
    maxProducts: job.config.crawlerConfig?.maxProducts || 2000,
    fullShopScan: job.config.crawlerConfig?.fullShopScan ?? true,
    followPagination: job.config.crawlerConfig?.followPagination ?? true,
    screenshotQuality: job.config.crawlerConfig?.screenshotQuality || 90,
  };

  const crawlJob = await webCrawlerService.startCrawl(job.config.shopUrl, crawlConfig);
  job.results.crawlJobId = crawlJob.id;

  // Wait for crawl to complete
  let complete = false;
  while (!complete) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const status = webCrawlerService.getJob(crawlJob.id);
    if (!status) break;

    const found = status.results?.screenshots?.length || 0;
    const total = crawlConfig.maxProducts;
    job.progress.currentStepProgress = Math.round((found / total) * 100);
    job.progress.productsFound = found;

    // Update BullMQ progress
    await bullmqJob.updateProgress(10 + Math.round((job.progress.currentStepProgress / 100) * 15));

    emitJobUpdated(
      job.id,
      job.status,
      calculateOverallProgress(1, job.progress.currentStepProgress),
      'crawling'
    );

    if (status.status === 'completed' || status.status === 'failed') {
      complete = true;
    }
  }

  // Get screenshots from job
  const crawlJobFinal = webCrawlerService.getJob(crawlJob.id);
  const screenshots = crawlJobFinal?.results.screenshots || [];

  job.results.screenshots = screenshots.map((s: any) => ({
    productUrl: s.url || s.productUrl || '',
    screenshotPath: s.imagePath || s.fullPath || s.path || '',
    thumbnailPath: s.thumbnailPath,
  }));

  job.progress.currentStepProgress = 100;
  await saveJobState(job);

  logger.info(`Crawl complete: ${screenshots.length} screenshots captured`);
}

/**
 * Step 2: OCR Processing
 */
async function stepOCR(
  job: AutomationJob,
  bullmqJob: Job<AutomationJobData, AutomationJobResult>
): Promise<void> {
  logger.info(`Step 2/4: Processing ${job.results.screenshots.length} screenshots with OCR...`);
  job.status = 'processing-ocr';
  job.progress.currentStep = 'ocr';
  job.progress.currentStepProgress = 0;

  emitJobUpdated(job.id, job.status, 50, 'processing-ocr');
  await bullmqJob.updateProgress(30);

  const crawlJobFinal = webCrawlerService.getJob(job.results.crawlJobId || '');
  const fullScreenshots = crawlJobFinal?.results.screenshots || [];

  // Deduplicate by folder name
  const processedFolders = new Set<string>();
  const uniqueScreenshots = fullScreenshots.filter((s: any) => {
    if (!s.imagePath) return false;

    const pathSeparator = s.imagePath.includes('\\') ? '\\' : '/';
    const pathParts = s.imagePath.split(pathSeparator);
    const folderName = pathParts[pathParts.length - 2];

    if (folderName && folderName.trim() !== '') {
      if (processedFolders.has(folderName)) {
        return false;
      }
      processedFolders.add(folderName);
      return true;
    }
    return false;
  });

  logger.info(`Deduplicated: ${fullScreenshots.length} → ${uniqueScreenshots.length} screenshots`);
  job.results.summary.totalProducts = uniqueScreenshots.length;

  // Process in batches
  const BATCH_SIZE = 10;
  let processed = 0;

  const batches: (typeof uniqueScreenshots)[] = [];
  for (let i = 0; i < uniqueScreenshots.length; i += BATCH_SIZE) {
    batches.push(uniqueScreenshots.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    const batchPromises = batch.map(async (screenshot: any) => {
      try {
        if (!screenshot.imagePath) {
          processed++;
          return;
        }

        const pathSeparator = screenshot.imagePath.includes('\\') ? '\\' : '/';
        const pathParts = screenshot.imagePath.split(pathSeparator);
        const fileName = pathParts[pathParts.length - 1];
        const folderName = pathParts[pathParts.length - 2];

        let result: any;

        if (
          folderName &&
          fileName === 'product-image.png' &&
          (/^\d+(-[A-Z]+)?$/.test(folderName) || /^product-\d+$/.test(folderName))
        ) {
          const screenshotDir = pathParts.slice(0, -2).join(pathSeparator);
          const articleNumber = folderName;

          const robustResult = await robustOCRService.processArticleElements(
            screenshotDir,
            articleNumber
          );

          const confidenceValues = Object.values(robustResult.confidence || {}).filter(
            (v: any) => typeof v === 'number'
          );
          const overallConfidence =
            confidenceValues.length > 0
              ? (confidenceValues as number[]).reduce((sum, val) => sum + val, 0) /
                confidenceValues.length
              : 0.8;

          result = {
            id: uuidv4(),
            screenshotId: screenshot.id,
            status: robustResult.success ? 'completed' : 'failed',
            success: robustResult.success,
            productUrl: screenshot.productUrl || screenshot.url || '',
            confidence: { overall: overallConfidence },
            extractedData: {
              articleNumber: robustResult.data.articleNumber || articleNumber,
              productName: robustResult.data.productName || '',
              description: robustResult.data.description || '',
              price: robustResult.data.price || 0,
              tieredPrices: robustResult.data.tieredPrices || [],
              tieredPricesText: robustResult.data.tieredPricesText || '',
            },
            screenshot,
          };
        } else if (
          ['title.png', 'article-number.png', 'description.png', 'price-table.png'].includes(
            fileName
          )
        ) {
          processed++;
          return;
        } else {
          const { ocrService } = await import('../services/ocr-service');
          const ocrResult = await ocrService.processScreenshot(
            screenshot.imagePath,
            job.config.ocrConfig || {},
            job.id
          );
          result = {
            id: ocrResult.id,
            screenshotId: ocrResult.screenshotId,
            status: ocrResult.status,
            confidence: ocrResult.confidence,
            extractedData: ocrResult.extractedData,
          };
        }

        if (!result) {
          processed++;
          return;
        }

        job.results.ocrResults.push({
          screenshotId: result.screenshotId || screenshot.id,
          ocrResultId: result.id,
          extractedData: result.extractedData,
          articleNumber: result.extractedData?.articleNumber,
          productName: result.extractedData?.productName,
          price: result.extractedData?.price,
          priceType: result.extractedData?.priceType,
          tieredPrices: result.extractedData?.tieredPrices,
          tieredPricesText: result.extractedData?.tieredPricesText,
          fullText: result.extractedData?.description,
          confidence: result.confidence?.overall || 0.5,
          success: result.status === 'completed',
          status: result.status,
          error: result.status === 'failed' ? 'OCR processing failed' : undefined,
          productUrl: screenshot.productUrl || screenshot.url || null,
          screenshotPath: screenshot.imagePath,
        });

        if (result.status === 'completed') {
          job.results.summary.successfulOCR++;
        } else {
          job.results.summary.failedOCR++;
        }

        processed++;
        job.progress.currentStepProgress = Math.round((processed / uniqueScreenshots.length) * 100);
        job.progress.productsProcessed = processed;

        // Update BullMQ progress
        if (processed % 10 === 0 || processed === uniqueScreenshots.length) {
          await bullmqJob.updateProgress(
            30 + Math.round((job.progress.currentStepProgress / 100) * 40)
          );
          emitJobUpdated(
            job.id,
            job.status,
            calculateOverallProgress(2, job.progress.currentStepProgress),
            'processing-ocr',
            `Processing OCR: ${processed}/${uniqueScreenshots.length}`
          );
        }
      } catch (error: any) {
        logger.error(`Failed to process screenshot`, { error: error.message });
        job.results.summary.failedOCR++;
        job.progress.errors.push(`OCR failed: ${error.message}`);
      }
    });

    try {
      await Promise.all(batchPromises);
    } catch (batchError: any) {
      logger.warn(`Batch had errors but continuing`, { error: batchError.message });
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await saveJobState(job);
  logger.info(
    `OCR complete: ${job.results.summary.successfulOCR}/${uniqueScreenshots.length} successful`
  );
}

/**
 * Step 2.5: Save products to database
 */
async function stepSaveProducts(
  job: AutomationJob,
  bullmqJob: Job<AutomationJobData, AutomationJobResult>
): Promise<void> {
  logger.info('Step 2.5/4: Saving products to database...');
  await bullmqJob.updateProgress(75);

  try {
    const crawlJobId = job.results.crawlJobId;

    if (!crawlJobId) {
      logger.warn('No crawl job ID, skipping product save');
      return;
    }

    if (!job.results.ocrResults || job.results.ocrResults.length === 0) {
      logger.warn('No OCR results to save');
      return;
    }

    const results = await ProductService.processOcrResultsFromAutomation(
      job.results.ocrResults,
      crawlJobId
    );

    if (results) {
      logger.info(
        `Products saved: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`
      );

      emitJobUpdated(
        job.id,
        'products-saved',
        80,
        'products-saved',
        `${results.created + results.updated} products saved to database`
      );
    } else {
      logger.warn('No products saved (all failed validation)');
    }
  } catch (error: any) {
    logger.error('Failed to save products', { error: error.message });
    job.progress.errors.push(`Product save failed: ${error.message}`);
  }

  await bullmqJob.updateProgress(90);
  await saveJobState(job);
}

/**
 * Calculate overall progress percentage
 */
function calculateOverallProgress(step: number, stepProgress: number): number {
  const stepWeights = [25, 50, 15, 10]; // Crawl, OCR, Save, Render
  let total = 0;

  for (let i = 0; i < step - 1; i++) {
    total += stepWeights[i];
  }

  total += (stepProgress / 100) * stepWeights[step - 1];
  return Math.round(total);
}
