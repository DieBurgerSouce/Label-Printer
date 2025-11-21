import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Image Download Service
 * Downloads product images from source URLs and saves them locally
 */
export class ImageDownloadService {
  private uploadDir: string;

  constructor(uploadDir: string = path.join(__dirname, '../../uploads/products')) {
    this.uploadDir = uploadDir;

    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Download image from URL and save locally
   * @param imageUrl - Source URL of the image
   * @param articleNumber - Article number for filename
   * @returns Local URL path or null if download failed
   */
  async downloadImage(imageUrl: string, articleNumber: string): Promise<string | null> {
    if (!imageUrl || imageUrl.trim() === '') {
      console.log(`[ImageDownloadService] No image URL provided for article ${articleNumber}`);
      return null;
    }

    try {
      console.log(`[ImageDownloadService] Downloading image for ${articleNumber} from: ${imageUrl}`);

      // Download image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Get file extension from content-type or URL
      let extension = 'jpg';
      const contentType = response.headers['content-type'];
      if (contentType) {
        if (contentType.includes('png')) extension = 'png';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
        else if (contentType.includes('webp')) extension = 'webp';
        else if (contentType.includes('gif')) extension = 'gif';
      } else {
        // Fallback: get from URL
        const urlExtension = imageUrl.split('.').pop()?.toLowerCase();
        if (urlExtension && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExtension)) {
          extension = urlExtension === 'jpeg' ? 'jpg' : urlExtension;
        }
      }

      // Generate filename: articleNumber-hash.extension
      const hash = crypto.createHash('md5').update(imageUrl).digest('hex').substring(0, 8);
      const filename = `${articleNumber}-${hash}.${extension}`;
      const filepath = path.join(this.uploadDir, filename);

      // Save image
      fs.writeFileSync(filepath, response.data);

      // Return local URL path
      const localUrl = `/api/images/products/${filename}`;
      console.log(`[ImageDownloadService] ✅ Image saved: ${localUrl}`);

      return localUrl;

    } catch (error: any) {
      console.error(`[ImageDownloadService] ❌ Failed to download image for ${articleNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Download multiple images (e.g., product image + thumbnail)
   * @param images - Array of {url, type} objects
   * @param articleNumber - Article number for filenames
   * @returns Object with local URLs for each image type
   */
  async downloadImages(
    images: Array<{ url: string; type: 'product' | 'thumbnail' }>,
    articleNumber: string
  ): Promise<{ productImage: string | null; thumbnail: string | null }> {
    const result = {
      productImage: null as string | null,
      thumbnail: null as string | null
    };

    for (const image of images) {
      const localUrl = await this.downloadImage(image.url, `${articleNumber}-${image.type}`);

      if (image.type === 'product') {
        result.productImage = localUrl;
      } else if (image.type === 'thumbnail') {
        result.thumbnail = localUrl;
      }
    }

    return result;
  }

  /**
   * Check if image file exists locally
   */
  imageExists(filename: string): boolean {
    const filepath = path.join(this.uploadDir, filename);
    return fs.existsSync(filepath);
  }

  /**
   * Clean up old images for an article
   */
  async cleanupOldImages(articleNumber: string): Promise<void> {
    try {
      const files = fs.readdirSync(this.uploadDir);
      const articleFiles = files.filter(f => f.startsWith(`${articleNumber}-`));

      for (const file of articleFiles) {
        const filepath = path.join(this.uploadDir, file);
        fs.unlinkSync(filepath);
        console.log(`[ImageDownloadService] Deleted old image: ${file}`);
      }
    } catch (error: any) {
      console.error(`[ImageDownloadService] Failed to cleanup old images:`, error.message);
    }
  }
}
