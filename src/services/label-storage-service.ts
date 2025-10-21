import * as fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { createLogger } from '../utils/logger';
import {
  PriceLabel,
  LabelStorageOptions,
  PaginationParams,
  PaginatedResponse,
  LabelFilter,
  NotFoundError,
  StorageError,
} from '../types/label-types';

const logger = createLogger('LabelStorageService');

export interface StoredLabel {
  label: PriceLabel;
  paths: {
    metadata: string;
    image?: string;
    thumbnail?: string;
  };
}

export class LabelStorageService {
  private baseDir: string;
  private options: LabelStorageOptions;
  private labelIndex: Map<string, StoredLabel> = new Map();

  constructor(baseDir: string = './data/labels', options?: Partial<LabelStorageOptions>) {
    this.baseDir = baseDir;
    this.options = {
      directory: baseDir,
      createThumbnails: options?.createThumbnails ?? true,
      thumbnailSize: options?.thumbnailSize ?? 200,
      compression: options?.compression ?? 80,
    };
    this.init();
  }

  /**
   * Initialize storage service
   */
  private async init(): Promise<void> {
    try {
      await fs.ensureDir(this.baseDir);
      await this.rebuildIndex();
      logger.info('LabelStorageService initialized', { baseDir: this.baseDir });
    } catch (error) {
      logger.error('Failed to initialize LabelStorageService', { error });
      throw new StorageError('Failed to initialize storage service', { error });
    }
  }

