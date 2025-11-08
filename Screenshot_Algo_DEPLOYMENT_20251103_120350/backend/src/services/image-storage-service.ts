/**
 * Image Storage Service using ImageKit
 * Handles all image upload, retrieval, and deletion operations
 */

import { imagekit, uploadImage, deleteImage, getImageUrl, bulkDeleteImages } from '../lib/imagekit.js';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES
// ============================================

export interface ImageUploadOptions {
  file: Buffer | string; // Buffer or file path
  folder: 'screenshots' | 'labels' | 'thumbnails' | 'templates';
  fileName?: string;
  generateThumbnail?: boolean;
  thumbnailSize?: { width: number; height: number };
  tags?: string[];
}

export interface ImageUploadResult {
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  thumbnailFileId?: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

// ============================================
// IMAGE STORAGE SERVICE
// ============================================

export class ImageStorageService {
  /**
   * Upload an image to ImageKit
   */
  async uploadImage(options: ImageUploadOptions): Promise<ImageUploadResult> {
    try {
      // Load image buffer if file path is provided
      let imageBuffer: Buffer;

      if (typeof options.file === 'string') {
        // File path provided
        imageBuffer = await sharp(options.file).toBuffer();
      } else {
        imageBuffer = options.file;
      }

      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();

      // Generate unique filename if not provided
      const fileName = options.fileName || `${uuidv4()}.${metadata.format || 'png'}`;

      // Upload main image
      const uploadResult = await uploadImage({
        file: imageBuffer,
        fileName,
        folder: options.folder,
        tags: options.tags,
        useUniqueFileName: !options.fileName, // Use unique name if custom name not provided
      });

      const result: ImageUploadResult = {
        fileId: uploadResult.fileId,
        url: uploadResult.url,
        width: uploadResult.width,
        height: uploadResult.height,
        size: uploadResult.size,
        format: uploadResult.fileType,
      };

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        const thumbnailSize = options.thumbnailSize || { width: 300, height: 300 };

        const thumbnailBuffer = await sharp(imageBuffer)
          .resize(thumbnailSize.width, thumbnailSize.height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer();

        const thumbnailResult = await uploadImage({
          file: thumbnailBuffer,
          fileName: `thumb_${fileName}`,
          folder: `${options.folder}/thumbnails`,
          tags: [...(options.tags || []), 'thumbnail'],
          useUniqueFileName: false,
        });

        result.thumbnailUrl = thumbnailResult.url;
        result.thumbnailFileId = thumbnailResult.fileId;
      }

      return result;
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw new Error(`Image upload failed: ${error}`);
    }
  }

  /**
   * Upload screenshot with automatic thumbnail generation
   */
  async uploadScreenshot(
    imageBuffer: Buffer,
    productUrl: string,
    jobId?: string
  ): Promise<ImageUploadResult> {
    const tags = ['screenshot'];
    if (jobId) tags.push(`job:${jobId}`);
    if (productUrl) tags.push(`product:${new URL(productUrl).hostname}`);

    return this.uploadImage({
      file: imageBuffer,
      folder: 'screenshots',
      generateThumbnail: true,
      thumbnailSize: { width: 400, height: 400 },
      tags,
    });
  }

  /**
   * Upload generated label
   */
  async uploadLabel(
    imageBuffer: Buffer,
    templateId: string,
    articleNumber?: string
  ): Promise<ImageUploadResult> {
    const tags = ['label', `template:${templateId}`];
    if (articleNumber) tags.push(`article:${articleNumber}`);

    return this.uploadImage({
      file: imageBuffer,
      folder: 'labels',
      tags,
    });
  }

  /**
   * Delete image from ImageKit
   */
  async deleteImage(fileId: string): Promise<void> {
    try {
      await deleteImage(fileId);
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw new Error(`Image deletion failed: ${error}`);
    }
  }

  /**
   * Delete multiple images
   */
  async deleteImages(fileIds: string[]): Promise<void> {
    try {
      await bulkDeleteImages(fileIds);
    } catch (error) {
      console.error('Failed to delete images:', error);
      throw new Error(`Bulk image deletion failed: ${error}`);
    }
  }

  /**
   * Get optimized image URL with transformations
   */
  getImageUrl(
    filePath: string,
    options?: {
      width?: number;
      height?: number;
      format?: 'webp' | 'jpg' | 'png';
      quality?: number;
    }
  ): string {
    return getImageUrl(filePath, options);
  }

  /**
   * Get image details
   */
  async getImageDetails(fileId: string): Promise<any> {
    try {
      return await imagekit.getFileDetails(fileId);
    } catch (error) {
      console.error('Failed to get image details:', error);
      throw new Error(`Failed to get image details: ${error}`);
    }
  }

  /**
   * Optimize image before upload
   */
  async optimizeImage(
    imageBuffer: Buffer,
    options?: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: 'png' | 'jpg' | 'webp';
    }
  ): Promise<Buffer> {
    let pipeline = sharp(imageBuffer);

    // Resize if max dimensions specified
    if (options?.maxWidth || options?.maxHeight) {
      pipeline = pipeline.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert format if specified
    if (options?.format === 'jpg') {
      pipeline = pipeline.jpeg({ quality: options?.quality || 85 });
    } else if (options?.format === 'png') {
      pipeline = pipeline.png({ quality: options?.quality || 85 });
    } else if (options?.format === 'webp') {
      pipeline = pipeline.webp({ quality: options?.quality || 85 });
    }

    return pipeline.toBuffer();
  }
}

// ============================================
// EXPORT SERVICE INSTANCE
// ============================================

export const imageStorageService = new ImageStorageService();
