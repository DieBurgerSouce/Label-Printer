/**
 * Improved OCR Service with better error handling
 */

import { promises as fs } from 'fs';
import path from 'path';

export class OCRServiceImproved {
  /**
   * Validate and process a screenshot file
   */
  async validateAndProcessFile(filePath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check if file exists
      await fs.access(filePath);

      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        return { valid: false, error: `File is empty: ${filePath}` };
      }

      // Check if it's a valid image file
      const ext = path.extname(filePath).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
        return { valid: false, error: `Invalid file extension: ${ext}` };
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: `File access error: ${error.message}` };
    }
  }

  /**
   * Safe path resolution for Windows
   */
  normalizePath(inputPath: string): string {
    // Convert backslashes to forward slashes
    let normalized = inputPath.replace(/\\/g, '/');

    // Remove any empty path segments
    normalized = normalized.replace(/\/+/g, '/');

    // Resolve to absolute path
    return path.resolve(normalized);
  }

  /**
   * Check for missing screenshots
   */
  async checkMissingScreenshots(jobId: string): Promise<{ missing: string[]; found: string[] }> {
    const missing: string[] = [];
    const found: string[] = [];

    const screenshotDir = path.join(process.cwd(), 'data/screenshots', jobId);

    try {
      const articles = await fs.readdir(screenshotDir);

      for (const article of articles) {
        const articleDir = path.join(screenshotDir, article);
        const stats = await fs.stat(articleDir);

        if (stats.isDirectory()) {
          const expectedFiles = [
            'article-number.png',
            'title.png',
            'description.png',
            'price.png',
            'price-table.png',
            'product-image.png',
          ];

          for (const file of expectedFiles) {
            const filePath = path.join(articleDir, file);
            try {
              await fs.access(filePath);
              const fileStats = await fs.stat(filePath);
              if (fileStats.size > 0) {
                found.push(`${article}/${file}`);
              } else {
                missing.push(`${article}/${file} (empty)`);
              }
            } catch {
              missing.push(`${article}/${file}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking screenshots:', error);
    }

    return { missing, found };
  }
}

export const ocrServiceImproved = new OCRServiceImproved();
