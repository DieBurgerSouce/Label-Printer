import ImageKit from 'imagekit';

// ImageKit Configuration
const publicKey = process.env.IMAGEKIT_PUBLIC_KEY!;
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY!;
const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT!;

if (!publicKey || !privateKey || !urlEndpoint) {
  throw new Error('Missing ImageKit credentials in environment variables');
}

export const imagekit = new ImageKit({
  publicKey,
  privateKey,
  urlEndpoint,
});

// Helper Functions for Image Upload

export interface UploadImageOptions {
  file: Buffer | string; // Buffer or base64 string
  fileName: string;
  folder?: string; // e.g., 'screenshots', 'labels', 'thumbnails'
  tags?: string[];
  useUniqueFileName?: boolean;
}

export interface UploadImageResult {
  fileId: string;
  fileName: string;
  url: string;
  thumbnailUrl: string;
  fileType: string;
  filePath: string;
  width: number;
  height: number;
  size: number; // in bytes
}

/**
 * Upload image to ImageKit
 */
export async function uploadImage(options: UploadImageOptions): Promise<UploadImageResult> {
  try {
    const response = await imagekit.upload({
      file: options.file,
      fileName: options.fileName,
      folder: options.folder || 'uploads',
      tags: options.tags,
      useUniqueFileName: options.useUniqueFileName ?? true,
    });

    return {
      fileId: response.fileId,
      fileName: response.name,
      url: response.url,
      thumbnailUrl: response.thumbnailUrl,
      fileType: response.fileType,
      filePath: response.filePath,
      width: response.width,
      height: response.height,
      size: response.size,
    };
  } catch (error) {
    console.error('ImageKit upload error:', error);
    throw new Error(`Failed to upload image: ${error}`);
  }
}

/**
 * Delete image from ImageKit
 */
export async function deleteImage(fileId: string): Promise<void> {
  try {
    await imagekit.deleteFile(fileId);
  } catch (error) {
    console.error('ImageKit delete error:', error);
    throw new Error(`Failed to delete image: ${error}`);
  }
}

/**
 * Get image details from ImageKit
 */
export async function getImageDetails(fileId: string): Promise<any> {
  try {
    return await imagekit.getFileDetails(fileId);
  } catch (error) {
    console.error('ImageKit get details error:', error);
    throw new Error(`Failed to get image details: ${error}`);
  }
}

/**
 * Generate transformation URL
 * Example: Resize to 300x300, format webp, quality 80
 */
export function getImageUrl(
  filePath: string,
  transformations?: {
    width?: number;
    height?: number;
    format?: string;
    quality?: number;
  }
): string {
  const transformArray = [];

  if (transformations?.width) {
    transformArray.push(`w-${transformations.width}`);
  }
  if (transformations?.height) {
    transformArray.push(`h-${transformations.height}`);
  }
  if (transformations?.format) {
    transformArray.push(`f-${transformations.format}`);
  }
  if (transformations?.quality) {
    transformArray.push(`q-${transformations.quality}`);
  }

  const transformString = transformArray.length > 0 ? `tr:${transformArray.join(',')}/` : '';

  return `${urlEndpoint}/${transformString}${filePath}`;
}

/**
 * Bulk delete images
 */
export async function bulkDeleteImages(fileIds: string[]): Promise<void> {
  try {
    await imagekit.bulkDeleteFiles(fileIds);
  } catch (error) {
    console.error('ImageKit bulk delete error:', error);
    throw new Error(`Failed to bulk delete images: ${error}`);
  }
}

export default imagekit;
