/**
 * Database Service using Supabase
 * Handles all database operations for the Label Printer system
 */

import { supabase } from '../lib/supabase.js';
import { getWebSocketServer } from '../websocket/socket-server.js';

// ============================================
// TYPES
// ============================================

export interface CrawlJob {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  targetUrl: string;
  maxProducts: number;
  productsFound: number;
  productsScraped: number;
  currentPage: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface Screenshot {
  id: string;
  crawlJobId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  fileSize: number;
  format: string;
  productUrl: string;
  productName?: string;
  createdAt: string;
}

export interface OCRResult {
  id: string;
  screenshotId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  confidence?: number;
  fullText?: string;
  articleNumber?: string;
  price?: number;
  ean?: string;
  productName?: string;
  tieredPrices?: any;
  boundingBoxes?: any;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface AutomationJob {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  config: any;
  currentStage?: string;
  totalStages: number;
  progress?: any;
  resultSummary?: any;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  templateId?: string;
}

// ============================================
// CRAWL JOBS
// ============================================

export class CrawlJobService {
  /**
   * Create a new crawl job
   */
  async create(data: Partial<CrawlJob>): Promise<CrawlJob> {
    const { data: job, error } = await supabase
      .from('crawl_jobs')
      .insert({
        id: crypto.randomUUID(),
        name: data.name || 'Untitled Job',
        status: data.status || 'pending',
        targetUrl: data.targetUrl!,
        maxProducts: data.maxProducts || 50,
        productsFound: 0,
        productsScraped: 0,
        currentPage: 1,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create crawl job: ${error.message}`);

    // Emit WebSocket event
    try {
      const wsServer = getWebSocketServer();
      wsServer.emitJobCreated({
        jobId: job.id,
        jobType: 'crawl',
        name: job.name,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // WebSocket not initialized yet, ignore
    }

    return job;
  }

  /**
   * Get crawl job by ID
   */
  async getById(id: string): Promise<CrawlJob | null> {
    const { data, error } = await supabase
      .from('crawl_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get crawl job: ${error.message}`);
    }

    return data;
  }

