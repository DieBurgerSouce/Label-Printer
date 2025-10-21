/**
 * Type definitions for the Label Management System
 */

// ============================================================================
// Price Information
// ============================================================================

export interface StaffelPreis {
  quantity: number;
  price: number;
  unit?: string;
}

export interface PriceInfo {
  price: number;
  currency: string;
  unit?: string;
  staffelpreise?: StaffelPreis[];
  vat?: number;
  priceType?: 'gross' | 'net';
}

// ============================================================================
// Product Description (from Excel)
// ============================================================================

export interface ProductDescription {
  articleNumber: string;
  description: string;
  additionalInfo?: string;
  category?: string;
  customFields?: Record<string, string>;
}

export interface ExcelParseResult {
  products: Map<string, ProductDescription>;
  totalRows: number;
  errors: string[];
  warnings?: string[];
}

// ============================================================================
// Label Types
// ============================================================================

export type LabelTemplateType = 'minimal' | 'standard' | 'extended' | 'custom';
export type LabelSource = 'screenshot' | 'manual' | 'import' | 'generated';

export interface LabelMetadata {
  id: string;
  articleNumber: string;
  createdAt: Date;
  updatedAt: Date;
  source: LabelSource;
  tags?: string[];
  category?: string;
  version?: number;
}

export interface LabelContent {
  productName: string;
  description?: string;
  priceInfo: PriceInfo;
  imageUrl?: string;
  thumbnailUrl?: string;
  customFields?: Record<string, any>;
}

export interface PriceLabel {
  id: string;
  articleNumber: string;
  productName: string;
  description?: string;
  priceInfo: PriceInfo;
  imageData?: Buffer;
  templateType: LabelTemplateType;
  createdAt: Date;
  updatedAt?: Date;
  tags?: string[];
  metadata?: LabelMetadata;
  content?: LabelContent;
}

// ============================================================================
// Paper Formats
// ============================================================================

export type PaperFormatType = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Custom';
export type Orientation = 'portrait' | 'landscape';

export interface PaperDimensions {
  width: number;  // in mm
  height: number; // in mm
}

export const PAPER_FORMATS: Record<PaperFormatType, PaperDimensions> = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Custom: { width: 0, height: 0 }, // Will be overridden
};

export interface PaperFormat {
  type: PaperFormatType;
  width: number;
  height: number;
  orientation: Orientation;
}

// ============================================================================
// Grid Layout
// ============================================================================

export interface GridMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface GridConfig {
  columns: number;
  rows: number;
  spacing: number; // in mm
  margins: GridMargins;
  autoCalculate?: boolean;
}

// ============================================================================
// Layout Settings
// ============================================================================

export type LabelScale = 'fit' | 'fill' | 'custom' | 'original';
export type ExportFormat = 'pdf' | 'png' | 'jpeg' | 'svg';
export type ColorProfile = 'RGB' | 'CMYK' | 'Grayscale';

export interface LayoutSettings {
  showCutMarks: boolean;
  showBorders: boolean;
  labelScale: LabelScale;
  dpi: number;
  colorProfile?: ColorProfile;
  compression?: boolean;
  bleed?: number; // in mm
  rotation?: 0 | 90 | 180 | 270;
}

export interface ExportSettings {
  format: ExportFormat;
  quality?: number; // 1-100 for JPEG
  dpi: number;
  colorProfile: ColorProfile;
  embedFonts?: boolean;
  compression?: boolean;
}

// ============================================================================
// Print Layout
// ============================================================================

export interface PrintLayout {
  id: string;
  name: string;
  paperFormat: PaperFormat;
  gridLayout: GridConfig;
  labels: PriceLabel[];
  settings: LayoutSettings;
  createdAt: Date;
  updatedAt?: Date;
}

// ============================================================================
// Print Job
// ============================================================================

export type PrintJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface PrintJob {
  id: string;
  layoutId: string;
  layout?: PrintLayout;
  status: PrintJobStatus;
  format: ExportFormat;
  settings?: ExportSettings;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  resultUrl?: string;
  errorMessage?: string;
  progress?: number; // 0-100
}

