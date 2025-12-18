/**
 * Images Router
 * Serves screenshot images and other media files
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger';

const router = express.Router();

// __filename and __dirname are available globally in CommonJS

// Base paths for different image types
// In Docker: __dirname = /app/dist/api/routes, data is at /app/data
// In local dev: __dirname = src/api/routes, data is at ../../data
const isDocker = process.env.NODE_ENV === 'production';
const BASE_DIR = isDocker
  ? path.join(__dirname, '../../..') // /app/dist -> /app
  : path.join(__dirname, '../../..'); // src/api/routes -> backend root

const SCREENSHOTS_DIR = path.join(BASE_DIR, 'data/screenshots');
const LABELS_DIR = path.join(BASE_DIR, 'data/labels');
const PRODUCTS_DIR = path.join(BASE_DIR, 'uploads/products');

logger.info('Images route initialized. Screenshots dir:', SCREENSHOTS_DIR);
logger.info('Products dir:', PRODUCTS_DIR);
logger.info('Current __dirname:', __dirname);
logger.info('BASE_DIR:', BASE_DIR);

/**
 * Validate that a path is safely within a base directory (Path Traversal Prevention)
 * @param baseDir - The allowed base directory
 * @param relativePath - User-provided path segments to join
 * @returns The safe absolute path, or null if path traversal attempted
 */
function getSafePath(baseDir: string, ...relativePath: string[]): string | null {
  // Normalize the base directory
  const normalizedBase = path.resolve(baseDir);

  // Join and normalize the full path
  const fullPath = path.resolve(normalizedBase, ...relativePath);

  // Ensure the resolved path starts with the base directory
  if (!fullPath.startsWith(normalizedBase + path.sep) && fullPath !== normalizedBase) {
    logger.warn(
      `Path traversal attempt blocked: ${relativePath.join('/')} resolved to ${fullPath}`
    );
    return null;
  }

  return fullPath;
}

/**
 * GET /api/images/screenshots/:jobId/:articleNumber/:filename
 * Serve screenshot images
 */
router.get('/screenshots/:jobId/:articleNumber/:filename', (req, res) => {
  try {
    const { jobId, articleNumber, filename } = req.params;

    // Construct the full path with path traversal protection
    const imagePath = getSafePath(SCREENSHOTS_DIR, jobId, articleNumber, filename);

    // Block path traversal attempts
    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Invalid path',
      });
    }

    logger.info('Image request:', { jobId, articleNumber, filename });
    logger.info('Looking for image at:', imagePath);
    logger.info('File exists:', fs.existsSync(imagePath));

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      logger.info('Image not found at path:', imagePath);
      return res.status(404).json({
        success: false,
        error: 'Image not found',
      });
    }

    // Get file extension for MIME type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/png'; // Default

    if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    }

    // Set proper headers and send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Send the file
    res.sendFile(imagePath);
  } catch (error) {
    logger.error('Error serving screenshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve image',
    });
  }
});

/**
 * GET /api/images/labels/:filename
 * Serve label images
 */
router.get('/labels/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Construct the full path with path traversal protection
    const imagePath = getSafePath(LABELS_DIR, filename);

    // Block path traversal attempts
    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Invalid path',
      });
    }

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: 'Label image not found',
      });
    }

    // Get file extension for MIME type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/png'; // Default

    if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.pdf') {
      contentType = 'application/pdf';
    }

    // Set proper headers and send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Send the file
    res.sendFile(imagePath);
  } catch (error) {
    logger.error('Error serving label:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve label',
    });
  }
});

/**
 * GET /api/images/products/:filename
 * Serve downloaded product images
 */
router.get('/products/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Construct the full path with path traversal protection
    const imagePath = getSafePath(PRODUCTS_DIR, filename);

    // Block path traversal attempts
    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Invalid path',
      });
    }

    logger.info('Product image request:', filename);
    logger.info('Looking for image at:', imagePath);

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      logger.info('Product image not found at path:', imagePath);
      return res.status(404).json({
        success: false,
        error: 'Product image not found',
      });
    }

    // Get file extension for MIME type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg'; // Default

    if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    }

    // Set proper headers and send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    // Send the file
    res.sendFile(imagePath);
  } catch (error) {
    logger.error('Error serving product image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve product image',
    });
  }
});

/**
 * GET /api/images/list/:jobId/:articleNumber
 * List all available images for an article
 */
router.get('/list/:jobId/:articleNumber', (req, res) => {
  try {
    const { jobId, articleNumber } = req.params;

    // Construct the full path with path traversal protection
    const dirPath = getSafePath(SCREENSHOTS_DIR, jobId, articleNumber);

    // Block path traversal attempts
    if (!dirPath) {
      return res.status(400).json({
        success: false,
        error: 'Invalid path',
      });
    }

    if (!fs.existsSync(dirPath)) {
      return res.json({
        success: true,
        images: [],
      });
    }

    const files = fs
      .readdirSync(dirPath)
      .filter((file) =>
        ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(path.extname(file).toLowerCase())
      )
      .map((file) => {
        const filePath = getSafePath(dirPath, file);
        return {
          filename: file,
          url: `/api/images/screenshots/${jobId}/${articleNumber}/${file}`,
          size: filePath ? fs.statSync(filePath).size : 0,
        };
      });

    res.json({
      success: true,
      images: files,
    });
  } catch (error) {
    logger.error('Error listing images:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list images',
    });
  }
});

export default router;
