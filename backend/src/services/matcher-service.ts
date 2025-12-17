/**
 * Matcher Service
 * Matches OCR extracted data with Excel database using fuzzy matching
 */

import Fuse from 'fuse.js';
import stringSimilarity from 'string-similarity';
import { ExtractedData, MatchResult, FuzzyMatchConfig } from '../types/ocr-types';

interface ExcelRow {
  articleNumber?: string;
  ean?: string;
  productName?: string;
  [key: string]: any;
}

class MatcherService {
  /**
   * Match OCR data with Excel database
   */
  matchWithExcel(
    ocrData: ExtractedData,
    excelData: ExcelRow[],
    config: Partial<FuzzyMatchConfig> = {}
  ): MatchResult | null {
    // Default configuration
    const matchConfig: FuzzyMatchConfig = {
      threshold: 0.6,
      keys: ['articleNumber', 'ean', 'productName'],
      includeScore: true,
      minMatchCharLength: 3,
      ...config,
    };

    // Try exact match by article number first
    if (ocrData.articleNumber) {
      const exactMatch = this.findExactMatch(excelData, 'articleNumber', ocrData.articleNumber);
      if (exactMatch) {
        return {
          ocrData,
          excelData: exactMatch,
          matchScore: 1.0,
          matchedBy: 'articleNumber',
          confidence: 1.0,
        };
      }
    }

    // Try exact match by EAN
    if (ocrData.ean) {
      const exactMatch = this.findExactMatch(excelData, 'ean', ocrData.ean);
      if (exactMatch) {
        return {
          ocrData,
          excelData: exactMatch,
          matchScore: 1.0,
          matchedBy: 'ean',
          confidence: 1.0,
        };
      }
    }

    // Try fuzzy matching by product name
    if (ocrData.productName) {
      const fuzzyMatch = this.findFuzzyMatch(
        excelData,
        ocrData.productName,
        'productName',
        matchConfig.threshold
      );
      if (fuzzyMatch) {
        return {
          ocrData,
          excelData: fuzzyMatch.item,
          matchScore: fuzzyMatch.score,
          matchedBy: 'productName',
          confidence: fuzzyMatch.score,
        };
      }
    }

    // Try fuzzy matching by article number (allows for OCR errors)
    if (ocrData.articleNumber) {
      const fuzzyMatch = this.findFuzzyMatch(
        excelData,
        ocrData.articleNumber,
        'articleNumber',
        matchConfig.threshold
      );
      if (fuzzyMatch) {
        return {
          ocrData,
          excelData: fuzzyMatch.item,
          matchScore: fuzzyMatch.score,
          matchedBy: 'fuzzy',
          confidence: fuzzyMatch.score,
        };
      }
    }

    // No match found
    return null;
  }

  /**
   * Batch match multiple OCR results with Excel data
   */
  batchMatch(
    ocrResults: ExtractedData[],
    excelData: ExcelRow[],
    config: Partial<FuzzyMatchConfig> = {}
  ): MatchResult[] {
    return ocrResults
      .map((ocrData) => this.matchWithExcel(ocrData, excelData, config))
      .filter((result): result is MatchResult => result !== null);
  }

  /**
   * Find exact match in Excel data
   */
  private findExactMatch(
    excelData: ExcelRow[],
    field: keyof ExcelRow,
    value: string
  ): ExcelRow | null {
    const normalized = this.normalizeString(value);

    const match = excelData.find((row) => {
      const rowValue = row[field];
      if (!rowValue) return false;
      return this.normalizeString(String(rowValue)) === normalized;
    });

    return match || null;
  }

  /**
   * Find fuzzy match using Fuse.js
   */
  private findFuzzyMatch(
    excelData: ExcelRow[],
    searchValue: string,
    searchField: keyof ExcelRow,
    threshold: number
  ): { item: ExcelRow; score: number } | null {
    const fuse = new Fuse(excelData, {
      keys: [searchField as string],
      threshold: 1 - threshold, // Fuse uses distance, we use similarity
      includeScore: true,
      minMatchCharLength: 3,
    });

    const results = fuse.search(searchValue);

    if (results.length > 0) {
      const bestMatch = results[0];
      const score = 1 - (bestMatch.score || 0); // Convert distance to similarity

      if (score >= threshold) {
        return {
          item: bestMatch.item,
          score,
        };
      }
    }

    return null;
  }