  /**
   * Rebuild label index from filesystem
   */
  private async rebuildIndex(): Promise<void> {
    try {
      this.labelIndex.clear();

      // Scan all subdirectories
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const labelDir = path.join(this.baseDir, entry.name);
        const metadataPath = path.join(labelDir, 'metadata.json');

        if (await fs.pathExists(metadataPath)) {
          try {
            const metadata = await fs.readJson(metadataPath);
            const label: PriceLabel = {
              id: metadata.id,
              articleNumber: metadata.articleNumber,
              productName: metadata.productName,
              description: metadata.description,
              priceInfo: metadata.priceInfo,
              templateType: metadata.templateType,
              createdAt: new Date(metadata.createdAt),
              updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : undefined,
              tags: metadata.tags,
            };

            const imagePath = path.join(labelDir, 'label.png');
            const thumbnailPath = path.join(labelDir, 'thumbnail.png');

            this.labelIndex.set(label.id, {
              label,
              paths: {
                metadata: metadataPath,
                image: (await fs.pathExists(imagePath)) ? imagePath : undefined,
                thumbnail: (await fs.pathExists(thumbnailPath)) ? thumbnailPath : undefined,
              },
            });
          } catch (error) {
            logger.warn('Failed to load label metadata', { labelDir, error });
          }
        }
      }

      logger.info('Label index rebuilt', { count: this.labelIndex.size });
    } catch (error) {
      logger.error('Failed to rebuild label index', { error });
      throw new StorageError('Failed to rebuild label index', { error });
    }
  }

  /**
   * Save a label to storage
   */
  async saveLabel(label: PriceLabel): Promise<StoredLabel> {
    try {
      const labelDir = path.join(this.baseDir, label.id);
      await fs.ensureDir(labelDir);

      // Prepare metadata
      const metadata = {
        id: label.id,
        articleNumber: label.articleNumber,
        productName: label.productName,
        description: label.description,
        priceInfo: label.priceInfo,
        templateType: label.templateType,
        createdAt: label.createdAt.toISOString(),
        updatedAt: label.updatedAt?.toISOString(),
        tags: label.tags,
      };

      // Save metadata
      const metadataPath = path.join(labelDir, 'metadata.json');
      await fs.writeJson(metadataPath, metadata, { spaces: 2 });

      const paths: StoredLabel['paths'] = { metadata: metadataPath };

      // Save image if available
      if (label.imageData) {
        const imagePath = path.join(labelDir, 'label.png');

        // Optimize and save image
        await sharp(label.imageData)
          .png({ compressionLevel: 9, quality: this.options.compression })
          .toFile(imagePath);

        paths.image = imagePath;

        // Create thumbnail if enabled
        if (this.options.createThumbnails) {
          const thumbnailPath = path.join(labelDir, 'thumbnail.png');

          await sharp(label.imageData)
            .resize(this.options.thumbnailSize, this.options.thumbnailSize, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .png({ compressionLevel: 9 })
            .toFile(thumbnailPath);

          paths.thumbnail = thumbnailPath;
        }
      }

      const storedLabel: StoredLabel = { label, paths };

      // Update index
      this.labelIndex.set(label.id, storedLabel);

      logger.info('Label saved to storage', { labelId: label.id, labelDir });
      return storedLabel;
    } catch (error) {
      logger.error('Failed to save label', { labelId: label.id, error });
      throw new StorageError('Failed to save label', { labelId: label.id, error });
    }
  }

  /**
   * Get a label by ID
   */
  async getLabel(id: string, includeImageData = false): Promise<PriceLabel> {
    const stored = this.labelIndex.get(id);

    if (!stored) {
      throw new NotFoundError(`Label not found: ${id}`, { labelId: id });
    }

    const label = { ...stored.label };

    // Load image data if requested
    if (includeImageData && stored.paths.image) {
      try {
        label.imageData = await fs.readFile(stored.paths.image);
      } catch (error) {
        logger.warn('Failed to load image data', { labelId: id, error });
      }
    }

    return label;
  }

  /**
   * Get label thumbnail
   */
  async getThumbnail(id: string): Promise<Buffer | null> {
    const stored = this.labelIndex.get(id);

    if (!stored || !stored.paths.thumbnail) {
      return null;
    }

    try {
      return await fs.readFile(stored.paths.thumbnail);
    } catch (error) {
      logger.warn('Failed to load thumbnail', { labelId: id, error });
      return null;
    }
  }

  /**
   * Get label image
   */
  async getImage(id: string): Promise<Buffer | null> {
    const stored = this.labelIndex.get(id);

    if (!stored || !stored.paths.image) {
      return null;
    }

    try {
      return await fs.readFile(stored.paths.image);
    } catch (error) {
      logger.warn('Failed to load image', { labelId: id, error });
      return null;
    }
  }

  /**
   * Update a label
   */
  async updateLabel(id: string, updates: Partial<PriceLabel>): Promise<PriceLabel> {
    const existing = await this.getLabel(id);

    const updated: PriceLabel = {
      ...existing,
      ...updates,
      id: existing.id, // Never change ID
      articleNumber: updates.articleNumber || existing.articleNumber,
      updatedAt: new Date(),
    };

    await this.saveLabel(updated);

    logger.info('Label updated', { labelId: id });
    return updated;
  }

  /**
   * Delete a label
   */
  async deleteLabel(id: string): Promise<void> {
    const stored = this.labelIndex.get(id);

    if (!stored) {
      throw new NotFoundError(`Label not found: ${id}`, { labelId: id });
    }

    try {
      // Delete directory
      const labelDir = path.dirname(stored.paths.metadata);
      await fs.remove(labelDir);

      // Remove from index
      this.labelIndex.delete(id);

      logger.info('Label deleted', { labelId: id });
    } catch (error) {
      logger.error('Failed to delete label', { labelId: id, error });
      throw new StorageError('Failed to delete label', { labelId: id, error });
    }
  }

  /**
   * Get all labels with optional filtering and pagination
   */
  async getLabels(
    filter?: LabelFilter,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<PriceLabel>> {
    // Get all labels
    let labels = Array.from(this.labelIndex.values()).map((stored) => stored.label);

    // Apply filters
    if (filter) {
      labels = this.applyFilter(labels, filter);
    }

    // Apply sorting
    if (pagination?.sortBy) {
      labels = this.applySort(labels, pagination.sortBy, pagination.sortOrder || 'asc');
    } else {
      // Default sort by createdAt desc
      labels.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // Calculate pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const total = labels.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    // Paginate
    const paginatedLabels = labels.slice(startIndex, endIndex);

    return {
      data: paginatedLabels,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Apply filter to labels
   */
  private applyFilter(labels: PriceLabel[], filter: LabelFilter): PriceLabel[] {
    return labels.filter((label) => {
      // Article number filter
      if (filter.articleNumber && !label.articleNumber.includes(filter.articleNumber)) {
        return false;
      }

      // Category filter
      if (filter.category && !label.tags?.includes(filter.category)) {
        return false;
      }

      // Tags filter
      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some((tag) => label.tags?.includes(tag));
        if (!hasTag) return false;
      }

      // Date range filter
      if (filter.dateFrom && label.createdAt < filter.dateFrom) {
        return false;
      }
      if (filter.dateTo && label.createdAt > filter.dateTo) {
        return false;
      }

      // Price range filter
      if (filter.priceMin && label.priceInfo.price < filter.priceMin) {
        return false;
      }
      if (filter.priceMax && label.priceInfo.price > filter.priceMax) {
        return false;
      }

      // Search filter
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matchesSearch =
          label.articleNumber.toLowerCase().includes(searchLower) ||
          label.productName.toLowerCase().includes(searchLower) ||
          label.description?.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      return true;
    });
  }

  /**
   * Apply sorting to labels
   */
  private applySort(
    labels: PriceLabel[],
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): PriceLabel[] {
    return labels.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case 'articleNumber':
          aVal = a.articleNumber;
          bVal = b.articleNumber;
          break;
        case 'productName':
          aVal = a.productName;
          bVal = b.productName;
          break;
        case 'price':
          aVal = a.priceInfo.price;
          bVal = b.priceInfo.price;
          break;
        case 'createdAt':
          aVal = a.createdAt.getTime();
          bVal = b.createdAt.getTime();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Search labels
   */
  async searchLabels(query: string, limit = 20): Promise<PriceLabel[]> {
    const result = await this.getLabels(
      { search: query },
      { page: 1, limit }
    );
    return result.data;
  }

  /**
   * Get labels by article numbers (batch)
   */
  async getLabelsByArticleNumbers(articleNumbers: string[]): Promise<PriceLabel[]> {
    const labels: PriceLabel[] = [];

    for (const articleNumber of articleNumbers) {
      const found = Array.from(this.labelIndex.values()).find(
        (stored) => stored.label.articleNumber === articleNumber
      );

      if (found) {
        labels.push(found.label);
      }
    }

    return labels;
  }

  /**
   * Get labels by tags
   */
  async getLabelsByTags(tags: string[]): Promise<PriceLabel[]> {
    const result = await this.getLabels({ tags });
    return result.data;
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    const labels = Array.from(this.labelIndex.values());

    // Calculate total size
    let totalSize = 0;
    for (const stored of labels) {
      if (stored.paths.image) {
        try {
          const stats = await fs.stat(stored.paths.image);
          totalSize += stats.size;
        } catch (error) {
          // Ignore
        }
      }
    }

    // Count by template type
    const byTemplate: Record<string, number> = {};
    labels.forEach((stored) => {
      const type = stored.label.templateType;
      byTemplate[type] = (byTemplate[type] || 0) + 1;
    });

    // Count by tags
    const byTag: Record<string, number> = {};
    labels.forEach((stored) => {
      stored.label.tags?.forEach((tag) => {
        byTag[tag] = (byTag[tag] || 0) + 1;
      });
    });

    return {
      totalLabels: labels.length,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      byTemplate,
      byTag,
      baseDir: this.baseDir,
    };
  }

  /**
   * Export labels to JSON
   */
  async exportToJson(outputPath: string, labelIds?: string[]): Promise<void> {
    try {
      let labels: PriceLabel[];

      if (labelIds && labelIds.length > 0) {
        labels = await Promise.all(
          labelIds.map((id) => this.getLabel(id, false))
        );
      } else {
        const result = await this.getLabels();
        labels = result.data;
      }

      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeJson(outputPath, labels, { spaces: 2 });

      logger.info('Labels exported to JSON', { file: outputPath, count: labels.length });
    } catch (error) {
      logger.error('Failed to export labels', { error });
      throw new StorageError('Failed to export labels', { error });
    }
  }

  /**
   * Import labels from JSON
   */
  async importFromJson(inputPath: string): Promise<number> {
    try {
      const labels: PriceLabel[] = await fs.readJson(inputPath);

      for (const label of labels) {
        // Ensure dates are Date objects
        label.createdAt = new Date(label.createdAt);
        if (label.updatedAt) {
          label.updatedAt = new Date(label.updatedAt);
        }

        await this.saveLabel(label);
      }

      logger.info('Labels imported from JSON', { file: inputPath, count: labels.length });
      return labels.length;
    } catch (error) {
      logger.error('Failed to import labels', { error });
      throw new StorageError('Failed to import labels', { error });
    }
  }

  /**
   * Archive old labels (move to archive directory)
   */
  async archiveLabels(olderThanDays: number): Promise<number> {
    const archiveDir = path.join(this.baseDir, 'archive');
    await fs.ensureDir(archiveDir);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let archivedCount = 0;

    for (const stored of this.labelIndex.values()) {
      if (stored.label.createdAt < cutoffDate) {
        try {
          const labelDir = path.dirname(stored.paths.metadata);
          const targetDir = path.join(archiveDir, stored.label.id);

          await fs.move(labelDir, targetDir, { overwrite: true });
          this.labelIndex.delete(stored.label.id);
          archivedCount++;
        } catch (error) {
          logger.warn('Failed to archive label', { labelId: stored.label.id, error });
        }
      }
    }

    logger.info('Labels archived', { count: archivedCount, olderThanDays });
    return archivedCount;
  }

  /**
   * Clean up orphaned files
   */
  async cleanup(): Promise<void> {
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === 'archive') continue;

        const labelDir = path.join(this.baseDir, entry.name);
        const metadataPath = path.join(labelDir, 'metadata.json');

        // If no metadata file, remove directory
        if (!(await fs.pathExists(metadataPath))) {
          logger.warn('Removing orphaned label directory', { labelDir });
          await fs.remove(labelDir);
        }
      }

      logger.info('Storage cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup storage', { error });
    }
  }
}

// Singleton instance
let storageInstance: LabelStorageService | null = null;

export function getLabelStorageService(baseDir?: string, options?: Partial<LabelStorageOptions>): LabelStorageService {
  if (!storageInstance) {
    storageInstance = new LabelStorageService(baseDir, options);
  }
  return storageInstance;
}

export function resetLabelStorageService(): void {
  storageInstance = null;
}
