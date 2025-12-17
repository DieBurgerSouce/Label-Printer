/**
 * Text Utilities for OCR Service
 * Price extraction, OCR error fixes, and text cleaning
 */

import { TieredPrice } from '../../types/extraction-types';

/**
 * Extract price from text
 */
export function extractPrice(text: string): string {
  const pricePattern = /(\d+[,.]?\d*)\s*€|EUR\s*(\d+[,.]?\d*)/gi;
  const match = pricePattern.exec(text);

  if (match) {
    const price = match[1] || match[2];
    return price.replace(',', '.');
  }

  return text.trim();
}

/**
 * Fix common OCR errors in numbers (e.g., "SO" -> "50", "O" -> "0", "l" -> "1")
 */
export function fixOCRNumberErrors(text: string): string {
  return (
    text
      // "SO" -> "50" (very common in German price tables - in "AbSO", "BisSO", etc.)
      .replace(/SO(?=\s|$|[^\w])/gi, '50')
      // "O" (letter) -> "0" (digit) when surrounded by digits or at end
      .replace(/([0-9])O([0-9])/g, '$10$2')
      .replace(/O([0-9])/g, '0$1')
      .replace(/([0-9])O\b/g, '$10')
      // "l" (lowercase L) or "I" (uppercase i) -> "1"
      .replace(/\bl\b/g, '1')
      .replace(/\bI\b/g, '1')
  );
}

/**
 * Parse tiered prices from OCR text
 */
export function parseTieredPrices(text: string): TieredPrice[] {
  const prices: TieredPrice[] = [];
  const lines = text.split('\n');

  // Match "Bis" or "Ab" prefix to get the correct quantity
  const pricePattern = /(?:bis|ab)\s*(\d+)\s*(?:stück|stk|pcs)?.*?(\d+[,.]?\d*)\s*€/i;

  for (let line of lines) {
    // Apply OCR error corrections
    line = fixOCRNumberErrors(line);

    const match = line.match(pricePattern);
    if (match) {
      prices.push({
        quantity: parseInt(match[1]),
        price: match[2].replace(',', '.'),
      });
    }
  }

  return prices;
}

/**
 * Clean OCR text by removing common artifacts
 */
export function cleanOcrText(text: string): string {
  // Remove "Produktinformationen" prefix (only the prefix part before product name)
  text = text.replace(/^Produktinformationen\s*/i, '');
  // Remove quotes around product name
  text = text.replace(/^[""'](.+)[""']\s*/i, '$1');
  // Remove "Preis pro Stück" suffix
  text = text.replace(/\s*Preis pro St.ck\s*$/i, '');
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ');
  // Fix common OCR errors
  text = text.replace(/©/g, 'Ø');
  text = text.replace(/S\s+(\d)/g, 'Ø $1'); // "S 60" → "Ø 60"

  return text.trim();
}

/**
 * Get article number from OCR text
 */
export function getArticleNumberFromText(text: string): string {
  if (text.includes(':')) {
    const parts = text.split(':');
    if (parts.length > 1) {
      text = parts[1].trim();
    }
  }

  const match = text.match(/\d+[A-Za-z0-9\-.]*/);
  return match ? match[0] : text.trim();
}

/**
 * Parse price from text string
 */
export function parsePrice(priceText: string): number | null {
  const match = priceText.match(/([\d.,]+)/);
  if (!match) return null;

  const normalized = match[1].replace(',', '.');
  const price = parseFloat(normalized);

  return isNaN(price) ? null : price;
}
