import * as XLSX from 'xlsx';
import * as fs from 'fs-extra';
import path from 'path';
import { createLogger } from '../utils/logger';
import { ProductDescription, ExcelParseResult } from '../types/label-types';

const logger = createLogger('ExcelParserService');

export interface ExcelColumn {
  name: string;
  aliases: string[];
}

export const EXCEL_COLUMNS: Record<string, ExcelColumn> = {
  articleNumber: {
    name: 'articleNumber',
    aliases: [
      'Artikelnummer',
      'artikelnummer',
      'Article Number',
      'ArticleNumber',
      'Artikel-Nr',
      'Art-Nr',
      'Art.Nr.',
      'SKU',
      'sku',
      'Produktnummer',
      'Product Number',
      'Item Number',
    ],
  },
  description: {
    name: 'description',
    aliases: [
      'Beschreibung',
      'beschreibung',
      'Description',
      'description',
      'Produktbeschreibung',
      'Product Description',
      'Name',
      'name',
      'Produktname',
      'Product Name',
      'Title',
      'title',
    ],
  },
  additionalInfo: {
    name: 'additionalInfo',
    aliases: [
      'Zusatzinfo',
      'zusatzinfo',
      'Additional Info',
      'AdditionalInfo',
      'Zusatzinformation',
      'Additional Information',
      'Notes',
      'notes',
      'Notizen',
      'Hinweise',
      'Bemerkungen',
      'Comments',
    ],
  },
  category: {
    name: 'category',
    aliases: [
      'Kategorie',
      'kategorie',
      'Category',
      'category',
      'Produktkategorie',
      'Product Category',
      'Type',
      'type',
      'Typ',
    ],
  },
};

export class ExcelParserService {
  private productCache: Map<string, ProductDescription> = new Map();
  private cacheFilePath: string;
  private cacheDir: string;

  constructor(cacheDir: string = './data/product-descriptions') {
    this.cacheDir = cacheDir;
    this.cacheFilePath = path.join(cacheDir, 'product-cache.json');
    this.init();
  }

  /**
   * Initialize service and load cache
   */
  private async init(): Promise<void> {
    try {
      await fs.ensureDir(this.cacheDir);
      await this.loadCache();
    } catch (error) {
      logger.error('Failed to initialize ExcelParserService', { error });
    }
  }

  /**
   * Parse Excel file and extract product descriptions
   */
  async parseExcelFile(filePath: string): Promise<ExcelParseResult> {
    logger.info('Parsing Excel file', { filePath });

    const errors: string[] = [];
    const warnings: string[] = [];
    const products = new Map<string, ProductDescription>();

    try {
      // Check if file exists
      const fileExists = await fs.pathExists(filePath);
      if (!fileExists) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const data: any[] = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
        blankrows: false,
      });

      logger.info('Excel data loaded', { rows: data.length, sheet: sheetName });

      if (data.length === 0) {
        warnings.push('Excel file is empty or has no data rows');
        return { products, totalRows: 0, errors, warnings };
      }

      // Detect column mapping
      const columnMapping = this.detectColumnMapping(data[0]);
      logger.info('Column mapping detected', { mapping: columnMapping });

      // Validate that required columns are found
      if (!columnMapping.articleNumber) {
        errors.push('Required column "Artikelnummer" not found in Excel file');
        return { products, totalRows: data.length, errors, warnings };
      }

      if (!columnMapping.description) {
        warnings.push('Column "Beschreibung" not found, descriptions will be empty');
      }

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // +2 because Excel rows start at 1 and first row is header

