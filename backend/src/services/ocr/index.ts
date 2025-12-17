/**
 * OCR Services Module
 * Re-exports all OCR-related functionality
 */

// File utilities
export { normalizePath, validateFile } from './file-utils';

// Text utilities
export {
  extractPrice,
  fixOCRNumberErrors,
  parseTieredPrices,
  cleanOcrText,
  getArticleNumberFromText,
  parsePrice,
} from './text-utils';
