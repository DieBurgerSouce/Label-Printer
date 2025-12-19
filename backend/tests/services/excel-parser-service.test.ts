/**
 * Excel Parser Service Tests
 * Tests for Excel file parsing and product description extraction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { ExcelParserService } from '../../src/services/excel-parser-service';

describe('ExcelParserService', () => {
  beforeEach(() => {
    // Clear cache before each test
    ExcelParserService.clearCache();
  });

  /**
   * Helper to create Excel buffer from data
   */
  function createExcelBuffer(data: Record<string, any>[]): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  describe('parseExcel', () => {
    it('should parse valid Excel file with German column names', async () => {
      const data = [
        { Artikelnummer: '12345', Beschreibung: 'Test Product 1' },
        { Artikelnummer: '67890', Beschreibung: 'Test Product 2' },
      ];
      const buffer = createExcelBuffer(data);

      const result = await ExcelParserService.parseExcel(buffer);

      expect(result.products).toHaveLength(2);
      expect(result.totalRows).toBe(2);
      expect(result.validRows).toBe(2);
      expect(result.invalidRows).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse valid Excel file with English column names', async () => {
      const data = [
        { 'Article Number': 'SKU-001', Description: 'Product A' },
        { 'Article Number': 'SKU-002', Description: 'Product B' },
      ];
      const buffer = createExcelBuffer(data);

      const result = await ExcelParserService.parseExcel(buffer);

      expect(result.products).toHaveLength(2);
      expect(result.products[0].articleNumber).toBe('SKU-001');
      expect(result.products[0].description).toBe('Product A');
    });

    it('should parse Excel file with SKU column', async () => {
      const data = [{ SKU: 'PROD-123', Name: 'My Product' }];
      const buffer = createExcelBuffer(data);

      const result = await ExcelParserService.parseExcel(buffer);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].articleNumber).toBe('PROD-123');
      expect(result.products[0].description).toBe('My Product');
    });

    it('should handle rows with missing article number', async () => {
      const data = [
        { Artikelnummer: '12345', Beschreibung: 'Valid Product' },
        { Beschreibung: 'Missing Article Number' },
      ];
      const buffer = createExcelBuffer(data);

      const result = await ExcelParserService.parseExcel(buffer);

      expect(result.products).toHaveLength(1);
      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Artikelnummer fehlt');
    });

    it('should handle rows with missing description', async () => {
      const data = [{ Artikelnummer: '12345' }];
      const buffer = createExcelBuffer(data);

      const result = await ExcelParserService.parseExcel(buffer);

      expect(result.products).toHaveLength(0);
      expect(result.invalidRows).toBe(1);
      expect(result.errors[0].message).toBe('Beschreibung fehlt');
    });

    it('should extract additional info', async () => {
      const data = [{ Artikelnummer: '12345', Beschreibung: 'Product', Zusatzinfo: 'Extra info' }];
      const buffer = createExcelBuffer(data);

      const result = await ExcelParserService.parseExcel(buffer);

      expect(result.products[0].additionalInfo).toBe('Extra info');
    });

    it('should extract custom fields', async () => {
      const data = [
        {
          Artikelnummer: '12345',
          Beschreibung: 'Product',
          CustomField1: 'Value1',
          CustomField2: 'Value2',
        },
      ];
      const buffer = createExcelBuffer(data);

      const result = await ExcelParserService.parseExcel(buffer);

      expect(result.products[0].customFields).toBeDefined();
      expect(result.products[0].customFields?.CustomField1).toBe('Value1');
      expect(result.products[0].customFields?.CustomField2).toBe('Value2');
    });

    it('should trim whitespace from values', async () => {
      const data = [{ Artikelnummer: '  12345  ', Beschreibung: '  Product Name  ' }];
      const buffer = createExcelBuffer(data);

      const result = await ExcelParserService.parseExcel(buffer);

      expect(result.products[0].articleNumber).toBe('12345');
      expect(result.products[0].description).toBe('Product Name');
    });

    it('should cache products after parsing', async () => {
      const data = [
        { Artikelnummer: 'CACHE-001', Beschreibung: 'Cached Product' },
        { Artikelnummer: 'CACHE-002', Beschreibung: 'Another Cached Product' },
      ];
      const buffer = createExcelBuffer(data);

      await ExcelParserService.parseExcel(buffer);

      const stats = ExcelParserService.getStats();
      expect(stats.totalProducts).toBe(2);
      expect(stats.articleNumbers).toContain('CACHE-001');
      expect(stats.articleNumbers).toContain('CACHE-002');
    });

    it('should report correct row numbers for errors', async () => {
      const data = [
        { Artikelnummer: '12345', Beschreibung: 'Valid' },
        { Beschreibung: 'No Article' }, // Row 3 in Excel (header is 1, data starts at 2)
        { Artikelnummer: '67890', Beschreibung: 'Valid' },
      ];
      const buffer = createExcelBuffer(data);

      const result = await ExcelParserService.parseExcel(buffer);

      expect(result.errors[0].row).toBe(3); // Excel rows are 1-indexed, header is row 1
    });
  });

  describe('getProduct', () => {
    it('should return undefined for non-existent product', () => {
      const product = ExcelParserService.getProduct('non-existent');
      expect(product).toBeUndefined();
    });

    it('should return product by article number', async () => {
      const data = [{ Artikelnummer: 'FIND-ME', Beschreibung: 'Found Product' }];
      const buffer = createExcelBuffer(data);
      await ExcelParserService.parseExcel(buffer);

      const product = ExcelParserService.getProduct('FIND-ME');

      expect(product).toBeDefined();
      expect(product?.articleNumber).toBe('FIND-ME');
      expect(product?.description).toBe('Found Product');
    });
  });

  describe('getAllProducts', () => {
    it('should return empty array when no products', () => {
      const products = ExcelParserService.getAllProducts();
      expect(products).toEqual([]);
    });

    it('should return all cached products', async () => {
      const data = [
        { Artikelnummer: 'P1', Beschreibung: 'Product 1' },
        { Artikelnummer: 'P2', Beschreibung: 'Product 2' },
      ];
      const buffer = createExcelBuffer(data);
      await ExcelParserService.parseExcel(buffer);

      const products = ExcelParserService.getAllProducts();

      expect(products).toHaveLength(2);
    });
  });

  describe('saveProduct', () => {
    it('should add new product to cache', () => {
      const product = { articleNumber: 'NEW-001', description: 'New Product' };

      ExcelParserService.saveProduct(product);

      const retrieved = ExcelParserService.getProduct('NEW-001');
      expect(retrieved).toEqual(product);
    });

    it('should update existing product', () => {
      const product1 = { articleNumber: 'UPDATE-001', description: 'Original' };
      const product2 = { articleNumber: 'UPDATE-001', description: 'Updated' };

      ExcelParserService.saveProduct(product1);
      ExcelParserService.saveProduct(product2);

      const retrieved = ExcelParserService.getProduct('UPDATE-001');
      expect(retrieved?.description).toBe('Updated');
    });
  });

  describe('deleteProduct', () => {
    it('should return false for non-existent product', () => {
      const result = ExcelParserService.deleteProduct('non-existent');
      expect(result).toBe(false);
    });

    it('should delete existing product', () => {
      ExcelParserService.saveProduct({ articleNumber: 'DELETE-001', description: 'To Delete' });

      const result = ExcelParserService.deleteProduct('DELETE-001');

      expect(result).toBe(true);
      expect(ExcelParserService.getProduct('DELETE-001')).toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('should remove all products from cache', () => {
      ExcelParserService.saveProduct({ articleNumber: 'P1', description: 'P1' });
      ExcelParserService.saveProduct({ articleNumber: 'P2', description: 'P2' });

      ExcelParserService.clearCache();

      expect(ExcelParserService.getAllProducts()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      ExcelParserService.saveProduct({ articleNumber: 'STAT-001', description: 'S1' });
      ExcelParserService.saveProduct({ articleNumber: 'STAT-002', description: 'S2' });
      ExcelParserService.saveProduct({ articleNumber: 'STAT-003', description: 'S3' });

      const stats = ExcelParserService.getStats();

      expect(stats.totalProducts).toBe(3);
      expect(stats.articleNumbers).toHaveLength(3);
      expect(stats.articleNumbers).toContain('STAT-001');
      expect(stats.articleNumbers).toContain('STAT-002');
      expect(stats.articleNumbers).toContain('STAT-003');
    });
  });

  describe('exportToExcel', () => {
    it('should export empty buffer when no products', () => {
      const buffer = ExcelParserService.exportToExcel();

      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should export products to valid Excel buffer', () => {
      ExcelParserService.saveProduct({
        articleNumber: 'EXP-001',
        description: 'Export Product',
        additionalInfo: 'Extra',
      });

      const buffer = ExcelParserService.exportToExcel();

      // Verify it's a valid Excel file by reading it back
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet) as any[];

      expect(data).toHaveLength(1);
      expect(data[0].Artikelnummer).toBe('EXP-001');
      expect(data[0].Beschreibung).toBe('Export Product');
      expect(data[0].Zusatzinfo).toBe('Extra');
    });

    it('should include custom fields in export', () => {
      ExcelParserService.saveProduct({
        articleNumber: 'CUSTOM-001',
        description: 'Custom Product',
        customFields: { Color: 'Red', Size: 'Large' },
      });

      const buffer = ExcelParserService.exportToExcel();

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet) as any[];

      expect(data[0].Color).toBe('Red');
      expect(data[0].Size).toBe('Large');
    });
  });

  describe('generateTemplate', () => {
    it('should generate valid Excel template', () => {
      const buffer = ExcelParserService.generateTemplate();

      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);

      // Verify template structure
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet) as any[];

      expect(data).toHaveLength(1);
      expect(data[0]).toHaveProperty('Artikelnummer');
      expect(data[0]).toHaveProperty('Beschreibung');
      expect(data[0]).toHaveProperty('Zusatzinfo');
    });
  });
});
