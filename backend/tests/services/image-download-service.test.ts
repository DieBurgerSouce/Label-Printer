/**
 * Image Download Service Tests
 * Tests for downloading and managing product images
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([]),
  unlinkSync: vi.fn(),
}));

import axios from 'axios';
import { ImageDownloadService } from '../../src/services/image-download-service';

describe('ImageDownloadService', () => {
  let service: ImageDownloadService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ImageDownloadService('./test-uploads');
  });

  describe('constructor', () => {
    it('should create upload directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false);

      new ImageDownloadService('./new-uploads');

      expect(fs.mkdirSync).toHaveBeenCalledWith('./new-uploads', { recursive: true });
    });

    it('should not create directory if it already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true);

      new ImageDownloadService('./existing-uploads');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('downloadImage', () => {
    it('should return null for empty URL', async () => {
      const result = await service.downloadImage('', 'ART-001');

      expect(result).toBeNull();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should return null for whitespace-only URL', async () => {
      const result = await service.downloadImage('   ', 'ART-001');

      expect(result).toBeNull();
    });

    it('should download image and return local URL', async () => {
      const mockImageData = Buffer.from('fake-image-data');
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockImageData,
        headers: { 'content-type': 'image/jpeg' },
      });

      const result = await service.downloadImage('https://example.com/image.jpg', 'ART-001');

      expect(result).not.toBeNull();
      expect(result).toMatch(/^\/api\/images\/products\/ART-001-[a-f0-9]+\.jpg$/);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should detect PNG from content-type', async () => {
      const mockImageData = Buffer.from('fake-png-data');
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockImageData,
        headers: { 'content-type': 'image/png' },
      });

      const result = await service.downloadImage('https://example.com/image', 'ART-002');

      expect(result).toMatch(/\.png$/);
    });

    it('should detect WebP from content-type', async () => {
      const mockImageData = Buffer.from('fake-webp-data');
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockImageData,
        headers: { 'content-type': 'image/webp' },
      });

      const result = await service.downloadImage('https://example.com/image', 'ART-003');

      expect(result).toMatch(/\.webp$/);
    });

    it('should detect GIF from content-type', async () => {
      const mockImageData = Buffer.from('fake-gif-data');
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockImageData,
        headers: { 'content-type': 'image/gif' },
      });

      const result = await service.downloadImage('https://example.com/image', 'ART-004');

      expect(result).toMatch(/\.gif$/);
    });

    it('should fallback to URL extension if no content-type', async () => {
      const mockImageData = Buffer.from('fake-png-data');
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockImageData,
        headers: {},
      });

      const result = await service.downloadImage('https://example.com/image.png', 'ART-005');

      expect(result).toMatch(/\.png$/);
    });

    it('should default to jpg if no extension can be determined', async () => {
      const mockImageData = Buffer.from('fake-image-data');
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockImageData,
        headers: {},
      });

      const result = await service.downloadImage('https://example.com/image', 'ART-006');

      expect(result).toMatch(/\.jpg$/);
    });

    it('should return null on download error', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.downloadImage('https://example.com/image.jpg', 'ART-007');

      expect(result).toBeNull();
    });

    it('should generate unique filenames using hash', async () => {
      const mockImageData = Buffer.from('fake-image-data');
      vi.mocked(axios.get).mockResolvedValue({
        data: mockImageData,
        headers: { 'content-type': 'image/jpeg' },
      });

      const result1 = await service.downloadImage('https://example.com/image1.jpg', 'ART-008');
      const result2 = await service.downloadImage('https://example.com/image2.jpg', 'ART-008');

      // Different URLs should produce different hashes
      expect(result1).not.toEqual(result2);
    });

    it('should call axios with correct options', async () => {
      const mockImageData = Buffer.from('fake-image-data');
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockImageData,
        headers: { 'content-type': 'image/jpeg' },
      });

      await service.downloadImage('https://example.com/image.jpg', 'ART-009');

      expect(axios.get).toHaveBeenCalledWith('https://example.com/image.jpg', {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
    });
  });

  describe('downloadImages', () => {
    it('should download both product and thumbnail images', async () => {
      const mockImageData = Buffer.from('fake-image-data');
      vi.mocked(axios.get).mockResolvedValue({
        data: mockImageData,
        headers: { 'content-type': 'image/jpeg' },
      });

      const images = [
        { url: 'https://example.com/product.jpg', type: 'product' as const },
        { url: 'https://example.com/thumb.jpg', type: 'thumbnail' as const },
      ];

      const result = await service.downloadImages(images, 'ART-010');

      expect(result.productImage).not.toBeNull();
      expect(result.thumbnail).not.toBeNull();
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    it('should return null for failed downloads', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

      const images = [{ url: 'https://example.com/product.jpg', type: 'product' as const }];

      const result = await service.downloadImages(images, 'ART-011');

      expect(result.productImage).toBeNull();
      expect(result.thumbnail).toBeNull();
    });

    it('should handle partial success', async () => {
      const mockImageData = Buffer.from('fake-image-data');

      // First call succeeds, second fails
      vi.mocked(axios.get)
        .mockResolvedValueOnce({
          data: mockImageData,
          headers: { 'content-type': 'image/jpeg' },
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const images = [
        { url: 'https://example.com/product.jpg', type: 'product' as const },
        { url: 'https://example.com/thumb.jpg', type: 'thumbnail' as const },
      ];

      const result = await service.downloadImages(images, 'ART-012');

      expect(result.productImage).not.toBeNull();
      expect(result.thumbnail).toBeNull();
    });

    it('should handle empty images array', async () => {
      const result = await service.downloadImages([], 'ART-013');

      expect(result.productImage).toBeNull();
      expect(result.thumbnail).toBeNull();
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('imageExists', () => {
    it('should return true if image file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true);

      const result = service.imageExists('ART-001-abc123.jpg');

      expect(result).toBe(true);
    });

    it('should return false if image file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false);

      const result = service.imageExists('ART-001-abc123.jpg');

      expect(result).toBe(false);
    });

    it('should check correct filepath', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true);

      service.imageExists('test-image.jpg');

      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('test-image.jpg'));
    });
  });

  describe('cleanupOldImages', () => {
    it('should delete files matching article number', async () => {
      vi.mocked(fs.readdirSync).mockReturnValueOnce([
        'ART-001-abc123.jpg',
        'ART-001-def456.png',
        'ART-002-ghi789.jpg',
      ] as any);

      await service.cleanupOldImages('ART-001');

      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
    });

    it('should not delete files from other articles', async () => {
      vi.mocked(fs.readdirSync).mockReturnValueOnce([
        'ART-002-abc123.jpg',
        'ART-003-def456.png',
      ] as any);

      await service.cleanupOldImages('ART-001');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should handle empty directory', async () => {
      vi.mocked(fs.readdirSync).mockReturnValueOnce([]);

      await service.cleanupOldImages('ART-001');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(fs.readdirSync).mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      await expect(service.cleanupOldImages('ART-001')).resolves.not.toThrow();
    });
  });
});
