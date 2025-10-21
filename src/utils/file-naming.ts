import { format } from 'date-fns';
import path from 'path';
import { FileNamingOptions } from '../types';
import config from '../config';

/**
 * Generate a standardized filename for screenshots
 * Format: [ProductID]_[Category]_[YYYYMMDD]_[Version].png
 *
 * Examples:
 * - SKU12345_electronics_20250110_v01.png
 * - PROD789_clothing_20250110_v02.png
 */
export function generateFilename(options: FileNamingOptions): string {
  const parts: string[] = [];

  // Product ID (sanitized, lowercase, leading zeros)
  if (options.productId) {
    parts.push(sanitizeForFilename(options.productId));
  } else {
    parts.push('unknown');
  }

  // Category (sanitized, lowercase)
  if (options.category) {
    parts.push(sanitizeForFilename(options.category));
  }

  // Date (YYYYMMDD format)
  const date = options.date || new Date();
  parts.push(format(date, 'yyyyMMdd'));

  // Version (v01, v02, etc.)
  const version = options.version || 'v01';
  parts.push(version);

  return `${parts.join('_')}.png`;
}

/**
 * Sanitize string for use in filenames
 * - Convert to lowercase
 * - Replace spaces with underscores
 * - Remove special characters except underscore and hyphen
 * - Limit to 40 characters
 */
export function sanitizeForFilename(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '_') // spaces to underscores
    .replace(/[^a-z0-9_-]/g, '') // remove special chars
    .substring(0, 40); // limit length
}

/**
 * Extract product ID from URL
 * Handles various URL patterns:
 * - /product/123
 * - /p/abc-123
 * - /detail/prod-456
 */
export function extractProductIdFromUrl(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Common patterns
    const patterns = [
      /\/product\/([a-zA-Z0-9-_]+)/,
      /\/p\/([a-zA-Z0-9-_]+)/,
      /\/detail\/([a-zA-Z0-9-_]+)/,
      /\/([a-zA-Z0-9-_]+)\.html/,
    ];

    for (const pattern of patterns) {
      const match = pathname.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Last segment of path as fallback
    const segments = pathname.split('/').filter((s) => s.length > 0);
    if (segments.length > 0) {
      return segments[segments.length - 1];
    }
  } catch (err) {
    // Invalid URL
    return undefined;
  }

  return undefined;
}

/**
 * Generate filepath with hierarchical structure
 * /screenshots/by-category/electronics/SKU12345_electronics_20250110_v01.png
 */
export function generateFilepath(filename: string, category?: string): string {
  const baseDir = config.storage.localPath;

  if (category) {
    const categoryDir = path.join(baseDir, 'by-category', sanitizeForFilename(category));
    return path.join(categoryDir, filename);
  }

  return path.join(baseDir, filename);
}

/**
 * Generate date-based filepath
 * /screenshots/by-date/2025/01/10/filename.png
 */
export function generateDateBasedFilepath(filename: string, date: Date = new Date()): string {
  const baseDir = config.storage.localPath;
  const year = format(date, 'yyyy');
  const month = format(date, 'MM');
  const day = format(date, 'dd');

  return path.join(baseDir, 'by-date', year, month, day, filename);
}

/**
 * Generate status-based filepath
 * /screenshots/by-status/approved/filename.png
 */
export function generateStatusBasedFilepath(
  filename: string,
  status: 'pending' | 'approved' | 'failed' = 'pending'
): string {
  const baseDir = config.storage.localPath;
  return path.join(baseDir, 'by-status', status, filename);
}

/**
 * Parse filename to extract metadata
 */
export function parseFilename(filename: string): FileNamingOptions | null {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.(png|jpg|jpeg|webp)$/i, '');

  // Split by underscore
  const parts = nameWithoutExt.split('_');

  if (parts.length < 3) {
    return null; // Invalid format
  }

  return {
    productId: parts[0] !== 'unknown' ? parts[0] : undefined,
    category: parts[1] || undefined,
    date: parts[2] ? parseDateFromFilename(parts[2]) : undefined,
    version: parts[3] || undefined,
  };
}

/**
 * Parse date from filename (YYYYMMDD format)
 */
function parseDateFromFilename(dateStr: string): Date | undefined {
  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return undefined;

  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
