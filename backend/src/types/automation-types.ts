/**
 * Automation Type Definitions
 * For end-to-end label generation workflow
 */

export interface AutomationJob {
  id: string;
  name: string;
  status: 'pending' | 'crawling' | 'processing-ocr' | 'matching' | 'rendering' | 'completed' | 'failed';
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
  excelData?: any[]; // Optional Excel data for matching
  templateId: string;
  name?: string; // Optional job name

  // Crawler settings
  crawlerConfig?: {
    maxProducts?: number;
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
  extractedData: any;
  confidence: number;
  success: boolean;
  error?: string;
}

export interface MatchProcessResult {
  ocrResultId: string;
  matchedData?: any;
  matchScore: number;
  matchedBy: 'articleNumber' | 'ean' | 'productName' | 'fuzzy';
  success: boolean;
  warnings: string[];
}

export interface GeneratedLabel {
  id: string;
  productData: any;
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
