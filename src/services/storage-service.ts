import fs from 'fs-extra';
import path from 'path';
import md5 from 'md5';
import config from '../config';
import { createLogger } from '../utils/logger';
import { StorageOptions, ScreenshotMetadata } from '../types';
import { generateDateBasedFilepath } from '../utils/file-naming';

const logger = createLogger('StorageService');

/**
 * Storage Service
 * Handles saving screenshots to local filesystem and optionally cloud storage
 */
export class StorageService {
  constructor() {
    this.ensureDirectoriesExist();
  }

  /**
   * Ensure all required directories exist
   */
  private async ensureDirectoriesExist(): Promise<void> {
    const dirs = [
      config.storage.localPath,
      path.join(config.storage.localPath, 'by-category'),
      path.join(config.storage.localPath, 'by-date'),
      path.join(config.storage.localPath, 'by-status'),
      path.join(config.storage.localPath, 'by-status', 'pending'),
      path.join(config.storage.localPath, 'by-status', 'approved'),
      path.join(config.storage.localPath, 'by-status', 'failed'),
    ];

    for (const dir of dirs) {
      await fs.ensureDir(dir);
    }

    logger.debug('Storage directories ensured');
  }

  /**
   * Save screenshot to local storage
   */
  async saveScreenshot(options: StorageOptions): Promise<{
    filepath: string;
    fileSize: number;
    contentHash: string;
  }> {
    const { filepath, buffer, metadata } = options;

    // Ensure directory exists
    const directory = path.dirname(filepath);
    await fs.ensureDir(directory);

    // Calculate content hash
    const contentHash = md5(buffer);

    // Write file
    await fs.writeFile(filepath, buffer);

    // Get file size
    const stats = await fs.stat(filepath);
    const fileSize = stats.size;

    logger.info('Screenshot saved', {
      filepath,
      fileSize,
      contentHash,
    });

    // Save metadata if provided
    if (metadata) {
      await this.saveMetadata(filepath, {
        ...metadata,
        fileSize,
        contentHash,
      });
    }

    // Create symlinks for organization (by-date and by-status)
    await this.createSymlinks(filepath, metadata);

    return {
      filepath,
      fileSize,
      contentHash,
    };
  }

  /**
   * Save metadata as JSON file alongside screenshot
   */
  private async saveMetadata(
    screenshotPath: string,
    metadata: ScreenshotMetadata
  ): Promise<void> {
    const metadataPath = screenshotPath.replace(/\.(png|jpg|jpeg|webp)$/i, '.json');

    await fs.writeJSON(metadataPath, metadata, { spaces: 2 });

    logger.debug('Metadata saved', { metadataPath });
  }

  /**
   * Create organizational symlinks
   */
  private async createSymlinks(
    filepath: string,
    metadata?: ScreenshotMetadata
  ): Promise<void> {
    try {
      const filename = path.basename(filepath);

      // Create by-date symlink
      const dateBasedPath = generateDateBasedFilepath(filename, metadata?.captureTimestamp);
      await fs.ensureDir(path.dirname(dateBasedPath));

      // On Windows, use copy instead of symlink (symlinks require admin rights)
      if (process.platform === 'win32') {
        await fs.copy(filepath, dateBasedPath, { overwrite: true });
      } else {
        await fs.symlink(filepath, dateBasedPath).catch(() => {
          // Ignore if symlink already exists
        });
      }

      logger.debug('Organization structure created', { dateBasedPath });
    } catch (err) {
      logger.warn('Failed to create symlinks', { error: err });
    }
  }

  /**
   * Check if screenshot already exists by content hash
   */
  async findByContentHash(contentHash: string): Promise<string | null> {
    if (!config.cache.enabled || !config.cache.contentHash) {
      return null;
    }

    // Search in base directory
    const files = await this.getAllScreenshots();

    for (const file of files) {
      const metadataPath = file.replace(/\.(png|jpg|jpeg|webp)$/i, '.json');

      try {
        if (await fs.pathExists(metadataPath)) {
          const metadata: ScreenshotMetadata = await fs.readJSON(metadataPath);
          if (metadata.contentHash === contentHash) {
            logger.debug('Found existing screenshot by content hash', { filepath: file });
            return file;
          }
        }
      } catch (err) {
        // Skip invalid metadata files
        continue;
      }
    }

    return null;
  }

  /**
   * Get all screenshots from storage
   */
  async getAllScreenshots(): Promise<string[]> {
    const files: string[] = [];
    const baseDir = config.storage.localPath;

    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
          files.push(fullPath);
        }
      }
    };

    await walk(baseDir);
    return files;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    categories: Record<string, number>;
  }> {
    const files = await this.getAllScreenshots();
    let totalSize = 0;
    const categories: Record<string, number> = {};

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        totalSize += stats.size;

        // Extract category from path
        const match = file.match(/by-category[/\\]([^/\\]+)/);
        if (match) {
          const category = match[1];
          categories[category] = (categories[category] || 0) + 1;
        }
      } catch (err) {
        // Skip files that can't be stat'd
        continue;
      }
    }

    return {
      totalFiles: files.length,
      totalSize,
      categories,
    };
  }

  /**
   * Delete screenshot and its metadata
   */
  async deleteScreenshot(filepath: string): Promise<void> {
    // Delete screenshot
    await fs.remove(filepath);

    // Delete metadata
    const metadataPath = filepath.replace(/\.(png|jpg|jpeg|webp)$/i, '.json');
    if (await fs.pathExists(metadataPath)) {
      await fs.remove(metadataPath);
    }

    logger.info('Screenshot deleted', { filepath });
  }

  /**
   * Clean up old screenshots
   */
  async cleanup(olderThanDays: number): Promise<number> {
    const files = await this.getAllScreenshots();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedCount = 0;

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        if (stats.mtime < cutoffDate) {
          await this.deleteScreenshot(file);
          deletedCount++;
        }
      } catch (err) {
        logger.warn('Error during cleanup', { file, error: err });
      }
    }

    logger.info('Cleanup completed', { deletedCount, olderThanDays });
    return deletedCount;
  }
}

// Singleton instance
let storageService: StorageService | null = null;

/**
 * Get storage service singleton
 */
export function getStorageService(): StorageService {
  if (!storageService) {
    storageService = new StorageService();
  }
  return storageService;
}

export default StorageService;
