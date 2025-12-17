/**
 * File Utilities for OCR Service
 * Path normalization and file validation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

/**
 * Validate and normalize path for Windows
 */
export function normalizePath(inputPath: string): string {
  if (!inputPath) return '';

  // Convert backslashes to forward slashes
  let normalized = inputPath.replace(/\\/g, '/');

  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');

  // Resolve to absolute path
  return path.resolve(normalized);
}

/**
 * Validate screenshot file
 */
export async function validateFile(filePath: string): Promise<boolean> {
  try {
    // Normalize path for Windows
    const normalizedPath = normalizePath(filePath);

    // Check if file exists
    if (!existsSync(normalizedPath)) {
      console.log(`    ❌ File not found: ${normalizedPath}`);
      return false;
    }

    // Check file stats
    const stats = await fs.stat(normalizedPath);

    if (stats.size === 0) {
      console.log(`    ❌ File is empty: ${normalizedPath}`);
      return false;
    }

    if (stats.size > 50 * 1024 * 1024) {
      // 50MB limit
      console.log(
        `    ⚠️ File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB): ${normalizedPath}`
      );
      return false;
    }

    return true;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`    ❌ Validation error: ${errorMsg}`);
    return false;
  }
}
