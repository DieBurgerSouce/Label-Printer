/**
 * Google Cloud Vision API Service
 * Optional fallback for OCR when Tesseract fails or has low confidence
 *
 * Note: This service is OPTIONAL and requires Google Cloud credentials
 * The system works fine without it - it's just for improved accuracy
 */

import { ExtractedData, TieredPrice } from '../types/ocr-types';
import * as fs from 'fs/promises';

interface CloudVisionConfig {
  apiKey?: string;
  enabled: boolean;
  confidenceThreshold: number;
}

class CloudVisionService {
  private config: CloudVisionConfig = {
    apiKey: process.env.GOOGLE_CLOUD_VISION_API_KEY,
    enabled: false, // Disabled by default
    confidenceThreshold: 0.7, // Use cloud OCR if Tesseract confidence < 70%
  };

  constructor() {
    if (this.config.apiKey) {
      this.config.enabled = true;
      console.log('✅ Cloud Vision API configured (optional fallback)');
    } else {
      console.log('ℹ️ Cloud Vision API not configured (using Tesseract only)');
    }
  }

  /**
   * Check if Cloud Vision is available
   */
  isAvailable(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  /**
   * Process image with Google Cloud Vision API
   */
  async processImage(imagePath: string): Promise<ExtractedData | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      // Read image file
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Prepare request
      const request = {
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1,
              },
              {
                type: 'DOCUMENT_TEXT_DETECTION',
                maxResults: 1,
              },
            ],
            imageContext: {
              languageHints: ['de', 'en'],
            },
          },
        ],
      };

      // Call Cloud Vision API
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        console.error('Cloud Vision API error:', response.status);
        return null;
      }

      const result = await response.json();
      const textAnnotation = result.responses[0]?.fullTextAnnotation;

      if (!textAnnotation) {
        return null;
      }

      // Parse the clean text from Cloud Vision
      return this.parseCloudVisionText(textAnnotation.text);
    } catch (error) {
      console.error('Cloud Vision processing failed:', error);
      return null;
    }
  }

  /**
   * Parse Cloud Vision text into structured data
   */
  private parseCloudVisionText(text: string): ExtractedData {
    const data: ExtractedData = {};

    // Clean text lines (Cloud Vision usually returns cleaner text)
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    // Extract article number
    for (const line of lines) {
      const articleMatch = line.match(/\b(\d{4,})\b/);
      if (articleMatch && !data.articleNumber) {
        data.articleNumber = articleMatch[1];
      }
    }

    // Extract prices
    const priceLines = lines.filter(
      (line) => line.includes('€') || line.includes('EUR') || /\d+[,\.]\d{2}/.test(line)
    );

    // Parse tiered prices
    const tieredPrices: TieredPrice[] = [];
    for (const line of priceLines) {
      // Match patterns like "Bis 593 28,49 €" or "Ab 594 26,79 €"
      const tierMatch = line.match(/(ab|bis)\s+(\d+)\s+.*?([\d,]+)\s*€/i);
      if (tierMatch) {
        tieredPrices.push({
          quantity: parseInt(tierMatch[2]),
          price: tierMatch[3].replace(',', '.'),
        });
      }
    }

    if (tieredPrices.length > 0) {
      data.tieredPrices = tieredPrices.sort((a, b) => a.quantity - b.quantity);
    }

    // Extract single price if no tiered prices
    if (!data.tieredPrices || data.tieredPrices.length === 0) {
      const priceMatch = text.match(/(\d+[,\.]\d{2})\s*€/);
      if (priceMatch) {
        data.price = priceMatch[1].replace(',', '.');
      }
    }

    // Extract product name (first substantial line that's not a price)
    const nameLines = lines.filter(
      (line) =>
        line.length > 10 &&
        !line.includes('€') &&
        !line.includes('EUR') &&
        !line.match(/^\d+$/) &&
        !line.includes('©') &&
        !line.includes('Service') &&
        !line.includes('Hilfe')
    );

    if (nameLines.length > 0) {
      data.productName = nameLines[0];
    }

    return data;
  }

  /**
   * Should use Cloud Vision for this confidence score?
   */
  shouldUseFallback(tesseractConfidence: number): boolean {
    return this.isAvailable() && tesseractConfidence < this.config.confidenceThreshold;
  }
}

// Export singleton instance
export const cloudVisionService = new CloudVisionService();
