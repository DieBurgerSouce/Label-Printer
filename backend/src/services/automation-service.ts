/**
 * Automation Service
 * Orchestrates the complete one-click label generation workflow
 * Crawler → OCR → Matcher → Template Rendering
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { webCrawlerService } from './web-crawler-service';
import { robustOCRService } from './robust-ocr-service';
import { matcherService } from './matcher-service';
import { templateEngine } from './template-engine';
import { ProductService } from './product-service';
import { getWebSocketServer } from '../websocket/socket-server.js';
import { AutomationJob, AutomationConfig } from '../types/automation-types';

class AutomationService {
  private jobs: Map<string, AutomationJob> = new Map();

  /**
   * Start a complete automation job
   * ONE-CLICK: URL → Labels!
   */
  async startAutomation(config: AutomationConfig): Promise<AutomationJob> {
    const jobId = uuidv4();

    console.log(`🚀 Starting automation job: ${jobId}`);
    console.log(`   Shop URL: ${config.shopUrl}`);
    console.log(`   Template: ${config.templateId}`);

    const job: AutomationJob = {
      id: jobId,
      name: `Automation ${new Date().toISOString()}`,
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);

    // Emit WebSocket event: Job Created
    try {
      const wsServer = getWebSocketServer();
      wsServer.emitJobCreated({
        jobId: job.id,
        jobType: 'automation',
        name: job.name,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // WebSocket not initialized, ignore
    }

    // Run workflow asynchronously
    this.runWorkflow(job).catch((error) => {
      console.error(`❌ Automation job ${jobId} failed:`, error);
      job.status = 'failed';
      job.error = error.message;
      job.updatedAt = new Date();

      // Emit WebSocket event: Job Failed
      try {
        const wsServer = getWebSocketServer();
        wsServer.emitJobFailed(job.id, {
          error: error.message,
          stage: job.progress.currentStep,
        });
      } catch (err) {
        // WebSocket not initialized, ignore
      }
    });

    return job;
  }

  /**
   * Run the complete workflow
   */
  private async runWorkflow(job: AutomationJob): Promise<void> {
    const startTime = Date.now();

    try {
      // Step 1: Crawl website and capture screenshots
      await this.stepCrawl(job);

      // Step 2: Process screenshots with OCR
      await this.stepOCR(job);

      // Step 2.5: Save products to database
      await this.stepSaveProducts(job);

      // Step 3: Match OCR results with Excel data (SKIP - not needed without Excel)
      // await this.stepMatch(job);

      // Step 4: Generate labels using template (SKIP - just create articles, no labels)
      // await this.stepRender(job);

      // Complete
      job.status = 'completed';
      job.completedAt = new Date();
      job.results.summary.totalProcessingTime = Date.now() - startTime;

      console.log(`✅ Automation job ${job.id} completed!`);
      console.log(`   Products: ${job.results.summary.totalProducts}`);
      console.log(`   Labels Generated: ${job.results.summary.labelsGenerated}`);
      console.log(`   Time: ${job.results.summary.totalProcessingTime}ms`);

      // Emit WebSocket event: Job Completed
      try {
        const wsServer = getWebSocketServer();
        wsServer.emitJobCompleted(job.id, {
          results: job.results,
          duration: job.results.summary.totalProcessingTime,
        });
      } catch (err) {
        // WebSocket not initialized, ignore
      }
    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message;
      throw error;
    } finally {
      job.updatedAt = new Date();
    }
  }

  /**
   * Step 1: Crawl website
   */
  private async stepCrawl(job: AutomationJob): Promise<void> {
    console.log(`📸 Step 1/4: Crawling ${job.config.shopUrl}...`);
    job.status = 'crawling';
    job.progress.currentStep = 'crawling';
    job.progress.currentStepProgress = 0;

    // Emit WebSocket event: Job Updated (Step Started)
    try {
      const wsServer = getWebSocketServer();
      wsServer.emitJobUpdated(job.id, {
        status: job.status,
        progress: 25, // 25% (step 1 of 4)
        currentStage: 'crawling',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // WebSocket not initialized, ignore
    }

    const crawlConfig = {
      maxProducts: job.config.crawlerConfig?.maxProducts || 2000,
      fullShopScan: (job.config.crawlerConfig as any)?.fullShopScan ?? true,
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

      // Emit WebSocket progress update every second during crawling
      try {
        const wsServer = getWebSocketServer();
        const overallProgress = Math.round(0 + job.progress.currentStepProgress / 4); // Step 1/4
        wsServer.emitJobUpdated(job.id, {
          status: job.status,
          progress: overallProgress,
          currentStage: 'crawling',
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        // WebSocket not initialized, ignore
      }

      if (status.status === 'completed' || status.status === 'failed') {
        complete = true;
      }
    }

    // Get screenshots from job
    const crawlJobFinal = webCrawlerService.getJob(crawlJob.id);
    const screenshots = crawlJobFinal?.results.screenshots || [];

    job.results.screenshots = screenshots.map((s: any) => ({
      productUrl: s.url || s.productUrl || '',
      screenshotPath: s.imagePath || s.fullPath || s.path || '', // WebCrawler uses imagePath
      thumbnailPath: s.thumbnailPath,
    }));

    // DON'T set totalProducts here - it will be set after deduplication in stepOCR
    // This raw count includes duplicates (e.g., multiple screenshots per product)
    job.progress.currentStepProgress = 100;

    console.log(
      `✅ Crawl complete: ${screenshots.length} raw screenshots captured (deduplication happens in OCR step)`
    );
  }

  /**
   * Step 2: OCR Processing
   */
  private async stepOCR(job: AutomationJob): Promise<void> {
    console.log(
      `🔍 Step 2/4: Processing ${job.results.screenshots.length} screenshots with OCR...`
    );
    job.status = 'processing-ocr';
    job.progress.currentStep = 'ocr';
    job.progress.currentStepProgress = 0;

    // Emit WebSocket event: Job Updated (Step Started)
    try {
      const wsServer = getWebSocketServer();
      wsServer.emitJobUpdated(job.id, {
        status: job.status,
        progress: 50, // 50% (step 2 of 4)
        currentStage: 'processing-ocr',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // WebSocket not initialized, ignore
    }

    const ocrConfig = job.config.ocrConfig || {};

    // Get the full screenshot data from the crawler
    const crawlJobFinal = webCrawlerService.getJob(job.results.crawlJobId || '');
    const fullScreenshots = crawlJobFinal?.results.screenshots || [];

    // Deduplicate by folder name (article number OR timestamp)
    const processedFolders = new Set<string>();
    const uniqueScreenshots = fullScreenshots.filter((s) => {
      if (!s.imagePath) return false;

      const pathSeparator = s.imagePath.includes('\\') ? '\\' : '/';
      const pathParts = s.imagePath.split(pathSeparator);
      const folderName = pathParts[pathParts.length - 2]; // e.g., "8803" or "product-1729123456"

      // CRITICAL FIX: Accept ALL non-empty folder names, don't filter by pattern!
      // The crawler creates unique folders for each product - trust that
      if (folderName && folderName.trim() !== '') {
        if (processedFolders.has(folderName)) {
          return false; // Skip duplicate folder
        }
        processedFolders.add(folderName);
        return true;
      }
      return false; // Skip if no folder name
    });

    console.log(
      `  📊 Deduplicated: ${fullScreenshots.length} → ${uniqueScreenshots.length} screenshots`
    );

    // 🔧 FIX: Set totalProducts AFTER deduplication, not before!
    // This ensures the job monitor shows the correct count
    job.results.summary.totalProducts = uniqueScreenshots.length;
    console.log(`  ✅ Total unique products to process: ${uniqueScreenshots.length}`);

    // Check if we have enough unique screenshots
    const targetProducts = (job.config as any).maxProducts || 50;
    if (uniqueScreenshots.length < targetProducts) {
      console.log(
        `  ⚠️ WARNING: Only ${uniqueScreenshots.length} unique screenshots found, but ${targetProducts} were requested!`
      );
      console.log(`  ℹ️ This shop may not have enough unique products. Processing what we have...`);
    }

    // CRITICAL: Process in batches to avoid memory/worker exhaustion
    const BATCH_SIZE = 10; // Increased from 5 to avoid 25-limit bug
    let processed = 0;

    // Split screenshots into batches
    const batches: (typeof uniqueScreenshots)[] = [];
    for (let i = 0; i < uniqueScreenshots.length; i += BATCH_SIZE) {
      batches.push(uniqueScreenshots.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `  📦 Processing ${uniqueScreenshots.length} screenshots in ${batches.length} batches of ${BATCH_SIZE}...`
    );

    for (const batch of batches) {
      console.log(
        `  🔄 Processing batch ${Math.floor(processed / BATCH_SIZE) + 1}/${batches.length}...`
      );

      const batchPromises = batch.map(async (screenshot) => {
        try {
          // Skip screenshots without imagePath (e.g., widget URLs)
          if (!screenshot.imagePath) {
            console.log(`  ⚠️ Skipping screenshot without path`);
            processed++;
            return;
          }

          let result;

          // Extract folder name from path (works on both Windows and Unix)
          // Windows: C:\path\jobId\8803\product-image.png OR C:\path\jobId\product-1729123456\product-image.png
          // Unix: /path/jobId/8803/product-image.png OR /path/jobId/product-1729123456/product-image.png
          const pathSeparator = screenshot.imagePath.includes('\\') ? '\\' : '/';
          const pathParts = screenshot.imagePath.split(pathSeparator);

          // Check if this is a precise screenshot (element-based)
          const fileName = pathParts[pathParts.length - 1]; // e.g., "product-image.png"
          const folderName = pathParts[pathParts.length - 2]; // e.g., "8803" or "product-1729123456"

          console.log(
            `  🐛 DEBUG: fileName="${fileName}", folderName="${folderName}", imagePath="${screenshot.imagePath}"`
          );

          // Check if it's an article number (with optional suffix) OR timestamp folder
          if (
            folderName &&
            fileName === 'product-image.png' &&
            (/^\d+(-[A-Z]+)?$/.test(folderName) || // Article number with optional suffix (e.g., "5020", "5020-GE", "8120-C", "7900-SH")
              /^product-\d+$/.test(folderName)) // Timestamp folder
          ) {
            // New precise screenshot method for element-based screenshots with HTML fusion
            const screenshotDir = pathParts.slice(0, -2).join(pathSeparator); // Get directory without folder name

            // 🔧 FIX: Use FULL folder name as article number (INCLUDING variant suffix like "-SH")
            // This ensures variants like "7900-SH" are treated as separate articles from base "7900"
            const articleNumber = folderName; // Keep suffix! "7900-SH" stays "7900-SH"

            console.log(
              `  🎯 Using element OCR with HTML fusion for folder ${folderName} (article ${articleNumber})`
            );

            // Process with robust OCR service (HTML + OCR fusion)
            const robustResult = await robustOCRService.processArticleElements(
              screenshotDir,
              articleNumber
            );

            // Calculate overall confidence from individual field confidences
            const confidenceValues = Object.values(robustResult.confidence || {}).filter(
              (v: any) => typeof v === 'number'
            );
            const overallConfidence =
              confidenceValues.length > 0
                ? confidenceValues.reduce((sum: number, val: number) => sum + val, 0) /
                  confidenceValues.length
                : 0.8;

            // Convert to format expected by product-service
            result = {
              id: uuidv4(),
              screenshotId: screenshot.id,
              status: robustResult.success ? 'completed' : 'failed', // ← FIX: Add status field!
              success: robustResult.success,
              productUrl: screenshot.productUrl || screenshot.url || '', // ← FIX: Use REAL crawled URL!
              confidence: {
                overall: overallConfidence, // ← FIX: Calculate average of all field confidences!
              },
              extractedData: {
                articleNumber: robustResult.data.articleNumber || articleNumber, // ← FIX: Use data.articleNumber!
                productName: robustResult.data.productName || '',
                description: robustResult.data.description || '',
                price: robustResult.data.price || 0,
                tieredPrices: robustResult.data.tieredPrices || [],
                tieredPricesText: robustResult.data.tieredPricesText || '',
              },
              screenshot: screenshot as any,
            } as any;
          } else if (
            fileName === 'title.png' ||
            fileName === 'article-number.png' ||
            fileName === 'description.png' ||
            fileName === 'price-table.png'
          ) {
            // Skip element screenshots - they're already processed via product-image.png
            console.log(`  ⏩ Skipping element screenshot: ${fileName}`);
            processed++;
            return;
          } else {
            // Fallback to old OCR method (no HTML fusion available)
            console.log(`  📄 Using standard OCR for ${screenshot.imagePath}`);
            const { ocrService } = await import('./ocr-service');
            result = await ocrService.processScreenshot(screenshot.imagePath, ocrConfig, job.id);
          }

          // SAFETY CHECK: Ensure result exists before pushing
          if (!result) {
            console.error(`  ❌ ERROR: result is undefined for ${screenshot.imagePath}`);
            processed++;
            return;
          }

          // DEBUG: Log extraction result
          console.log(`  🐛 Extraction complete:`, {
            status: result.status,
            hasExtractedData: !!result.extractedData,
            articleNumber: result.extractedData?.articleNumber,
            productName: result.extractedData?.productName,
            priceType: result.extractedData?.priceType,
            hasProductUrl: !!(screenshot.productUrl || screenshot.url),
          });

          job.results.ocrResults.push({
            screenshotId: result.screenshotId,
            ocrResultId: result.id,
            extractedData: result.extractedData,
            // FIX: Map extractedData fields to top-level for product-service compatibility
            articleNumber: result.extractedData?.articleNumber,
            productName: result.extractedData?.productName,
            price: result.extractedData?.price,
            priceType: result.extractedData?.priceType, // auf_anfrage, normal, tiered, unknown
            tieredPrices: result.extractedData?.tieredPrices,
            tieredPricesText: result.extractedData?.tieredPricesText,
            fullText: result.extractedData?.description, // Map description to fullText
            confidence: result.confidence?.overall || 0.5,
            success: result.status === 'completed',
            status: result.status, // Add status field
            error: result.status === 'failed' ? 'OCR processing failed' : undefined,
            productUrl: screenshot.productUrl || screenshot.url || null, // Add product URL
            screenshotPath: screenshot.imagePath, // CRITICAL: Add screenshotPath for product-service to extract folder name
          } as any);

          if (result.status === 'completed') {
            job.results.summary.successfulOCR++;
          } else {
            job.results.summary.failedOCR++;
          }

          processed++;
          job.progress.currentStepProgress = Math.round(
            (processed / uniqueScreenshots.length) * 100
          );
          job.progress.productsProcessed = processed;

          // Send progress update every 10 screenshots (or on last one)
          if (processed % 10 === 0 || processed === uniqueScreenshots.length) {
            try {
              const wsServer = getWebSocketServer();
              const stepProgress = job.progress.currentStepProgress;
              // OCR is step 2/4, so overall = 25% + (stepProgress / 4)
              const overallProgress = 25 + Math.round(stepProgress / 4);

              wsServer.emitJobUpdated(job.id, {
                status: job.status,
                progress: overallProgress,
                currentStage: 'processing-ocr',
                message: `Processing OCR: ${processed}/${uniqueScreenshots.length}`,
                timestamp: new Date().toISOString(),
              });
            } catch (err) {
              // WebSocket not initialized, ignore
            }
          }
        } catch (error: any) {
          console.error(`Failed to process screenshot:`, error);
          job.results.summary.failedOCR++;
          job.progress.errors.push(`OCR failed: ${error.message}`);
        }
      });

      // Wait for batch to complete with better error handling
      try {
        await Promise.all(batchPromises);
      } catch (batchError: any) {
        console.error(
          `⚠️ Batch ${Math.floor(processed / BATCH_SIZE)} had errors but continuing:`,
          batchError.message
        );
        // Continue processing - don't stop everything!
      }

      // Add delay between batches to let workers breathe
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(
      `✅ OCR complete: ${job.results.summary.successfulOCR}/${uniqueScreenshots.length} successful`
    );
  }

  /**
   * Step 2.5: Save products to database
   */
  private async stepSaveProducts(job: AutomationJob): Promise<void> {
    console.log(`💾 Step 2.5/4: Saving products to database...`);

    try {
      // Get crawl job ID
      const crawlJobId = job.results.crawlJobId;

      if (!crawlJobId) {
        console.log('⚠️  No crawl job ID, skipping product save');
        return;
      }

      // Check if we have OCR results
      if (!job.results.ocrResults || job.results.ocrResults.length === 0) {
        console.log('⚠️  No OCR results to save');
        return;
      }

      // Process OCR results directly from the job
      const results = await ProductService.processOcrResultsFromAutomation(
        job.results.ocrResults,
        crawlJobId
      );

      if (results) {
        console.log(
          `✅ Products saved: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`
        );

        // Emit WebSocket event
        try {
          const wsServer = getWebSocketServer();
          wsServer.emitJobUpdated(job.id, {
            status: 'products-saved',
            progress: 60,
            currentStage: 'products-saved',
            message: `${results.created + results.updated} products saved to database`,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          // WebSocket not initialized, ignore
        }
      } else {
        console.log('⚠️ No products saved (all failed validation)');
      }
    } catch (error: any) {
      console.error('Failed to save products:', error);
      // Don't fail the job, just log the error
      job.progress.errors.push(`Product save failed: ${error.message}`);
    }
  }

  /**
   * Step 3: Match with Excel data
   */
  private async stepMatch(job: AutomationJob): Promise<void> {
    console.log(`🔗 Step 3/4: Matching OCR results with Excel data...`);
    job.status = 'matching';
    job.progress.currentStep = 'matching';
    job.progress.currentStepProgress = 0;

    // Emit WebSocket event: Job Updated (Step Started)
    try {
      const wsServer = getWebSocketServer();
      wsServer.emitJobUpdated(job.id, {
        status: job.status,
        progress: 75, // 75% (step 3 of 4)
        currentStage: 'matching',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // WebSocket not initialized, ignore
    }

    const excelData = job.config.excelData || [];
    const matchConfig = job.config.matcherConfig || { threshold: 0.6 };

    if (excelData.length === 0) {
      console.log('⚠️  No Excel data provided, skipping matching step');
      job.progress.currentStepProgress = 100;
      return;
    }

    let processed = 0;
    const totalConfidence: number[] = [];

    for (const ocrResult of job.results.ocrResults) {
      if (!ocrResult.success) continue;

      try {
        const matchResult = matcherService.matchWithExcel(
          ocrResult.extractedData,
          excelData,
          matchConfig
        );

        if (matchResult) {
          const validation = matcherService.validateMatch(matchResult);

          job.results.matchResults.push({
            ocrResultId: ocrResult.ocrResultId,
            matchedData: matchResult.excelData,
            matchScore: matchResult.matchScore,
            matchedBy: matchResult.matchedBy,
            success: validation.isValid,
            warnings: validation.warnings,
          });

          job.results.summary.successfulMatches++;
          totalConfidence.push(matchResult.confidence);
        } else {
          job.results.matchResults.push({
            ocrResultId: ocrResult.ocrResultId,
            matchScore: 0,
            matchedBy: 'fuzzy',
            success: false,
            warnings: ['No match found'],
          });
          job.results.summary.failedMatches++;
        }

        processed++;
        job.progress.currentStepProgress = Math.round(
          (processed / job.results.ocrResults.length) * 100
        );
      } catch (error: any) {
        console.error(`Matching failed for ${ocrResult.ocrResultId}:`, error);
        job.results.summary.failedMatches++;
      }
    }

    // Calculate average confidence
    if (totalConfidence.length > 0) {
      job.results.summary.averageConfidence =
        totalConfidence.reduce((a, b) => a + b, 0) / totalConfidence.length;
    }

    console.log(`✅ Matching complete: ${job.results.summary.successfulMatches} matches found`);
  }

  /**
   * Step 4: Render labels
   */
  private async stepRender(job: AutomationJob): Promise<void> {
    console.log(`🎨 Step 4/4: Generating labels...`);
    job.status = 'rendering';
    job.progress.currentStep = 'rendering';
    job.progress.currentStepProgress = 0;

    // Emit WebSocket event: Job Updated (Step Started)
    try {
      const wsServer = getWebSocketServer();
      wsServer.emitJobUpdated(job.id, {
        status: job.status,
        progress: 90, // 90% (step 4 of 4)
        currentStage: 'rendering',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // WebSocket not initialized, ignore
    }

    // Load template
    const template = await templateEngine.loadTemplate(job.config.templateId);
    if (!template) {
      throw new Error(`Template ${job.config.templateId} not found`);
    }

    // Create labels directory
    const labelsDir = path.join(process.cwd(), 'labels', job.id);
    await fs.mkdir(labelsDir, { recursive: true });

    let processed = 0;

    // Combine OCR and matched data
    const dataToRender = job.results.ocrResults.map((ocrResult, _index) => {
      const matchResult = job.results.matchResults.find(
        (m) => m.ocrResultId === ocrResult.ocrResultId
      );

      return {
        ...ocrResult.extractedData,
        ...(matchResult?.matchedData || {}),
        _ocrConfidence: ocrResult.confidence,
        _matchScore: matchResult?.matchScore || 0,
      };
    });

    for (let i = 0; i < dataToRender.length; i++) {
      const data = dataToRender[i];

      try {
        const renderResult = await templateEngine.render({
          template,
          data,
          options: job.config.renderConfig,
        });

        if (renderResult.success) {
          const labelPath = path.join(labelsDir, `label-${i + 1}.${renderResult.format}`);
          const labelId = uuidv4();

          // Save label
          if (renderResult.buffer) {
            await fs.writeFile(labelPath, renderResult.buffer);
          }

          job.results.labels.push({
            id: labelId,
            productData: data,
            labelPath,
            labelBase64: renderResult.base64,
            renderTime: renderResult.renderTime,
            success: true,
          });

          job.results.summary.labelsGenerated++;

          // Emit WebSocket event: Label Generated
          try {
            const wsServer = getWebSocketServer();
            wsServer.emitLabelGenerated(job.id, {
              labelId,
              imageUrl: renderResult.base64 || labelPath,
              articleNumber: data.articleNumber || '',
            });
          } catch (err) {
            // WebSocket not initialized, ignore
          }
        } else {
          job.results.labels.push({
            id: uuidv4(),
            productData: data,
            labelPath: '',
            renderTime: renderResult.renderTime,
            success: false,
            error: renderResult.error,
          });
        }

        processed++;
        job.progress.currentStepProgress = Math.round((processed / dataToRender.length) * 100);
        job.progress.labelsGenerated = job.results.summary.labelsGenerated;
      } catch (error: any) {
        console.error(`Failed to render label ${i + 1}:`, error);
        job.progress.errors.push(`Label rendering failed: ${error.message}`);
      }
    }

    console.log(`✅ Rendering complete: ${job.results.summary.labelsGenerated} labels generated`);
  }

  /**
   * Get job status
   */
  getJob(jobId: string): AutomationJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): AutomationJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'completed' || job.status === 'failed') {
      return false; // Already finished
    }

    job.status = 'failed';
    job.error = 'Job cancelled by user';
    job.updatedAt = new Date();

    // Stop crawler if running
    if (job.results.crawlJobId) {
      webCrawlerService.stopJob(job.results.crawlJobId);
    }

    console.log(`🛑 Job ${jobId} cancelled`);
    return true;
  }

  /**
   * Delete job and cleanup files
   */
  async deleteJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Delete labels directory
    const labelsDir = path.join(process.cwd(), 'labels', jobId);
    try {
      await fs.rm(labelsDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to delete labels directory:`, error);
    }

    // Delete from memory
    this.jobs.delete(jobId);

    console.log(`🗑️  Job ${jobId} deleted`);
    return true;
  }
}

// Export singleton instance
export const automationService = new AutomationService();
