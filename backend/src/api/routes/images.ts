/**
 * Images Router
 * Serves screenshot images and other media files
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base paths for different image types - adjusted for correct directory structure
// __dirname is in src/api/routes, we need to go up 3 levels to backend, then into data
const SCREENSHOTS_DIR = path.join(__dirname, '../../../data/screenshots');
const LABELS_DIR = path.join(__dirname, '../../../data/labels');

console.log('Images route initialized. Screenshots dir:', SCREENSHOTS_DIR);
console.log('Current __dirname:', __dirname);

/**
 * GET /api/images/screenshots/:jobId/:articleNumber/:filename
 * Serve screenshot images
 */
router.get('/screenshots/:jobId/:articleNumber/:filename', (req, res) => {
  try {
    const { jobId, articleNumber, filename } = req.params;

    // Construct the full path
    const imagePath = path.join(SCREENSHOTS_DIR, jobId, articleNumber, filename);

    console.log('Image request:', { jobId, articleNumber, filename });
    console.log('Looking for image at:', imagePath);
    console.log('File exists:', fs.existsSync(imagePath));

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.log('Image not found at path:', imagePath);
      return res.status(404).json({
        success: false,
        error: 'Image not found',
        path: imagePath
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
    console.error('Error serving screenshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve image'
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

    // Construct the full path
    const imagePath = path.join(LABELS_DIR, filename);

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: 'Label image not found'
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
    console.error('Error serving label:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve label'
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
    const dirPath = path.join(SCREENSHOTS_DIR, jobId, articleNumber);

    if (!fs.existsSync(dirPath)) {
      return res.json({
        success: true,
        images: []
      });
    }

    const files = fs.readdirSync(dirPath)
      .filter(file => ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(path.extname(file).toLowerCase()))
      .map(file => ({
        filename: file,
        url: `/api/images/screenshots/${jobId}/${articleNumber}/${file}`,
        size: fs.statSync(path.join(dirPath, file)).size
      }));

    res.json({
      success: true,
      images: files
    });
  } catch (error) {
    console.error('Error listing images:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list images'
    });
  }
});

export default router;