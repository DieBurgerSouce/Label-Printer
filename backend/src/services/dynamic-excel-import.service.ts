/**
 * Dynamic Excel Import Service
 * Handles flexible Excel imports with user-defined column mappings
 * to update existing articles in the database
 */

import * as XLSX from 'xlsx';
import { prisma } from '../lib/supabase.js';
import { z } from 'zod';

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface ExcelPreviewData {
  headers: string[];
  rows: any[][];
  totalRows: number;
  columnIndices: string[];
}

export interface MatchColumnConfig {
  type: 'index' | 'header' | 'auto';
  value: string; // 'A' or 'Artikelnummer' or empty for auto
}

export interface FieldMapping {
  excelColumn: string; // Column identifier (e.g., 'B' or 'Beschreibung')
  dbField: string; // Database field name (e.g., 'description')
  type?: 'index' | 'header'; // How to identify the column
}

export interface ImportConfig {
  matchColumn: MatchColumnConfig;
  fieldMappings: FieldMapping[];
  startRow?: number; // Default: 2 (skip header row)
}

export interface ImportResult {
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

// ========================================
// VALIDATION SCHEMAS
// ========================================

const matchColumnConfigSchema = z.object({
  type: z.enum(['index', 'header', 'auto']),
  value: z.string()
});

const fieldMappingSchema = z.object({
  excelColumn: z.string(),
  dbField: z.string(),
  type: z.enum(['index', 'header']).optional()
});

const importConfigSchema = z.object({
  matchColumn: matchColumnConfigSchema,
  fieldMappings: z.array(fieldMappingSchema),
  startRow: z.number().int().positive().optional()
});

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Convert column letter to index (A=0, B=1, ...)
 */
function columnLetterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 65 + 1);
  }
  return index - 1;
}

/**
 * Convert column index to letter (0=A, 1=B, ...)
 */
function columnIndexToLetter(index: number): string {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

/**
 * Auto-detect column for article number
 */
function autoDetectArticleNumberColumn(headers: string[]): number {
  const patterns = [
    'artikelnummer',
    'article number',
    'art-nr',
    'art.nr',
    'artnr',
    'sku',
    'item number',
    'product number',
    'produktnummer'
  ];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim();
    if (patterns.some(pattern => header.includes(pattern))) {
      return i;
    }
  }

  throw new Error('Could not auto-detect article number column. Please specify manually.');
}

/**
 * Get column index from config
 */
function getColumnIndex(
  config: { excelColumn: string; type?: 'index' | 'header' },
  headers: string[]
): number {
  const type = config.type || 'index';

  if (type === 'index') {
    // Column letter (e.g., 'A', 'B', 'C')
    return columnLetterToIndex(config.excelColumn);
  } else {
    // Header name
    const index = headers.findIndex(h =>
      h.toLowerCase().trim() === config.excelColumn.toLowerCase().trim()
    );

    if (index === -1) {
      throw new Error(`Column "${config.excelColumn}" not found in headers`);
    }

    return index;
  }
}

/**
 * Convert Excel value to appropriate type for database field
 */
function convertValue(value: any, dbField: string): any {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Convert to string and trim
  const strValue = String(value).trim();

  switch (dbField) {
    case 'price':
      // Parse price (handle both . and , as decimal separator)
      const priceStr = strValue.replace(',', '.');
      const price = parseFloat(priceStr);
      return isNaN(price) ? null : price;

    case 'verified':
    case 'published':
      // Convert to boolean
      const lowerValue = strValue.toLowerCase();
      return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes' || lowerValue === 'ja';

    case 'tieredPrices':
      // Parse JSON if string
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return value;

    default:
      // Return as string
      return strValue;
  }
}

/**
 * Validate database field
 */
function isValidDbField(field: string): boolean {
  const validFields = [
    'description',
    'productName',
    'price',
    'tieredPrices',
    'tieredPricesText',
    'currency',
    'imageUrl',
    'thumbnailUrl',
    'ean',
    'category',
    'manufacturer',
    'sourceUrl',
    'ocrConfidence',
    'verified',
    'published'
  ];

  return validFields.includes(field);
}

// ========================================
// SERVICE CLASS
// ========================================

