/**
 * Type-Safe Interfaces for HTML & OCR Extraction
 * NO MORE 'any' types!
 */

// ===== TIERED PRICE =====
export interface TieredPrice {
  quantity: number;
  price: string; // String to preserve exact decimal formatting
}

// ===== CONFIDENCE SCORES =====
export interface FieldConfidenceScores {
  productName: number;
  description: number;
  articleNumber: number;
  price: number;
  tieredPrices: number;
}

// ===== HTML EXTRACTED DATA =====
export interface HtmlExtractedData {
  // Core product fields
  productName?: string;
  description?: string;
  articleNumber?: string;
  price?: number;
  tieredPrices?: TieredPrice[];
  tieredPricesText?: string;
  imageUrl?: string;

  // Confidence tracking
  confidence: FieldConfidenceScores;

  // Metadata
  extractionMethod: 'html';
  extractionTimestamp: Date;
  hasAllFields: boolean;
}

// ===== OCR EXTRACTED DATA =====
export interface OcrExtractedData {
  // Core product fields
  productName?: string;
  description?: string;
  articleNumber?: string;
  price?: string; // OCR returns string initially
  tieredPrices?: string; // JSON stringified
  tieredPricesText?: string;

  // Metadata
  confidence?: number; // Overall OCR confidence
  rawText?: string;
}

// ===== MERGED/HYBRID DATA =====
export interface MergedProductData {
  // Final cleaned data
  productName?: string;
  description?: string;
  articleNumber?: string;
  price?: number | string;
  tieredPrices?: TieredPrice[];
  tieredPricesText?: string;
}

// ===== VALIDATION RESULT =====
export interface FieldValidationResult {
  isValid: boolean;
  confidence: number;
  errors: string[];
  warnings: string[];
}

export interface ProductValidationResult {
  isValid: boolean;
  confidence: FieldConfidenceScores;
  overallConfidence: number;
  errors: string[];
  warnings: string[];
  fieldValidation: {
    productName: boolean;
    description: boolean;
    price: boolean;
    tieredPrices: boolean;
    articleNumber: boolean;
  };
}

// ===== HYBRID EXTRACTION RESULT =====
export type DataSource = 'html' | 'ocr' | 'html-fallback' | 'ocr-fallback' | 'none';

export interface FieldSourceTracking {
  productName: DataSource;
  description: DataSource;
  articleNumber: DataSource;
  price: DataSource;
  tieredPrices: DataSource;
}

export interface HybridExtractionResult {
  articleNumber: string;
  success: boolean;

  // Final merged data
  data: MergedProductData;

  // Source data (for debugging/comparison)
  htmlData?: HtmlExtractedData;
  ocrData: OcrExtractedData;

  // Quality metrics
  confidence: FieldConfidenceScores;
  source: FieldSourceTracking;

  // Issues
  errors: string[];
  warnings: string[];
}

// ===== HTML VALIDATION RESULT =====
export interface HtmlValidationResult {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
}