// ============================================================================
// Template System
// ============================================================================

export type FieldType = 'text' | 'price' | 'image' | 'barcode' | 'qrcode' | 'description';

export interface TemplateField {
  type: FieldType;
  key: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  rotation?: number;
  conditional?: {
    field: string;
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
    value: any;
  };
}

export interface TemplateStyle {
  background?: string;
  border?: string;
  borderRadius?: number;
  padding?: number;
  shadow?: string;
  font?: string;
}

export interface LabelTemplate {
  id: string;
  name: string;
  description?: string;
  layout: {
    width: number;  // in mm
    height: number; // in mm
  };
  fields: TemplateField[];
  styles: TemplateStyle;
  preview?: string; // base64 or URL
  isDefault?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

// ============================================================================
// Storage & Cache
// ============================================================================

export interface LabelStorageOptions {
  directory: string;
  createThumbnails: boolean;
  thumbnailSize?: number;
  compression?: number; // 0-100
}

export interface CacheEntry<T> {
  key: string;
  data: T;
  expiresAt?: Date;
  createdAt: Date;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LabelFilter {
  articleNumber?: string;
  category?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  priceMin?: number;
  priceMax?: number;
  search?: string;
}

export interface CreateLabelRequest {
  articleNumber: string;
  productName: string;
  description?: string;
  priceInfo: PriceInfo;
  templateType?: LabelTemplateType;
  tags?: string[];
}

export interface UpdateLabelRequest {
  productName?: string;
  description?: string;
  priceInfo?: Partial<PriceInfo>;
  tags?: string[];
}

export interface CreateLayoutRequest {
  name: string;
  paperFormat: Partial<PaperFormat>;
  gridLayout: Partial<GridConfig>;
  labelIds: string[];
  settings?: Partial<LayoutSettings>;
}

export interface ExportRequest {
  layoutId?: string;
  labelIds?: string[];
  format: ExportFormat;
  settings?: Partial<ExportSettings>;
  paperFormat?: Partial<PaperFormat>;
  gridLayout?: Partial<GridConfig>;
}

// ============================================================================
// Error Types
// ============================================================================

export class LabelError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'LabelError';
  }
}

export class ValidationError extends LabelError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends LabelError {
  constructor(message: string, details?: any) {
    super(message, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

export class StorageError extends LabelError {
  constructor(message: string, details?: any) {
    super(message, 'STORAGE_ERROR', details);
    this.name = 'StorageError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_DPI = 300;
export const MIN_DPI = 72;
export const MAX_DPI = 600;

export const DEFAULT_GRID_SPACING = 5; // mm
export const DEFAULT_MARGINS: GridMargins = {
  top: 10,
  right: 10,
  bottom: 10,
  left: 10,
};

export const MAX_LABELS_PER_PAGE = 100;
export const MAX_BATCH_SIZE = 500;

export const SUPPORTED_IMAGE_FORMATS = ['png', 'jpeg', 'jpg', 'webp'] as const;
export const SUPPORTED_EXPORT_FORMATS: ExportFormat[] = ['pdf', 'png', 'jpeg', 'svg'];

// ============================================================================
// Type Guards
// ============================================================================

export function isPriceLabel(obj: any): obj is PriceLabel {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.articleNumber === 'string' &&
    typeof obj.productName === 'string' &&
    obj.priceInfo &&
    typeof obj.priceInfo.price === 'number'
  );
}

export function isPrintLayout(obj: any): obj is PrintLayout {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    obj.paperFormat &&
    obj.gridLayout &&
    Array.isArray(obj.labels)
  );
}

export function isValidPaperFormat(type: string): type is PaperFormatType {
  return ['A3', 'A4', 'A5', 'Letter', 'Legal', 'Custom'].includes(type);
}

export function isValidExportFormat(format: string): format is ExportFormat {
  return SUPPORTED_EXPORT_FORMATS.includes(format as ExportFormat);
}
