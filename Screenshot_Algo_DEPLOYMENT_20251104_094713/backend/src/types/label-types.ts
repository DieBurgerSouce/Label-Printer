/**
 * Type Definitions for Label Printer Backend
 */

export interface PriceInfo {
  price: number;
  currency: string;
  unit?: string;
  staffelpreise?: Array<{
    quantity: number;
    price: number;
  }>;
}

export interface PriceLabel {
  id: string;
  articleNumber: string;
  productName: string;
  description?: string;
  priceInfo: PriceInfo;
  imageData?: Buffer;
  imageUrl?: string;
  templateType: 'minimal' | 'standard' | 'extended' | 'custom';
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  category?: string;
  source: 'screenshot' | 'manual' | 'import';
}

export interface LabelMetadata {
  id: string;
  articleNumber: string;
  createdAt: Date;
  updatedAt: Date;
  source: 'screenshot' | 'manual' | 'import';
  tags: string[];
  category?: string;
}

export interface LabelContent {
  productName: string;
  description?: string;
  priceInfo: PriceInfo;
  imageUrl?: string;
  customFields?: Record<string, any>;
}

export interface ProductDescription {
  articleNumber: string;
  description: string;
  additionalInfo?: string;
  customFields?: Record<string, string>;
}

export interface PrintLayout {
  id: string;
  name: string;
  paperFormat: {
    type: 'A3' | 'A4' | 'A5' | 'Letter' | 'Custom';
    width: number;  // in mm
    height: number; // in mm
    orientation: 'portrait' | 'landscape';
  };
  gridLayout: {
    columns: number;
    rows: number;
    spacing: number;    // in mm
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  labels: string[]; // Label IDs
  settings: {
    showCutMarks: boolean;
    showBorders: boolean;
    labelScale: 'fit' | 'fill' | 'custom';
    dpi: number;
  };
}

export interface PrintJob {
  id: string;
  layoutId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'pdf' | 'png' | 'jpeg';
  createdAt: Date;
  completedAt?: Date;
  resultUrl?: string;
  error?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  type: 'minimal' | 'standard' | 'extended' | 'custom';
  preview?: string;
  isDefault?: boolean;
  settings: {
    fontSize: number;
    fontFamily: string;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    padding: number;
  };
  fields?: Array<{
    key: string;
    type: string;
    x: number;
    y: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExcelParseResult {
  products: ProductDescription[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  category?: string;
  tags?: string[];
  source?: 'screenshot' | 'manual' | 'import';
  dateFrom?: Date;
  dateTo?: Date;
}
