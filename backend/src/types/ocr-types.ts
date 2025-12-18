/**
 * Type definitions for OCR Service
 */

export interface OCRResult {
  id: string;
  screenshotId: string;
  jobId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extractedData: ExtractedData;
  confidence: ConfidenceScores;
  rawText: string;
  boundingBoxes: BoundingBox[];
  processingTime: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedData {
  articleNumber?: string;
  price?: string;
  productName?: string;
  description?: string;
  tieredPrices?: TieredPrice[];
  ean?: string;
  specifications?: Record<string, string>;
  custom?: Record<string, any>;
}

export interface TieredPrice {
  quantity: number;
  price: string;
  unit?: string;
}

export interface ConfidenceScores {
  overall: number;
  articleNumber?: number;
  price?: number;
  productName?: number;
  description?: number;
}

export interface BoundingBox {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fieldType?: 'articleNumber' | 'price' | 'productName' | 'description' | 'tieredPrice' | 'unknown';
}

export interface OCRConfig {
  language: string | string[];
  tesseractOptions?: {
    tessedit_char_whitelist?: string;
    tessedit_pageseg_mode?: number;
    preserve_interword_spaces?: string;
  };
  preprocessImage?: boolean;
  enhanceContrast?: boolean;
  removeNoise?: boolean;
  deskew?: boolean;
  regions?: OCRRegion[];
}

export interface OCRRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fieldType: string;
  pattern?: RegExp;
}

export interface MatchResult {
  ocrData: ExtractedData;
  excelData: any;
  matchScore: number;
  matchedBy: 'articleNumber' | 'ean' | 'productName' | 'fuzzy';
  confidence: number;
}

export interface FuzzyMatchConfig {
  threshold: number;
  keys: string[];
  includeScore: boolean;
  minMatchCharLength: number;
}

// Default OCR configuration
export const DEFAULT_OCR_CONFIG: OCRConfig = {
  language: ['deu', 'eng'],
  tesseractOptions: {
    tessedit_pageseg_mode: 1, // Automatic page segmentation with OSD
    preserve_interword_spaces: '1',
  },
  preprocessImage: true,
  enhanceContrast: true,
  removeNoise: true,
  deskew: true,
};

// Pattern matchers for common fields
export const FIELD_PATTERNS = {
  articleNumber: [
    /Art\.?\s*Nr\.?:?\s*([A-Z0-9-]+)/i,
    /Artikel\.?:?\s*([A-Z0-9-]+)/i,
    /Item\s*#:?\s*([A-Z0-9-]+)/i,
    /SKU:?\s*([A-Z0-9-]+)/i,
    /\b([A-Z]{2,}\d{4,})\b/,
    /\b(\d{6,})\b/,
  ],
  price: [
    /(\d+[,.]\d{2})\s*€/,
    /€\s*(\d+[,.]\d{2})/,
    /EUR\s*(\d+[,.]\d{2})/,
    /(\d+[,.]\d{2})\s*EUR/,
    /Preis:?\s*(\d+[,.]\d{2})/i,
  ],
  tieredPrice: [
    /ab\s+(\d+)\s+(?:St(?:ü|ue?)ck|Stk\.?|St\.?):?\s*(\d+[,.]\d{2})/gi,
    /bis\s+(\d+)\s+(?:St(?:ü|ue?)ck|Stk\.?|St\.?)?:?\s*(\d+[,.]\d{2})/gi,
    /(\d+)\+:?\s*(\d+[,.]\d{2})/g,
    /Staffel:?\s*(\d+)\s*-\s*(\d+[,.]\d{2})/gi,
    /(ab|bis)\s+(\d+)\s*:?\s*(\d+[,.]\d{2})\s*€/gi,
  ],
  ean: [/EAN:?\s*(\d{13})/i, /GTIN:?\s*(\d{13})/i, /\b(\d{13})\b/],
};

// Preprocessing settings for Sharp
export interface ImagePreprocessingOptions {
  sharpen?: boolean;
  normalize?: boolean;
  threshold?: number;
  grayscale?: boolean;
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
}

export const DEFAULT_PREPROCESSING: ImagePreprocessingOptions = {
  sharpen: true,
  normalize: true,
  grayscale: true,
  threshold: 180, // More aggressive thresholding for cleaner text
  resize: {
    width: 2000, // Upscale small images for better OCR
    fit: 'inside',
  },
};
