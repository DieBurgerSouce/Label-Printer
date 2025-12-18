/**
 * Storage Service
 * Handles label storage, retrieval, and file management
 */

import fs from 'fs/promises';
import path from 'path';
import { PriceLabel, LabelMetadata, FilterParams, PaginationParams } from '../types/label-types.js';

export class StorageService {
  private static labels: Map<string, PriceLabel> = new Map();
  private static dataDir = path.join(process.cwd(), 'data', 'labels');
  private static cacheDir = path.join(process.cwd(), 'data', 'cache');
  private static exportsDir = path.join(process.cwd(), 'data', 'exports');

  /**
   * Initialize storage directories
   */
  static async init(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.mkdir(this.exportsDir, { recursive: true });
  }

  /**
   * Save a label
   * ✅ FIX: Save imageData separately as PNG to preserve Buffer
   */
  static async saveLabel(label: PriceLabel): Promise<void> {
    this.labels.set(label.id, label);

    // Create label directory
    const labelDir = path.join(this.dataDir, label.id);
    await fs.mkdir(labelDir, { recursive: true });

    // Save metadata
    const metadata: LabelMetadata = {
      id: label.id,
      articleNumber: label.articleNumber,
      createdAt: label.createdAt,
      updatedAt: label.updatedAt,
      source: label.source,
      tags: label.tags || [],
      category: label.category,
    };

    await fs.writeFile(path.join(labelDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

    // ✅ FIX: Save imageData separately as PNG (preserves Buffer!)
    if (label.imageData && Buffer.isBuffer(label.imageData)) {
      await fs.writeFile(path.join(labelDir, 'image.png'), label.imageData);
    }

    // Save label data WITHOUT imageData (to avoid Buffer serialization issue)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { imageData: _, ...labelWithoutImage } = label;
    await fs.writeFile(
      path.join(labelDir, 'label.json'),
      JSON.stringify(labelWithoutImage, null, 2)
    );
  }

  /**
   * Get label by ID
   * ✅ FIX: Load imageData separately as Buffer
   */
  static async getLabel(id: string): Promise<PriceLabel | null> {
    // Check in-memory cache first
    if (this.labels.has(id)) {
      return this.labels.get(id)!;
    }

    // Load from disk
    try {
      const labelPath = path.join(this.dataDir, id, 'label.json');
      const imagePath = path.join(this.dataDir, id, 'image.png');

      // Load label JSON
      const data = await fs.readFile(labelPath, 'utf-8');
      const label = JSON.parse(data) as PriceLabel;

      // ✅ FIX: Load imageData as actual Buffer (not JSON serialized!)
      try {
        const imageData = await fs.readFile(imagePath);
        label.imageData = imageData; // ✅ Real Buffer!
        console.log(`✅ Loaded imageData for label ${id} (${imageData.length} bytes)`);
      } catch {
        // No image file exists
        // ⚠️ COMPATIBILITY: Check if imageData was stored as JSON Object (old format)
        if (label.imageData && !Buffer.isBuffer(label.imageData)) {
          const bufferData = label.imageData as any;
          if (bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
            // Convert JSON-serialized Buffer back to real Buffer
            label.imageData = Buffer.from(bufferData.data);
            console.log(
              `✅ Converted legacy imageData for label ${id} (${label.imageData.length} bytes)`
            );

            // Re-save in new format (migrate automatically)
            try {
              await fs.writeFile(imagePath, label.imageData);
              console.log(`✅ Migrated imageData to new format for label ${id}`);
            } catch {
              console.warn(`⚠️ Could not migrate imageData for label ${id}`);
            }
          } else {
            console.warn(`⚠️ Invalid imageData format for label ${id}`);
            label.imageData = undefined;
          }
        } else {
          console.log(`⚠️ No imageData for label ${id}`);
        }
      }

      // Cache it
      this.labels.set(id, label);
      return label;
    } catch {
      return null;
    }
  }

  /**
   * Get all labels with optional filters and pagination
   */
  static async getLabels(
    filters?: FilterParams,
    pagination?: PaginationParams
  ): Promise<{ labels: PriceLabel[]; total: number }> {
    let labels = Array.from(this.labels.values());

    // Apply filters
    if (filters) {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        labels = labels.filter(
          (l) =>
            l.productName.toLowerCase().includes(search) ||
            l.articleNumber.toLowerCase().includes(search) ||
            l.description?.toLowerCase().includes(search)
        );
      }

      if (filters.category) {
        labels = labels.filter((l) => l.category === filters.category);
      }

      if (filters.tags && filters.tags.length > 0) {
        labels = labels.filter((l) => filters.tags!.some((tag) => l.tags?.includes(tag)));
      }

      if (filters.source) {
        labels = labels.filter((l) => l.source === filters.source);
      }

      if (filters.dateFrom) {
        labels = labels.filter((l) => new Date(l.createdAt) >= filters.dateFrom!);
      }

      if (filters.dateTo) {
        labels = labels.filter((l) => new Date(l.createdAt) <= filters.dateTo!);
      }
    }

    const total = labels.length;

    // Apply pagination
    if (pagination) {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

      // Sort
      labels.sort((a, b) => {
        const aVal = (a as any)[sortBy];
        const bVal = (b as any)[sortBy];

        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      // Paginate
      const start = (page - 1) * limit;
      const end = start + limit;
      labels = labels.slice(start, end);
    }

    return { labels, total };
  }

  /**
   * Delete a label
   */
  static async deleteLabel(id: string): Promise<boolean> {
    this.labels.delete(id);

    try {
      const labelDir = path.join(this.dataDir, id);
      await fs.rm(labelDir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete multiple labels
   */
  static async deleteLabels(ids: string[]): Promise<number> {
    let deleted = 0;
    for (const id of ids) {
      const success = await this.deleteLabel(id);
      if (success) deleted++;
    }
    return deleted;
  }

  /**
   * Get storage statistics
   */
  static async getStats() {
    const labels = Array.from(this.labels.values());

    const categoryCounts = labels.reduce(
      (acc, label) => {
        const cat = label.category || 'Uncategorized';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const sourceCounts = labels.reduce(
      (acc, label) => {
        acc[label.source] = (acc[label.source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalLabels: this.labels.size,
      categories: categoryCounts,
      sources: sourceCounts,
      templateTypes: labels.reduce(
        (acc, label) => {
          acc[label.templateType] = (acc[label.templateType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }

  /**
   * Save image data for a label
   */
  static async saveLabelImage(
    labelId: string,
    imageBuffer: Buffer,
    filename: string
  ): Promise<string> {
    const labelDir = path.join(this.dataDir, labelId);
    await fs.mkdir(labelDir, { recursive: true });

    const imagePath = path.join(labelDir, filename);
    await fs.writeFile(imagePath, imageBuffer);

    return imagePath;
  }

  /**
   * Get label image
   */
  static async getLabelImage(labelId: string, filename: string): Promise<Buffer | null> {
    try {
      const imagePath = path.join(this.dataDir, labelId, filename);
      return await fs.readFile(imagePath);
    } catch {
      return null;
    }
  }
}