  /**
   * Update crawl job
   */
  async update(id: string, data: Partial<CrawlJob>): Promise<CrawlJob> {
    const { data: job, error } = await supabase
      .from('crawl_jobs')
      .update({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update crawl job: ${error.message}`);

    // Emit WebSocket event
    try {
      const wsServer = getWebSocketServer();
      wsServer.emitJobUpdated(id, {
        status: job.status,
        timestamp: new Date().toISOString(),
      });

      // Emit completion/failure events
      if (job.status === 'completed') {
        wsServer.emitJobCompleted(id, {
          results: job,
          duration: job.completedAt
            ? new Date(job.completedAt).getTime() - new Date(job.startedAt || job.createdAt).getTime()
            : 0,
        });
      } else if (job.status === 'failed') {
        wsServer.emitJobFailed(id, {
          error: job.error || 'Unknown error',
        });
      }
    } catch (err) {
      // WebSocket not initialized, ignore
    }

    return job;
  }

  /**
   * List all crawl jobs
   */
  async list(filters?: { status?: string; limit?: number }): Promise<CrawlJob[]> {
    let query = supabase.from('crawl_jobs').select('*').order('createdAt', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to list crawl jobs: ${error.message}`);
    return data || [];
  }

  /**
   * Delete crawl job
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('crawl_jobs').delete().eq('id', id);

    if (error) throw new Error(`Failed to delete crawl job: ${error.message}`);
  }
}

// ============================================
// SCREENSHOTS
// ============================================

export class ScreenshotService {
  /**
   * Create a new screenshot
   */
  async create(data: Partial<Screenshot>): Promise<Screenshot> {
    const { data: screenshot, error } = await supabase
      .from('screenshots')
      .insert({
        id: crypto.randomUUID(),
        crawlJobId: data.crawlJobId!,
        imageUrl: data.imageUrl!,
        thumbnailUrl: data.thumbnailUrl,
        width: data.width!,
        height: data.height!,
        fileSize: data.fileSize!,
        format: data.format!,
        productUrl: data.productUrl!,
        productName: data.productName,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create screenshot: ${error.message}`);

    // Emit WebSocket event
    try {
      const wsServer = getWebSocketServer();
      wsServer.emitScreenshotCaptured(data.crawlJobId!, {
        screenshotId: screenshot.id,
        url: screenshot.imageUrl,
        thumbnailUrl: screenshot.thumbnailUrl,
        productUrl: screenshot.productUrl,
        productName: screenshot.productName,
      });
    } catch (err) {
      // WebSocket not initialized, ignore
    }

    return screenshot;
  }

  /**
   * Get screenshots by crawl job ID
   */
  async getByJobId(crawlJobId: string): Promise<Screenshot[]> {
    const { data, error } = await supabase
      .from('screenshots')
      .select('*')
      .eq('crawlJobId', crawlJobId)
      .order('createdAt', { ascending: false });

    if (error) throw new Error(`Failed to get screenshots: ${error.message}`);
    return data || [];
  }

  /**
   * Get screenshot by ID
   */
  async getById(id: string): Promise<Screenshot | null> {
    const { data, error } = await supabase
      .from('screenshots')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get screenshot: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete screenshot
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('screenshots').delete().eq('id', id);

    if (error) throw new Error(`Failed to delete screenshot: ${error.message}`);
  }
}

// ============================================
// OCR RESULTS
// ============================================

export class OCRResultService {
  /**
   * Create a new OCR result
   */
  async create(data: Partial<OCRResult>): Promise<OCRResult> {
    const { data: result, error } = await supabase
      .from('ocr_results')
      .insert({
        id: crypto.randomUUID(),
        screenshotId: data.screenshotId!,
        status: data.status || 'pending',
        confidence: data.confidence,
        fullText: data.fullText,
        articleNumber: data.articleNumber,
        price: data.price,
        ean: data.ean,
        productName: data.productName,
        tieredPrices: data.tieredPrices,
        boundingBoxes: data.boundingBoxes,
        error: data.error,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create OCR result: ${error.message}`);

    // Get screenshot to find job ID
    const screenshot = await this.getScreenshotById(data.screenshotId!);

    // Emit WebSocket event
    try {
      const wsServer = getWebSocketServer();

      if (result.status === 'completed') {
        wsServer.emitOCRCompleted(screenshot?.crawlJobId || '', {
          screenshotId: result.screenshotId,
          ocrResultId: result.id,
          data: {
            articleNumber: result.articleNumber,
            price: result.price,
            productName: result.productName,
            confidence: result.confidence || 0,
          },
        });
      } else if (result.status === 'failed') {
        wsServer.emitOCRFailed(screenshot?.crawlJobId || '', {
          screenshotId: result.screenshotId,
          error: result.error || 'OCR processing failed',
        });
      }
    } catch (err) {
      // WebSocket not initialized, ignore
    }

    return result;
  }

  private async getScreenshotById(id: string) {
    const { data } = await supabase.from('screenshots').select('*').eq('id', id).single();
    return data;
  }

  /**
   * Update OCR result
   */
  async update(id: string, data: Partial<OCRResult>): Promise<OCRResult> {
    const { data: result, error } = await supabase
      .from('ocr_results')
      .update({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update OCR result: ${error.message}`);
    return result;
  }

  /**
   * Get OCR result by screenshot ID
   */
  async getByScreenshotId(screenshotId: string): Promise<OCRResult | null> {
    const { data, error } = await supabase
      .from('ocr_results')
      .select('*')
      .eq('screenshotId', screenshotId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get OCR result: ${error.message}`);
    }

    return data;
  }
}

// ============================================
// AUTOMATION JOBS
// ============================================

export class AutomationJobService {
  /**
   * Create a new automation job
   */
  async create(data: Partial<AutomationJob>): Promise<AutomationJob> {
    const { data: job, error } = await supabase
      .from('automation_jobs')
      .insert({
        id: crypto.randomUUID(),
        name: data.name || 'Untitled Automation',
        status: data.status || 'pending',
        config: data.config || {},
        currentStage: data.currentStage,
        totalStages: data.totalStages || 4,
        progress: data.progress,
        templateId: data.templateId,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create automation job: ${error.message}`);
    return job;
  }

  /**
   * Get automation job by ID
   */
  async getById(id: string): Promise<AutomationJob | null> {
    const { data, error } = await supabase
      .from('automation_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get automation job: ${error.message}`);
    }

    return data;
  }

  /**
   * Update automation job
   */
  async update(id: string, data: Partial<AutomationJob>): Promise<AutomationJob> {
    const { data: job, error } = await supabase
      .from('automation_jobs')
      .update({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update automation job: ${error.message}`);
    return job;
  }

  /**
   * List all automation jobs
   */
  async list(filters?: { status?: string; limit?: number }): Promise<AutomationJob[]> {
    let query = supabase
      .from('automation_jobs')
      .select('*')
      .order('createdAt', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to list automation jobs: ${error.message}`);
    return data || [];
  }
}

// ============================================
// EXPORT SERVICES
// ============================================

export const crawlJobService = new CrawlJobService();
export const screenshotService = new ScreenshotService();
export const ocrResultService = new OCRResultService();
export const automationJobService = new AutomationJobService();
