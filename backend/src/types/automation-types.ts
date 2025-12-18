/**
 * Automation Type Definitions
 * For end-to-end label generation workflow
 */

/**
 * Excel row data structure for matching
 * Uses Record type to allow any column names from Excel
 */
export type ExcelRowData = Record<string, unknown>;

/**
 * Matched product data from Excel or database
 */
export interface MatchedProductData {
  articleNumber?: string;
  productName?: string;
  description?: string;
  price?: number | string;
  ean?: string;
  category?: string;
  manufacturer?: string;
  imageUrl?: string;
  source?: 'excel' | 'database' | 'ocr';
}

/**
 * Product data for label rendering
 * All fields optional during construction, required fields validated at render time
 */
export interface LabelProductData {
  articleNumber?: string;
  productName?: string;
  description?: string;
  price?: number | string;
  priceType?: string; // 'normal' | 'tiered' | 'auf_anfrage' | 'unknown' or custom
  tieredPrices?: Array<{ quantity: number; price: number | string }>;
  tieredPricesText?: string;
  ean?: string;
  category?: string;
  manufacturer?: string;
  imageUrl?: string;
}

export interface AutomationJob {
  id: string;
  name: string;
  status:
    | 'pending'
    | 'crawling'
    | 'processing-ocr'
    | 'matching'
    | 'rendering'
    | 'completed'
    | 'failed';
  config: AutomationConfig;
  progress: AutomationProgress;
  results: AutomationResults;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface AutomationConfig {
  // Input
  shopUrl: string;
  excelData?: ExcelRowData[]; // Optional Excel data for matching
  templateId: string;
  name?: string; // Optional job name

  // Max products (shorthand for crawlerConfig.maxProducts)
  maxProducts?: number;

  // Crawler settings
  crawlerConfig?: {
    maxProducts?: number;
    fullShopScan?: boolean;
    followPagination?: boolean;
    screenshotQuality?: number;
  };

  // OCR settings
  ocrConfig?: {
    language?: string | string[];
    preprocessImage?: boolean;
    extractFields?: string[]; // Fields to extract (articleNumber, price, etc.)
  };

  // Matcher settings
  matcherConfig?: {
    threshold?: number;
    autoAcceptHighConfidence?: boolean; // Auto-accept matches > 90%
  };

  // Render settings
  renderConfig?: {
    format?: 'png' | 'pdf' | 'svg' | 'jpg';
    quality?: number;
  };
}

export interface AutomationProgress {
  currentStep: 'crawling' | 'ocr' | 'matching' | 'rendering' | 'completed';
  totalSteps: number;
  currentStepProgress: number; // 0-100
  productsFound: number;
  productsProcessed: number;
  labelsGenerated: number;
  errors: string[];
}

export interface AutomationResults {
  crawlJobId?: string;
  screenshots: ScreenshotResult[];
  ocrResults: OCRProcessResult[];
  matchResults: MatchProcessResult[];
  labels: GeneratedLabel[];
  summary: AutomationSummary;
}

export interface ScreenshotResult {
  productUrl: string;
  screenshotPath: string;
  thumbnailPath?: string;
}

export interface OCRProcessResult {
  screenshotId: string;
  ocrResultId: string;
  extractedData: {
    articleNumber?: string;
    productName?: string;
    description?: string;
    price?: string | number;
    priceType?: string;
    tieredPrices?: Array<{ quantity: number; price: string | number }>;
    tieredPricesText?: string;
  };
  confidence: number;
  success: boolean;
  status?: 'completed' | 'failed' | 'pending' | 'processing';
  error?: string;
  productUrl?: string | null;
  screenshotPath?: string;
  // Top-level convenience fields (mirrored from extractedData)
  articleNumber?: string;
  productName?: string;
  price?: string | number;
  priceType?: string;
  tieredPrices?: Array<{ quantity: number; price: string | number }>;
  tieredPricesText?: string;
  fullText?: string;
}

export interface MatchProcessResult {
  ocrResultId: string;
  matchedData?: MatchedProductData;
  matchScore: number;
  matchedBy: 'articleNumber' | 'ean' | 'productName' | 'fuzzy';
  success: boolean;
  warnings: string[];
}

export interface GeneratedLabel {
  id: string;
  productData: LabelProductData;
  labelPath: string;
  labelBase64?: string;
  renderTime: number;
  success: boolean;
  error?: string;
}

export interface AutomationSummary {
  totalProducts: number;
  successfulOCR: number;
  failedOCR: number;
  successfulMatches: number;
  failedMatches: number;
  labelsGenerated: number;
  averageConfidence: number;
  totalProcessingTime: number;
}

export interface WorkflowStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  progress?: number;
  error?: string;
}
