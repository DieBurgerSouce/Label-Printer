import type { Product } from '@/services/api';
import type { LabelElement } from '../types';

export const getCurrencySymbol = (currencyCode: string): string => {
  const currencyMap: { [key: string]: string } = {
    'EUR': '€',
    'USD': '$',
    'GBP': '£',
    'CHF': 'CHF',
    'JPY': '¥',
  };
  return currencyMap[currencyCode] || currencyCode;
};

export const parseTieredPrices = (article: any): { quantity: string; price: string }[] => {
  // First, try to use structured tieredPrices if available
  if (article?.tieredPrices && Array.isArray(article.tieredPrices) && article.tieredPrices.length > 0) {
    return article.tieredPrices.map((tier: any, i: number) => {
      const price = typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
      const prefix = i === 0 ? 'Bis' : 'Ab';
      return {
        quantity: `${prefix} ${tier.quantity}`,
        price: price ? `${price.toFixed(2).replace('.', ',')} €` : '-'
      };
    });
  }

  // Fallback to parsing tieredPricesText, but clean it first
  if (article?.tieredPricesText) {
    const lines = article.tieredPricesText
      .split('\n')
      .filter((line: string) => {
        // Clean up OCR garbage
        return line.trim() &&
               !line.includes('©') &&
               !line.includes('Service') &&
               !line.includes('Hilfe') &&
               !line.includes('Goooe') &&
               !line.includes('eingeben');
      });

    const rows: { quantity: string; price: string }[] = [];

    lines.forEach((line: string) => {
      // Match patterns like "ab 7 Stück: 190,92 EUR" or "Bis 593 28,49 €"
      const match = line.match(/^(ab|bis)\s+(\d+).*?([0-9,]+)\s*(?:€|EUR)/i);
      if (match) {
        const prefix = match[1].toLowerCase() === 'ab' ? 'Ab' : 'Bis';
        const quantity = `${prefix} ${match[2]}`;
        const price = `${match[3]} €`;
        rows.push({ quantity, price });
      }
    });

    return rows;
  }

  return [];
};

export const getDisplayContent = (element: LabelElement, previewArticle: Product | null): string => {
  // Helper: Check if content is a placeholder
  const isPlaceholder = (content: string): boolean => {
    return !content || content.startsWith('{{') || content === 'Überschrift...' || content.trim() === '';
  };

  // If no article selected, show placeholder or custom content
  if (!previewArticle) {
    switch (element.type) {
      case 'text':
        return element.content || '{{Produktname}}';
      case 'description':
        return element.content || '{{Beschreibung}}';
      case 'price':
        return element.content || '{{Preis}}';
      case 'articleNumber':
        return element.content || '{{Artikelnummer}}';
      default:
        return element.content;
    }
  }

  // Article selected - decide between custom content and product data
  switch (element.type) {
    case 'articleNumber':
      // Always show article number from product
      return previewArticle.articleNumber ? `Artikelnummer: ${previewArticle.articleNumber}` : (element.content || '{{Artikelnummer}}');

    case 'price':
      // If custom content exists (not placeholder), use it
      if (!isPlaceholder(element.content)) {
        return element.content;
      }
      // Otherwise show product price
      if (previewArticle.price) {
        const currencySymbol = getCurrencySymbol(previewArticle.currency || 'EUR');
        return `${previewArticle.price.toFixed(2).replace('.', ',')} ${currencySymbol}`;
      }
      return element.content || '{{Preis}}';

    case 'description':
      // If custom content exists (not placeholder), use it
      if (!isPlaceholder(element.content)) {
        return element.content;
      }
      // Otherwise show product description
      return previewArticle.description || element.content || '{{Beschreibung}}';

    case 'text':
      // IMPORTANT: If custom content exists (not placeholder), use it!
      // This allows article-specific custom headings
      if (!isPlaceholder(element.content)) {
        return element.content;
      }
      // Otherwise show product name
      return previewArticle.productName || element.content || '{{Produktname}}';

    case 'freeText':
      // Always show the static content entered by user (never replace with product data)
      return element.content;

    default:
      return element.content;
  }
};