  /**
   * Calculate similarity between two strings using multiple algorithms
   */
  calculateSimilarity(str1: string, str2: string): number {
    const normalized1 = this.normalizeString(str1);
    const normalized2 = this.normalizeString(str2);

    // Use Dice coefficient for better results
    const similarity = stringSimilarity.compareTwoStrings(normalized1, normalized2);

    return similarity;
  }

  /**
   * Find best matches for a given OCR result
   */
  findBestMatches(
    ocrData: ExtractedData,
    excelData: ExcelRow[],
    topN: number = 5
  ): Array<{ row: ExcelRow; score: number; field: string }> {
    const matches: Array<{ row: ExcelRow; score: number; field: string }> = [];

    // Score all rows
    for (const row of excelData) {
      let bestScore = 0;
      let bestField = '';

      // Compare article number
      if (ocrData.articleNumber && row.articleNumber) {
        const score = this.calculateSimilarity(ocrData.articleNumber, String(row.articleNumber));
        if (score > bestScore) {
          bestScore = score;
          bestField = 'articleNumber';
        }
      }

      // Compare product name
      if (ocrData.productName && row.productName) {
        const score = this.calculateSimilarity(ocrData.productName, String(row.productName));
        if (score > bestScore) {
          bestScore = score;
          bestField = 'productName';
        }
      }

      // Compare EAN
      if (ocrData.ean && row.ean) {
        const score = this.calculateSimilarity(ocrData.ean, String(row.ean));
        if (score > bestScore) {
          bestScore = score;
          bestField = 'ean';
        }
      }

      if (bestScore > 0) {
        matches.push({ row, score: bestScore, field: bestField });
      }
    }

    // Sort by score and return top N
    return matches.sort((a, b) => b.score - a.score).slice(0, topN);
  }

  /**
   * Normalize string for better matching
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss');
  }

  /**
   * Validate match quality
   */
  validateMatch(match: MatchResult): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check confidence threshold
    if (match.confidence < 0.7) {
      warnings.push(`Low confidence match (${Math.round(match.confidence * 100)}%)`);
      suggestions.push('Consider manual verification');
    }

    // Check if prices match (if available)
    if (match.ocrData.price && match.excelData.price) {
      const ocrPrice = this.extractNumericPrice(match.ocrData.price);
      const excelPrice = this.extractNumericPrice(String(match.excelData.price));

      if (ocrPrice && excelPrice && Math.abs(ocrPrice - excelPrice) > 0.1) {
        warnings.push(`Price mismatch: OCR=${ocrPrice}€, Excel=${excelPrice}€`);
        suggestions.push('Verify price information');
      }
    }

    // Check article number format
    if (match.matchedBy === 'fuzzy' || match.matchedBy === 'productName') {
      warnings.push('Match not based on article number');
      suggestions.push('Verify article number manually');
    }

    return {
      isValid: match.confidence >= 0.6,
      warnings,
      suggestions,
    };
  }

  /**
   * Extract numeric price from string
   */
  private extractNumericPrice(priceStr: string): number | null {
    const match = priceStr.match(/(\d+)[,.](\d{2})/);
    if (match) {
      return parseFloat(`${match[1]}.${match[2]}`);
    }
    return null;
  }

  /**
   * Generate match report
   */
  generateMatchReport(matches: MatchResult[]): {
    totalMatches: number;
    exactMatches: number;
    fuzzyMatches: number;
    averageConfidence: number;
    lowConfidenceMatches: number;
  } {
    const exactMatches = matches.filter(
      (m) => m.matchedBy === 'articleNumber' || m.matchedBy === 'ean'
    ).length;

    const fuzzyMatches = matches.filter(
      (m) => m.matchedBy === 'fuzzy' || m.matchedBy === 'productName'
    ).length;

    const totalConfidence = matches.reduce((sum, m) => sum + m.confidence, 0);
    const averageConfidence = matches.length > 0 ? totalConfidence / matches.length : 0;

    const lowConfidenceMatches = matches.filter((m) => m.confidence < 0.7).length;

    return {
      totalMatches: matches.length,
      exactMatches,
      fuzzyMatches,
      averageConfidence,
      lowConfidenceMatches,
    };
  }
}

// Export singleton instance
export const matcherService = new MatcherService();