export class DynamicExcelImportService {
  /**
   * Parse Excel file and return preview data
   */
  static parseExcelPreview(buffer: Buffer): ExcelPreviewData {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert to array of arrays
    const allRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: '',
      blankrows: false
    });

    if (allRows.length === 0) {
      throw new Error('Excel file is empty');
    }

    const headers = allRows[0].map((h: any) => String(h || '').trim());
    const dataRows = allRows.slice(1, 11); // First 10 data rows for preview
    const totalRows = allRows.length - 1; // Excluding header

    // Generate column indices (A, B, C, ...)
    const columnIndices = headers.map((_, i) => columnIndexToLetter(i));

    return {
      headers,
      rows: dataRows,
      totalRows,
      columnIndices
    };
  }

  /**
   * Import Excel data with dynamic configuration
   */
  static async importExcel(buffer: Buffer, config: ImportConfig): Promise<ImportResult> {
    // Validate config
    const validatedConfig = importConfigSchema.parse(config);

    // Parse Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert to array of arrays
    const allRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: '',
      blankrows: false
    });

    if (allRows.length < 2) {
      throw new Error('Excel file must have at least a header row and one data row');
    }

    const headers = allRows[0].map((h: any) => String(h || '').trim());
    const startRow = validatedConfig.startRow || 2; // Default: row 2 (skip header)
    const dataRows = allRows.slice(startRow - 1); // Adjust for zero-based index

    // Determine match column index
    let matchColumnIndex: number;

    if (validatedConfig.matchColumn.type === 'auto') {
      matchColumnIndex = autoDetectArticleNumberColumn(headers);
    } else if (validatedConfig.matchColumn.type === 'index') {
      matchColumnIndex = columnLetterToIndex(validatedConfig.matchColumn.value);
    } else {
      // header
      matchColumnIndex = headers.findIndex(h =>
        h.toLowerCase().trim() === validatedConfig.matchColumn.value.toLowerCase().trim()
      );

      if (matchColumnIndex === -1) {
        throw new Error(`Match column "${validatedConfig.matchColumn.value}" not found in headers`);
      }
    }

    // Validate field mappings
    const mappings = validatedConfig.fieldMappings.map(mapping => {
      if (!isValidDbField(mapping.dbField)) {
        throw new Error(`Invalid database field: ${mapping.dbField}`);
      }

      const columnIndex = getColumnIndex(
        { excelColumn: mapping.excelColumn, type: mapping.type },
        headers
      );

      return {
        columnIndex,
        dbField: mapping.dbField
      };
    });

    // Process rows
    const errors: ImportResult['errors'] = [];
    const updatedArticles: any[] = [];
    let matchedArticles = 0;
    let skippedArticles = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = startRow + i;

      try {
        // Get article number
        const articleNumber = String(row[matchColumnIndex] || '').trim();

        if (!articleNumber) {
          skippedArticles++;
          errors.push({
            row: rowNumber,
            articleNumber: '',
            message: 'Article number is empty'
          });
          continue;
        }

        // Find article in database
        const article = await prisma.product.findUnique({
          where: { articleNumber }
        });

        if (!article) {
          skippedArticles++;
          continue; // Skip articles that don't exist in DB
        }

        matchedArticles++;

        // Build update data
        const updateData: any = {};
        let hasChanges = false;

        for (const mapping of mappings) {
          const value = row[mapping.columnIndex];
          const convertedValue = convertValue(value, mapping.dbField);

          // Only update if value is different
          if (convertedValue !== null && convertedValue !== article[mapping.dbField as keyof typeof article]) {
            updateData[mapping.dbField] = convertedValue;
            hasChanges = true;
          }
        }

        // Update article if there are changes
        if (hasChanges) {
          const updated = await prisma.product.update({
            where: { id: article.id },
            data: updateData
          });

          updatedArticles.push(updated);
        }

      } catch (error) {
        errors.push({
          row: rowNumber,
          articleNumber: row[matchColumnIndex] || 'N/A',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      totalRows: dataRows.length,
      matchedArticles,
      updatedArticles: updatedArticles.length,
      skippedArticles,
      errors
    };
  }

  /**
   * Validate import configuration
   */
  static validateConfig(config: ImportConfig): { valid: boolean; errors: string[] } {
    try {
      importConfigSchema.parse(config);

      const errors: string[] = [];

      // Validate field mappings
      for (const mapping of config.fieldMappings) {
        if (!isValidDbField(mapping.dbField)) {
          errors.push(`Invalid database field: ${mapping.dbField}`);
        }

        // Article number cannot be mapped (it's the match column)
        if (mapping.dbField === 'articleNumber') {
          errors.push('Article number cannot be mapped (it is used for matching)');
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Invalid configuration']
      };
    }
  }

  /**
   * Get list of valid database fields for mapping
   */
  static getValidDbFields(): Array<{ field: string; description: string; type: string }> {
    return [
      { field: 'description', description: 'Produktbeschreibung', type: 'string' },
      { field: 'productName', description: 'Produktname', type: 'string' },
      { field: 'price', description: 'Preis', type: 'number' },
      { field: 'tieredPricesText', description: 'Staffelpreise (Text)', type: 'string' },
      { field: 'currency', description: 'Währung', type: 'string' },
      { field: 'ean', description: 'EAN-Code', type: 'string' },
      { field: 'category', description: 'Kategorie', type: 'string' },
      { field: 'manufacturer', description: 'Hersteller', type: 'string' },
      { field: 'sourceUrl', description: 'Quelle-URL', type: 'string' },
      { field: 'imageUrl', description: 'Bild-URL', type: 'string' },
      { field: 'thumbnailUrl', description: 'Thumbnail-URL', type: 'string' },
      { field: 'verified', description: 'Verifiziert', type: 'boolean' },
      { field: 'published', description: 'Veröffentlicht', type: 'boolean' },
      { field: 'ocrConfidence', description: 'OCR-Konfidenz', type: 'number' }
    ];
  }
}
