import { chromium, Browser, Page, BrowserContext } from 'playwright';
import config from '../config';
import { createLogger } from '../utils/logger';
import { BrowserPoolStatus } from '../types';

const logger = createLogger('BrowserManager');

interface BrowserInstance {
  browser: Browser;
  context: BrowserContext;
  inUse: boolean;
  requestCount: number;
  createdAt: Date;
  lastUsed: Date;
}

/**
 * Browser Manager with connection pooling
 */
export class BrowserManager {
  private pool: BrowserInstance[] = [];
  private isShuttingDown = false;

  constructor(
    private minInstances: number = config.browser.poolMin,
    private maxInstances: number = config.browser.poolMax,
    private recycleAfter: number = config.browser.recycleAfter
  ) {}

  /**
   * Initialize the browser pool
   */
  async initialize(): Promise<void> {
    logger.info('Initializing browser pool', {
      minInstances: this.minInstances,
      maxInstances: this.maxInstances,
    });

    // Create minimum number of browser instances
    for (let i = 0; i < this.minInstances; i++) {
      await this.createBrowserInstance();
    }

    logger.info(`Browser pool initialized with ${this.pool.length} instances`);
  }

  /**
   * Create a new browser instance
   */
  private async createBrowserInstance(): Promise<BrowserInstance> {
    logger.debug('Creating new browser instance');

    const browser = await chromium.launch({
      headless: config.browser.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    const context = await browser.newContext({
      viewport: {
        width: config.screenshot.width,
        height: config.screenshot.height,
      },
      deviceScaleFactor: config.screenshot.deviceScaleFactor,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const instance: BrowserInstance = {
      browser,
      context,
      inUse: false,
      requestCount: 0,
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    this.pool.push(instance);
    logger.debug(`Browser instance created. Pool size: ${this.pool.length}`);

    return instance;
  }

  /**
   * Acquire a browser instance from the pool
   */
  async acquire(): Promise<{ page: Page; release: () => Promise<void> }> {
    if (this.isShuttingDown) {
      throw new Error('Browser manager is shutting down');
    }

    // Find available instance
    let instance = this.pool.find((inst) => !inst.inUse);

    // Create new instance if none available and under max limit
    if (!instance && this.pool.length < this.maxInstances) {
      instance = await this.createBrowserInstance();
    }

    // Wait for available instance if at max capacity
    if (!instance) {
      logger.debug('Waiting for available browser instance');
      await this.waitForAvailableInstance();
      return this.acquire();
    }

    // Check if instance needs recycling
    if (instance.requestCount >= this.recycleAfter) {
      logger.debug('Recycling browser instance due to request count');
      await this.recycleBrowserInstance(instance);
      return this.acquire();
    }

    // Mark as in use
    instance.inUse = true;
    instance.requestCount++;
    instance.lastUsed = new Date();

    // Create new page
    const page = await instance.context.newPage();

    // Release function
    const release = async () => {
      await page.close().catch((err) => {
        logger.warn('Error closing page', { error: err });
      });
      instance!.inUse = false;
      logger.debug('Browser instance released');
    };

    logger.debug('Browser instance acquired', {
      requestCount: instance.requestCount,
      poolSize: this.pool.length,
    });

    return { page, release };
  }

  /**
   * Wait for an available browser instance
   */
  private async waitForAvailableInstance(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.pool.some((inst) => !inst.inUse)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('Timeout waiting for available browser instance');
  }

  /**
   * Recycle a browser instance
   */
  private async recycleBrowserInstance(instance: BrowserInstance): Promise<void> {
    const index = this.pool.indexOf(instance);
    if (index === -1) return;

    // Close browser
    await instance.context.close().catch((err) => {
      logger.warn('Error closing browser context', { error: err });
    });
    await instance.browser.close().catch((err) => {
      logger.warn('Error closing browser', { error: err });
    });

    // Remove from pool
    this.pool.splice(index, 1);

    logger.debug('Browser instance recycled');

    // Create new instance if below minimum
    if (this.pool.length < this.minInstances) {
      await this.createBrowserInstance();
    }
  }

  /**
   * Get pool status
   */
  getStatus(): BrowserPoolStatus {
    return {
      total: this.pool.length,
      available: this.pool.filter((inst) => !inst.inUse).length,
      inUse: this.pool.filter((inst) => inst.inUse).length,
      healthy: this.pool.filter((inst) => inst.browser.isConnected()).length,
    };
  }

  /**
   * Shutdown all browser instances
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    logger.info('Shutting down browser pool');

    // Wait for in-use instances to be released (max 30 seconds)
    const maxWait = 30000;
    const startTime = Date.now();

    while (this.pool.some((inst) => inst.inUse) && Date.now() - startTime < maxWait) {
      logger.debug('Waiting for in-use browser instances to be released');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Force close all instances
    await Promise.all(
      this.pool.map(async (instance) => {
        try {
          await instance.context.close();
          await instance.browser.close();
        } catch (err) {
          logger.warn('Error closing browser instance during shutdown', { error: err });
        }
      })
    );

    this.pool = [];
    logger.info('Browser pool shut down successfully');
  }
}

// Singleton instance
let browserManager: BrowserManager | null = null;

/**
 * Get browser manager singleton
 */
export function getBrowserManager(): BrowserManager {
  if (!browserManager) {
    browserManager = new BrowserManager();
  }
  return browserManager;
}

/**
 * Initialize browser manager
 */
export async function initializeBrowserManager(): Promise<BrowserManager> {
  const manager = getBrowserManager();
  await manager.initialize();
  return manager;
}

export default BrowserManager;