        try {
          const product = this.parseRow(row, rowNumber, columnMapping);

          if (product) {
            // Check for duplicates
            if (products.has(product.articleNumber)) {
              warnings.push(
                `Row ${rowNumber}: Duplicate article number "${product.articleNumber}" - using latest version`
              );
            }
            products.set(product.articleNumber, product);
          }
        } catch (error) {
          const errorMsg = `Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.warn('Failed to parse row', { row: rowNumber, error });
        }
      }

      // Update cache
      this.productCache = products;
      await this.saveCache();

      logger.info('Excel parsing complete', {
        totalRows: data.length,
        successfulProducts: products.size,
        errors: errors.length,
        warnings: warnings.length,
      });

      return {
        products,
        totalRows: data.length,
        errors,
        warnings,
      };
    } catch (error) {
      logger.error('Failed to parse Excel file', { error });
      throw new Error(`Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect column mapping from first data row
   */
  private detectColumnMapping(firstRow: any): Record<string, string | null> {
    const mapping: Record<string, string | null> = {
      articleNumber: null,
      description: null,
      additionalInfo: null,
      category: null,
    };

    // Get all column names from the first row
    const columns = Object.keys(firstRow);

    for (const [key, config] of Object.entries(EXCEL_COLUMNS)) {
      for (const alias of config.aliases) {
        const found = columns.find((col) => col === alias || col.toLowerCase() === alias.toLowerCase());
        if (found) {
          mapping[key] = found;
          break;
        }
      }
    }

    return mapping;
  }

  /**
   * Parse a single row
   */
  private parseRow(
    row: any,
    _rowNumber: number,
    columnMapping: Record<string, string | null>
  ): ProductDescription | null {
    // Extract article number (required)
    const articleNumberCol = columnMapping.articleNumber;
    if (!articleNumberCol) {
      throw new Error('Article number column not mapped');
    }

    const articleNumber = row[articleNumberCol];
    if (!articleNumber || articleNumber === null || String(articleNumber).trim() === '') {
      throw new Error('Article number is empty');
    }

    // Extract description (optional but recommended)
    let description = '';
    const descriptionCol = columnMapping.description;
    if (descriptionCol && row[descriptionCol]) {
      description = String(row[descriptionCol]).trim();
    }

    // If no description, try to use article number as fallback
    if (!description) {
      description = `Product ${String(articleNumber).trim()}`;
    }

    // Extract additional info (optional)
    let additionalInfo: string | undefined;
    const additionalInfoCol = columnMapping.additionalInfo;
    if (additionalInfoCol && row[additionalInfoCol]) {
      additionalInfo = String(row[additionalInfoCol]).trim();
    }

    // Extract category (optional)
    let category: string | undefined;
    const categoryCol = columnMapping.category;
    if (categoryCol && row[categoryCol]) {
      category = String(row[categoryCol]).trim();
    }

    // Extract custom fields (any columns not in the known mapping)
    const customFields: Record<string, string> = {};
    const knownColumns = Object.values(columnMapping).filter((v) => v !== null);

    for (const [key, value] of Object.entries(row)) {
      if (!knownColumns.includes(key) && value !== null && value !== '') {
        customFields[key] = String(value);
      }
    }

    return {
      articleNumber: String(articleNumber).trim(),
      description,
      additionalInfo,
      category,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    };
  }

  /**
   * Get product description by article number
   */
  getProductDescription(articleNumber: string): ProductDescription | null {
    return this.productCache.get(articleNumber.trim()) || null;
  }

  /**
   * Get all cached products
   */
  getAllProducts(): ProductDescription[] {
    return Array.from(this.productCache.values());
  }

  /**
   * Get products by category
   */
  getProductsByCategory(category: string): ProductDescription[] {
    return Array.from(this.productCache.values()).filter(
      (product) => product.category?.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Search products by query
   */
  searchProducts(query: string): ProductDescription[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.productCache.values()).filter(
      (product) =>
        product.articleNumber.toLowerCase().includes(lowerQuery) ||
        product.description.toLowerCase().includes(lowerQuery) ||
        product.additionalInfo?.toLowerCase().includes(lowerQuery) ||
        product.category?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Update single product description
   */
  async updateProductDescription(articleNumber: string, updates: Partial<ProductDescription>): Promise<boolean> {
    const existing = this.productCache.get(articleNumber.trim());
    if (!existing) {
      return false;
    }

    const updated: ProductDescription = {
      ...existing,
      ...updates,
      articleNumber: existing.articleNumber, // Never change article number
    };

    this.productCache.set(articleNumber.trim(), updated);
    await this.saveCache();

    logger.info('Product description updated', { articleNumber });
    return true;
  }

  /**
   * Add single product description
   */
  async addProductDescription(product: ProductDescription): Promise<void> {
    this.productCache.set(product.articleNumber.trim(), product);
    await this.saveCache();
    logger.info('Product description added', { articleNumber: product.articleNumber });
  }

  /**
   * Delete product description
   */
  async deleteProductDescription(articleNumber: string): Promise<boolean> {
    const deleted = this.productCache.delete(articleNumber.trim());
    if (deleted) {
      await this.saveCache();
      logger.info('Product description deleted', { articleNumber });
    }
    return deleted;
  }

  /**
   * Clear all cached products
   */
  async clearCache(): Promise<void> {
    this.productCache.clear();
    await this.saveCache();
    logger.info('Product cache cleared');
  }

  /**
   * Load cache from file
   */
  private async loadCache(): Promise<void> {
    try {
      if (await fs.pathExists(this.cacheFilePath)) {
        const data = await fs.readJson(this.cacheFilePath);

        // Convert object back to Map
        if (data && typeof data === 'object') {
          this.productCache = new Map(Object.entries(data));
          logger.info('Product cache loaded', { products: this.productCache.size });
        }
      }
    } catch (error) {
      logger.warn('Failed to load product cache', { error });
      this.productCache = new Map();
    }
  }

  /**
   * Save cache to file
   */
  private async saveCache(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.cacheFilePath));

      // Convert Map to object for JSON serialization
      const data = Object.fromEntries(this.productCache);

      await fs.writeJson(this.cacheFilePath, data, { spaces: 2 });
      logger.info('Product cache saved', { products: this.productCache.size, file: this.cacheFilePath });
    } catch (error) {
      logger.error('Failed to save product cache', { error });
      throw error;
    }
  }

  /**
   * Export products to Excel
   */
  async exportToExcel(outputPath: string, products?: ProductDescription[]): Promise<void> {
    const dataToExport = products || this.getAllProducts();

    if (dataToExport.length === 0) {
      throw new Error('No products to export');
    }

    // Prepare data for Excel
    const excelData = dataToExport.map((product) => ({
      Artikelnummer: product.articleNumber,
      Beschreibung: product.description,
      Zusatzinfo: product.additionalInfo || '',
      Kategorie: product.category || '',
      ...product.customFields,
    }));

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Produkte');

    // Write to file
    await fs.ensureDir(path.dirname(outputPath));
    XLSX.writeFile(workbook, outputPath);

    logger.info('Products exported to Excel', { file: outputPath, count: dataToExport.length });
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const categories = new Set<string>();
    const customFieldKeys = new Set<string>();

    this.productCache.forEach((product) => {
      if (product.category) categories.add(product.category);
      if (product.customFields) {
        Object.keys(product.customFields).forEach((key) => customFieldKeys.add(key));
      }
    });

    return {
      totalProducts: this.productCache.size,
      categories: Array.from(categories),
      categoryCount: categories.size,
      customFields: Array.from(customFieldKeys),
      cacheFilePath: this.cacheFilePath,
    };
  }

  /**
   * Validate Excel file format before parsing
   */
  async validateExcelFile(filePath: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check file exists
      const fileExists = await fs.pathExists(filePath);
      if (!fileExists) {
        errors.push('File does not exist');
        return { valid: false, errors, warnings };
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
        errors.push(`Unsupported file format: ${ext}. Supported: .xlsx, .xls, .csv`);
        return { valid: false, errors, warnings };
      }

      // Try to read the file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        errors.push('No worksheets found in file');
        return { valid: false, errors, warnings };
      }

      const worksheet = workbook.Sheets[sheetName];
      const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });

      if (data.length === 0) {
        warnings.push('File has no data rows');
      }

      // Check for required columns
      if (data.length > 0) {
        const firstRow = data[0];
        const mapping = this.detectColumnMapping(firstRow);

        if (!mapping.articleNumber) {
          errors.push('Required column "Artikelnummer" not found');
        }

        if (!mapping.description) {
          warnings.push('Column "Beschreibung" not found');
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Failed to validate file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors, warnings };
    }
  }
}

// Singleton instance
let parserInstance: ExcelParserService | null = null;

/**
 * Get or create singleton instance
 */
export function getExcelParserService(cacheDir?: string): ExcelParserService {
  if (!parserInstance) {
    parserInstance = new ExcelParserService(cacheDir);
  }
  return parserInstance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetExcelParserService(): void {
  parserInstance = null;
}
