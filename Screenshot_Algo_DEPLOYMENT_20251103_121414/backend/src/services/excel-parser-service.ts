/**
 * Excel Parser Service
 * Handles Excel file parsing and product description extraction
 */

import * as XLSX from 'xlsx';
import { ProductDescription, ExcelParseResult } from '../types/label-types.js';

export class ExcelParserService {
  private static products: Map<string, ProductDescription> = new Map();

  /**
   * Parse Excel file and extract product descriptions
   */
  static async parseExcel(buffer: Buffer): Promise<ExcelParseResult> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(firstSheet);

    const products: ProductDescription[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    let validRows = 0;
    let invalidRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // Excel rows start at 1, header is 1

      try {
        const product = this.parseRow(row);
        products.push(product);
        validRows++;

        // Cache the product
        this.products.set(product.articleNumber, product);
      } catch (error) {
        invalidRows++;
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      products,
      totalRows: rows.length,
      validRows,
      invalidRows,
      errors,
    };
  }

  /**
   * Parse a single row and extract product description
   */
  private static parseRow(row: any): ProductDescription {
    // Support various column names
    const articleNumber =
      row['Artikelnummer'] ||
      row['Article Number'] ||
      row['SKU'] ||
      row['Art-Nr'] ||
      row['artikelnummer'] ||
      row['article_number'];

    const description =
      row['Beschreibung'] ||
      row['Description'] ||
      row['Produktbeschreibung'] ||
      row['Name'] ||
      row['description'] ||
      row['name'];

    if (!articleNumber) {
      throw new Error('Artikelnummer fehlt');
    }

    if (!description) {
      throw new Error('Beschreibung fehlt');
    }

    const additionalInfo =
      row['Additional Info'] ||
      row['Zusatzinfo'] ||
      row['Notes'] ||
      row['Hinweise'] ||
      row['additional_info'];

    // Extract custom fields (all other columns)
    const customFields: Record<string, string> = {};
    const standardFields = ['Artikelnummer', 'Article Number', 'SKU', 'Art-Nr',
                          'Beschreibung', 'Description', 'Produktbeschreibung', 'Name',
                          'Additional Info', 'Zusatzinfo', 'Notes', 'Hinweise'];

    for (const [key, value] of Object.entries(row)) {
      if (!standardFields.includes(key) && value) {
        customFields[key] = String(value);
      }
    }

    return {
      articleNumber: String(articleNumber).trim(),
      description: String(description).trim(),
      additionalInfo: additionalInfo ? String(additionalInfo).trim() : undefined,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    };
  }

  /**
   * Get all cached products
   */
  static getAllProducts(): ProductDescription[] {
    return Array.from(this.products.values());
  }

  /**
   * Get product by article number
   */
  static getProduct(articleNumber: string): ProductDescription | undefined {
    return this.products.get(articleNumber);
  }

  /**
   * Add or update a product
   */
  static saveProduct(product: ProductDescription): void {
    this.products.set(product.articleNumber, product);
  }

  /**
   * Delete a product
   */
  static deleteProduct(articleNumber: string): boolean {
    return this.products.delete(articleNumber);
  }

  /**
   * Clear all products from cache
   */
  static clearCache(): void {
    this.products.clear();
  }

  /**
   * Get cache statistics
   */
  static getStats() {
    return {
      totalProducts: this.products.size,
      articleNumbers: Array.from(this.products.keys()),
    };
  }

  /**
   * Export products to Excel buffer
   */
  static exportToExcel(): Buffer {
    const products = this.getAllProducts();
    const worksheet = XLSX.utils.json_to_sheet(products.map(p => ({
      'Artikelnummer': p.articleNumber,
      'Beschreibung': p.description,
      'Zusatzinfo': p.additionalInfo || '',
      ...p.customFields,
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Generate Excel template
   */
  static generateTemplate(): Buffer {
    const templateData = [
      {
        'Artikelnummer': '12345',
        'Beschreibung': 'Example Product',
        'Zusatzinfo': 'Optional additional info',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}
