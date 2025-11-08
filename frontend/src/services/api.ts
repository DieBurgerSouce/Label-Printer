import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { PrintLayout } from '../store/printStore';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

/**
 * Helper function to get full image URL
 */
export function getImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) {
    // Return a small gray placeholder as base64 data URL (1x1 gray pixel)
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mM8cPj4fwAHqQN8stI9HQAAAABJRU5ErkJggg==';
  }

  // Check if URL is already absolute
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // For relative URLs, prepend the API base URL
  const fullUrl = `${API_BASE_URL}${imageUrl}`;
  return fullUrl;
}

/**
 * API Client for backend communication
 */
class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig) {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig) {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  async upload<T>(url: string, file: File, onProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data;
  }
}

// Singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Type definitions
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Label API
export const labelApi = {
  getAll: (params?: { page?: number; limit?: number; [key: string]: any }) =>
    apiClient.get<PaginatedResponse<any>>('/api/labels', { params }),

  getById: (id: string, includeImage = false) =>
    apiClient.get<ApiResponse<any>>(`/api/labels/${id}`, { params: { includeImage } }),

  getImage: (id: string) =>
    apiClient.get<Blob>(`/api/labels/${id}/image`, { responseType: 'blob' }),

  getThumbnail: (id: string) =>
    apiClient.get<Blob>(`/api/labels/${id}/thumbnail`, { responseType: 'blob' }),

  create: (data: any) =>
    apiClient.post<ApiResponse<any>>('/api/labels', data),

  extract: (url: string, articleNumber: string) =>
    apiClient.post<ApiResponse<any>>('/api/labels/extract', { url, articleNumber }),

  update: (id: string, data: any) =>
    apiClient.put<ApiResponse<any>>(`/api/labels/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<void>>(`/api/labels/${id}`),

  search: (query: string, limit = 20) =>
    apiClient.get<ApiResponse<any[]>>('/api/labels/search', { params: { q: query, limit } }),

  generateFromArticle: (articleId: string, templateId: string) =>
    apiClient.post<ApiResponse<any>>('/api/labels/generate-from-article', { articleId, templateId }),

  batch: (labelIds: string[], action: 'delete' | 'export') =>
    apiClient.post<ApiResponse<any>>('/api/labels/batch', { operation: action, labelIds }),

  getStats: () =>
    apiClient.get<ApiResponse<any>>('/api/labels/stats'),
};

// Excel API
export const excelApi = {
  upload: (file: File, onProgress?: (progress: number) => void) =>
    apiClient.upload<ApiResponse<any>>('/api/excel/upload', file, onProgress),

  validate: (file: File) =>
    apiClient.upload<ApiResponse<any>>('/api/excel/validate', file),

  getProducts: (params?: { category?: string; search?: string }) =>
    apiClient.get<ApiResponse<any[]>>('/api/excel/products', { params }),

  getProduct: (articleNumber: string) =>
    apiClient.get<ApiResponse<any>>(`/api/excel/product/${articleNumber}`),

  updateProduct: (articleNumber: string, data: any) =>
    apiClient.put<ApiResponse<any>>(`/api/excel/product/${articleNumber}`, data),

  addProduct: (data: any) =>
    apiClient.post<ApiResponse<any>>('/api/excel/product', data),

  deleteProduct: (articleNumber: string) =>
    apiClient.delete<ApiResponse<void>>(`/api/excel/product/${articleNumber}`),

  clearCache: () =>
    apiClient.delete<ApiResponse<void>>('/api/excel/cache'),

  getStats: () =>
    apiClient.get<ApiResponse<any>>('/api/excel/stats'),

  downloadTemplate: () =>
    apiClient.get<Blob>('/api/excel/template', { responseType: 'blob' }),

  exportExcel: () =>
    apiClient.get<Blob>('/api/excel/export', { responseType: 'blob' }),
};

// Print API
export const printApi = {
  preview: (data: any) =>
    apiClient.post<ApiResponse<any>>('/api/print/preview', data),

  export: async (data: any): Promise<Blob> => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/print/export`,
        data,
        {
          responseType: 'blob',
          headers: {
            'Accept': 'application/pdf',
            'Content-Type': 'application/json'
          }
        }
      );

      // Check if response is actually a Blob
      if (!(response.data instanceof Blob)) {
        throw new Error('Response is not a Blob');
      }

      // Check if it's an error response disguised as Blob
      if (response.data.type === 'application/json') {
        // Error responses might come as JSON Blob
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || 'PDF generation failed');
      }

      return response.data;
    } catch (error: any) {
      // Re-throw with better error message
      if (error.response?.data instanceof Blob && error.response.data.type === 'application/json') {
        const text = await error.response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || 'Failed to generate PDF');
      }
      throw error;
    }
  },

  /**
   * Export labels as PDF
   * @param layout - Print layout configuration
   * @param labelIds - Array of label IDs to export
   * @returns PDF Blob
   */
  exportPDF: async (layout: PrintLayout, labelIds: string[]): Promise<Blob> => {
    const response = await axios.post(
      `${API_BASE_URL}/api/print/export`,
      {
        layout,
        labelIds,
        format: 'pdf'
      },
      {
        responseType: 'blob',
        headers: {
          'Accept': 'application/pdf',
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  },

  getFormats: () =>
    apiClient.get<ApiResponse<any[]>>('/api/print/formats'),

  calculateGrid: (data: any) =>
    apiClient.post<ApiResponse<any>>('/api/print/calculate-grid', data),

  getTemplates: () =>
    apiClient.get<ApiResponse<any[]>>('/api/print/templates'),

  addTemplate: (template: any) =>
    apiClient.post<ApiResponse<any>>('/api/print/templates', template),

  deleteTemplate: (id: string) =>
    apiClient.delete<ApiResponse<any>>(`/api/print/templates/${id}`),

  validateLayout: (data: any) =>
    apiClient.post<ApiResponse<any>>('/api/print/validate-layout', data),
};

// Articles API (Product Management)
export interface Product {
  id: string;
  articleNumber: string;
  productName: string;
  description?: string;
  price?: number | null; // Optional when using tieredPrices
  tieredPrices?: Array<{ quantity: number; price: number }>;
  tieredPricesText?: string; // Raw OCR text for tiered prices e.g. "ab 7 Stück: 190,92 EUR\nab 24 Stück: 180,60 EUR"
  currency: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  ean?: string;
  category?: string;
  manufacturer?: string;
  sourceUrl: string;
  crawlJobId?: string;
  ocrConfidence?: number;
  verified: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ArticlesQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  verified?: boolean;
  published?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'articleNumber' | 'productName' | 'price';
  sortOrder?: 'asc' | 'desc';
}

export const articlesApi = {
  getAll: (params?: ArticlesQueryParams) =>
    apiClient.get<PaginatedResponse<Product>>('/api/articles', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Product>>(`/api/articles/${id}`),

  getStats: () =>
    apiClient.get<ApiResponse<{
      total: number;
      withImages: number;
      verified: number;
      published: number;
      categories: Array<{ name: string; count: number }>;
    }>>('/api/articles/stats'),

  create: (data: Partial<Product>) =>
    apiClient.post<ApiResponse<Product>>('/api/articles', data),

  update: (id: string, data: Partial<Product>) =>
    apiClient.put<ApiResponse<Product>>(`/api/articles/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<void>>(`/api/articles/${id}`),

  bulkDelete: (ids: string[]) =>
    apiClient.post<ApiResponse<{ deletedCount: number }>>('/api/articles/bulk-delete', { ids }),

  bulkUpdate: (ids: string[], data: Partial<Product>) =>
    apiClient.post<ApiResponse<{ updatedCount: number }>>('/api/articles/bulk-update', { ids, data }),

  export: (ids?: string[], format: 'csv' | 'json' = 'csv') =>
    format === 'json'
      ? apiClient.post<ApiResponse<Product[]>>('/api/articles/export', { ids, format })
      : apiClient.post<Blob>('/api/articles/export', { ids, format }, { responseType: 'blob' }),

  // Excel Import
  excelPreview: (file: File) =>
    apiClient.upload<ApiResponse<ExcelPreviewData>>('/api/articles/excel-preview', file),

  excelImport: (file: File, config: ExcelImportConfig) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify(config));

    return axios.post<ApiResponse<ExcelImportResult>>('/api/articles/excel-import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      baseURL: API_BASE_URL,
    }).then(res => res.data);
  },

  getValidExcelFields: () =>
    apiClient.get<ApiResponse<Array<{ field: string; description: string; type: string }>>>('/api/articles/excel-valid-fields'),
};

// Label Template API (Visual Editor - /api/label-templates)
export const templateApi = {
  save: (template: any) =>
    apiClient.post<ApiResponse<any>>('/api/label-templates', template),

  list: () =>
    apiClient.get<ApiResponse<{ templates: any[] }>>('/api/label-templates'),

  getById: (id: string) =>
    apiClient.get<ApiResponse<any>>(`/api/label-templates/${id}`),

  update: (id: string, template: any) =>
    apiClient.put<ApiResponse<any>>(`/api/label-templates/${id}`, template),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<void>>(`/api/label-templates/${id}`),
};

// Rendering Template API (Server-Side Rendering - /api/templates)
export const renderingTemplateApi = {
  create: (template: any) =>
    apiClient.post<ApiResponse<any>>('/api/templates', template),

  list: () =>
    apiClient.get<ApiResponse<{ templates: any[]; count: number }>>('/api/templates'),

  getById: (id: string) =>
    apiClient.get<ApiResponse<{ template: any }>>(`/api/templates/${id}`),

  update: (id: string, template: any) =>
    apiClient.put<ApiResponse<any>>(`/api/templates/${id}`, template),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(`/api/templates/${id}`),

  // Rendering endpoints
  renderImage: (id: string, data: any, options?: any) =>
    apiClient.post<Blob>(`/api/templates/${id}/render/image`, { data, options }, { responseType: 'blob' }),

  renderPdf: (id: string, data: any, options?: any) =>
    apiClient.post<any>(`/api/templates/${id}/render/pdf`, { data, options }),

  renderBatch: (templateId: string, dataArray: any[]) =>
    apiClient.post<any>('/api/templates/render/batch', { templateId, dataArray }),

  // Conversion endpoints
  convert: (labelTemplate: any, saveAs?: string) =>
    apiClient.post<ApiResponse<{ template: any; message: string }>>('/api/templates/convert', {
      labelTemplate,
      saveAs
    }),

  exportPdf: (id: string, articleData: any, options?: any) =>
    apiClient.post<ApiResponse<{ pdf: string; fileName: string; message: string }>>(
      `/api/templates/${id}/export-pdf`,
      { articleData, options }
    ),
};

// Excel Import Types
export interface ExcelPreviewData {
  headers: string[];
  rows: any[][];
  totalRows: number;
  columnIndices: string[];
}

export interface MatchColumnConfig {
  type: 'index' | 'header' | 'auto';
  value: string;
}

export interface FieldMapping {
  excelColumn: string;
  dbField: string;
  type?: 'index' | 'header';
}

export interface ExcelImportConfig {
  matchColumn: MatchColumnConfig;
  fieldMappings: FieldMapping[];
  startRow?: number;
}

export interface ExcelImportResult {
  totalRows: number;
  matchedArticles: number;
  updatedArticles: number;
  skippedArticles: number;
  errors: Array<{
    row: number;
    articleNumber: string;
    message: string;
  }>;
}
