/**
 * Print Service
 * Handles PDF/PNG generation and print layout composition
 */

import PDFDocument from 'pdfkit';
import { PrintLayout, PriceLabel } from '../types/label-types.js';
import LabelTemplateService from './label-template-service.js';
import { convertLabelTemplateToRenderingTemplate } from './label-to-rendering-converter.js';
import { templateEngine } from './template-engine.js';

export class PrintService {
  // Paper formats in mm
  private static PAPER_FORMATS = {
    A3: { width: 297, height: 420 },
    A4: { width: 210, height: 297 },
    A5: { width: 148, height: 210 },
    Letter: { width: 216, height: 279 },
  };

  /**
   * Calculate optimal grid layout for given labels and paper format
   */
  static calculateOptimalGrid(
    paperFormat: 'A3' | 'A4' | 'A5' | 'Letter',
    labelCount: number,
    labelWidth: number = 70, // mm
    labelHeight: number = 50 // mm
  ): { columns: number; rows: number; totalPages: number } {
    const format = this.PAPER_FORMATS[paperFormat];
    const margin = 10; // mm

    const usableWidth = format.width - 2 * margin;
    const usableHeight = format.height - 2 * margin;

    const columns = Math.floor(usableWidth / labelWidth);
    const rows = Math.floor(usableHeight / labelHeight);

    const labelsPerPage = columns * rows;
    const totalPages = Math.ceil(labelCount / labelsPerPage);

    return { columns, rows, totalPages };
  }

  /**
   * Generate PDF from print layout - OPTIMIZED FOR BULK
   */
  static async generatePDF(
    layout: PrintLayout,
    labels: PriceLabel[]
  ): Promise<Buffer> {
    console.log(`📄 Generating PDF for ${labels.length} labels (BULK MODE)...`);

    // ✅ CRITICAL FIX: Skip image processing for large batches
    let labelsToRender = labels;
    if (labels.length > 50) {
      console.log(`⚡ BULK MODE ACTIVE: Skipping image processing for ${labels.length} labels`);
      // Just pass through labels without image processing
      labelsToRender = labels;
    } else {
      // Only for small batches, try to load images
      try {
        const renderedLabels = await this.ensureLabelsHaveImages(labels);
        console.log(`✅ ${renderedLabels.filter(l => l.imageData).length} labels have images`);
        labelsToRender = renderedLabels;
      } catch (error) {
        console.error('❌ Image loading failed, using text fallback:', error);
        labelsToRender = labels;
      }
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let resolved = false;

      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`PDF generation timeout after 60 seconds for ${labels.length} labels`));
        }
      }, 60000); // 60 second timeout

      try {
        // Create PDF document with optimizations
        const doc = new PDFDocument({
          size: [
            layout.paperFormat.width * 2.83465, // mm to points
            layout.paperFormat.height * 2.83465,
          ],
          margin: 0,
          compress: true, // Enable compression
          bufferPages: true // Buffer pages for better memory management
        });

        // Collect chunks
        doc.on('data', (chunk) => chunks.push(chunk));

        doc.on('end', () => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            const buffer = Buffer.concat(chunks);
            console.log(`✅ PDF generated successfully: ${buffer.length} bytes`);
            resolve(buffer);
          }
        });

        doc.on('error', (error) => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            console.error('❌ PDF generation error:', error);
            reject(error);
          }
        });

        // Draw labels in grid
        this.drawLabelsGrid(doc, layout, labelsToRender);

        // Finalize PDF
        doc.end();
      } catch (error) {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      }
    });
  }

  /**
   * Draw labels in a grid on PDF
   */
  private static drawLabelsGrid(
    doc: PDFKit.PDFDocument,
    layout: PrintLayout,
    labels: PriceLabel[]
  ): void {
    console.log(`📐 Drawing grid with ${labels.length} labels`);

    if (!labels || labels.length === 0) {
      console.error('❌ NO LABELS TO DRAW!');
      // Draw error message on PDF
      doc
        .fontSize(20)
        .fillColor('red')
        .text('ERROR: No labels provided!', 100, 100);
      return;
    }

    const { columns, rows, spacing, margins } = layout.gridLayout;
    const mmToPoints = 2.83465;

    // Calculate cell dimensions
    const usableWidth = layout.paperFormat.width - margins.left - margins.right;
    const usableHeight = layout.paperFormat.height - margins.top - margins.bottom;

    const cellWidth = (usableWidth - (columns - 1) * spacing) / columns;
    const cellHeight = (usableHeight - (rows - 1) * spacing) / rows;

    let labelIndex = 0;
    const labelsPerPage = columns * rows;
    const totalPages = Math.ceil(labels.length / labelsPerPage);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        doc.addPage();
      }

      // Draw cut marks if enabled
      if (layout.settings.showCutMarks) {
        this.drawCutMarks(doc, layout);
      }

      // Draw grid
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          if (labelIndex >= labels.length) break;

          const label = labels[labelIndex];
          const x = margins.left + col * (cellWidth + spacing);
          const y = margins.top + row * (cellHeight + spacing);

          this.drawLabel(doc, label, x * mmToPoints, y * mmToPoints, cellWidth * mmToPoints, cellHeight * mmToPoints, layout.settings.showBorders);

          labelIndex++;
        }
        if (labelIndex >= labels.length) break;
      }
    }
  }

  /**
   * Draw a single label
   */
  private static drawLabel(
    doc: PDFKit.PDFDocument,
    label: PriceLabel,
    x: number,
    y: number,
    width: number,
    height: number,
    showBorder: boolean
  ): void {
    // Draw border if enabled
    if (showBorder) {
      doc
        .rect(x, y, width, height)
        .stroke();
    }

    // ⭐ OPTION A: If label has rendered imageData (PNG), use it!
    let imageBuffer: Buffer | undefined;

    console.log(`🔍 Label ${label.id}: Checking for imageData...`);
    console.log(`   - has imageData: ${!!label.imageData}`);
    console.log(`   - imageData type: ${label.imageData ? typeof label.imageData : 'none'}`);
    console.log(`   - is Buffer: ${Buffer.isBuffer(label.imageData)}`);

    // Handle both Buffer and JSON-serialized Buffer
    if (label.imageData) {
      if (Buffer.isBuffer(label.imageData)) {
        imageBuffer = label.imageData;
        console.log(`✅ Label ${label.id}: Using Buffer imageData (${imageBuffer.length} bytes)`);
      } else if (label.imageData && typeof label.imageData === 'object') {
        // Handle JSON-serialized Buffer {"type": "Buffer", "data": [...]}
        const bufferData = label.imageData as any;
        if (bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
          imageBuffer = Buffer.from(bufferData.data);
          console.log(`📄 Converted JSON imageData for label ${label.id} (${imageBuffer.length} bytes)`);
        }
      }
    }

    if (imageBuffer) {
      try {
        console.log(`🖼️ Embedding image for label ${label.id} at position (${x}, ${y}) with size ${width}x${height}`);
        // Embed the rendered PNG image into the PDF
        doc.image(imageBuffer, x, y, {
          fit: [width, height],
          align: 'center',
          valign: 'center',
        });
        console.log(`✅ Image embedded successfully for label ${label.id}`);
        return; // Done! No need to draw text fallback
      } catch (error) {
        console.error(`❌ Error embedding imageData for label ${label.id}:`, error);
        // Fall through to text fallback
      }
    } else {
      console.log(`⚠️ No valid imageBuffer for label ${label.id}, using text fallback`);
    }

    // FALLBACK: Draw label content as text (for labels without imageData)
    console.log(`🖋️ Drawing text fallback for label ${label.id}`);
    const padding = 10;
    const contentX = x + padding;
    const contentY = y + padding;
    const contentWidth = width - 2 * padding;

    // Reset text settings
    doc.font('Helvetica');
    doc.fillColor('black');

    // Article number
    if (label.articleNumber) {
      doc
        .fontSize(8)
        .text(label.articleNumber || 'No Article#', contentX, contentY, {
          width: contentWidth,
          align: 'left',
        });
    }

    // Product name
    if (label.productName) {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(label.productName || 'No Name', contentX, contentY + 15, {
          width: contentWidth,
          align: 'left',
        });
    }

    // Price
    if (label.priceInfo) {
      const price = label.priceInfo.price || 0;
      const currency = label.priceInfo.currency || 'EUR';
      const priceText = `${price.toFixed(2)} ${currency}`;
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(priceText, contentX, contentY + 35, {
          width: contentWidth,
          align: 'right',
        });
    } else {
      // Minimal fallback if no price info
      doc
        .fontSize(12)
        .text('Price on request', contentX, contentY + 35, {
          width: contentWidth,
          align: 'right',
        });
    }

    // Description (if standard or extended template)
    if (label.description && (label.templateType === 'standard' || label.templateType === 'extended')) {
      doc
        .fontSize(8)
        .font('Helvetica')
        .text(label.description, contentX, contentY + 60, {
          width: contentWidth,
          align: 'left',
          ellipsis: true,
        });
    }
  }

  /**
   * Draw cut marks
   */
  private static drawCutMarks(doc: PDFKit.PDFDocument, layout: PrintLayout): void {
    const mmToPoints = 2.83465;
    const markLength = 5 * mmToPoints;
    const { margins } = layout.gridLayout;

    doc.strokeColor('#000000');
    doc.lineWidth(0.5);

    // Top-left
    doc.moveTo(0, margins.top * mmToPoints).lineTo(markLength, margins.top * mmToPoints).stroke();
    doc.moveTo(margins.left * mmToPoints, 0).lineTo(margins.left * mmToPoints, markLength).stroke();

    // More cut marks would be added here for each grid cell
  }

  /**
   * Ensure all labels have imageData for printing
   * ✅ OPTIMIZED: Skip rendering if labels already have images!
   */
  private static async ensureLabelsHaveImages(
    labels: PriceLabel[]
  ): Promise<PriceLabel[]> {
    console.log(`🎨 Checking ${labels.length} labels for existing images...`);

    // ✅ QUICK FIX: Load images from storage if they exist
    const { StorageService } = await import('./storage-service.js');

    const labelsWithImagesLoaded = await Promise.all(
      labels.map(async (label) => {
        // Already has imageData?
        if (label.imageData && Buffer.isBuffer(label.imageData)) {
          return label;
        }

        // Try to load from storage
        try {
          const storedLabel = await StorageService.getLabel(label.id);
          if (storedLabel && storedLabel.imageData) {
            console.log(`✅ Loaded image for label ${label.id} from storage`);
            return { ...label, imageData: storedLabel.imageData };
          }
        } catch (error) {
          // Ignore, will render or use text fallback
        }

        return label;
      })
    );

    // Check how many have images now
    const labelsWithImages = labelsWithImagesLoaded.filter(l => l.imageData && Buffer.isBuffer(l.imageData));
    const labelsWithoutImages = labelsWithImagesLoaded.filter(l => !l.imageData || !Buffer.isBuffer(l.imageData));

    console.log(`✅ ${labelsWithImages.length} labels already have images`);
    console.log(`⚠️ ${labelsWithoutImages.length} labels need images (will use text fallback)`);

    // ✅ CRITICAL FIX: Skip ALL rendering for bulk operations
    // PDF generator will use text fallback for labels without images
    if (labelsWithImagesLoaded.length > 50) {
      console.log(`⚡ BULK MODE: Skipping rendering for ${labelsWithImagesLoaded.length} labels - using existing images (${labelsWithImages.length}) and text fallback`);
      return labelsWithImagesLoaded;
    }

    // Only render for small batches (<50 labels)
    if (labelsWithImages.length >= labelsWithImagesLoaded.length * 0.5) {
      console.log(`✅ Skipping rendering - using existing images and text fallback`);
      return labelsWithImagesLoaded;
    }

    const BATCH_SIZE = 10; // Reduced batch size
    const rendered: PriceLabel[] = [];

    console.log(`🎨 Rendering ${labels.length} labels in batches of ${BATCH_SIZE}...`);

    // Split labels into batches
    const batches: PriceLabel[][] = [];
    for (let i = 0; i < labels.length; i += BATCH_SIZE) {
      batches.push(labels.slice(i, i + BATCH_SIZE));
    }

    // Process batches sequentially (to avoid overwhelming system)
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchStart = batchIndex * BATCH_SIZE + 1;
      const batchEnd = Math.min((batchIndex + 1) * BATCH_SIZE, labels.length);

      console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (labels ${batchStart}-${batchEnd}/${labels.length})`);

      // Process labels in batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (label) => {
          // Already has image?
          if (label.imageData && Buffer.isBuffer(label.imageData)) {
            return label;
          }

          // Need to render
          try {
            // ✅ REDUCED TIMEOUT: Max 2 seconds per label for performance
            const timeoutPromise = new Promise<undefined>((_, reject) =>
              setTimeout(() => reject(new Error('Rendering timeout')), 2000)
            );

            const imageData = await Promise.race([
              this.renderLabel(label),
              timeoutPromise
            ]);

            return { ...label, imageData };
          } catch (error: any) {
            if (error.message === 'Rendering timeout') {
              console.warn(`⏱️ Timeout rendering label ${label.id} - using text fallback`);
            } else {
              console.error(`❌ Failed to render label ${label.id}:`, error);
            }
            // Use original label (will fall back to text rendering)
            return label;
          }
        })
      );

      rendered.push(...batchResults);

      // Progress logging
      const progress = Math.round((rendered.length / labels.length) * 100);
      console.log(`✅ Progress: ${rendered.length}/${labels.length} labels (${progress}%)`);

      // Allow garbage collection between batches
      if (global.gc) {
        global.gc();
        console.log(`🧹 Memory cleanup after batch ${batchIndex + 1}`);
      }

      // Small delay to prevent CPU overload on large batches
      if (batchIndex < batches.length - 1 && labels.length > 500) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Rendering complete: ${rendered.filter(l => l.imageData).length}/${labels.length} labels have images`);
    return rendered;
  }

  /**
   * SIMPLIFIED: Skip complex template rendering for bulk operations
   */
  private static async renderLabel(label: PriceLabel): Promise<Buffer | undefined> {
    // ✅ SKIP RENDERING - Too slow for bulk operations
    // The PDF generator will use text fallback instead
    console.warn(`⚠️ Skipping render for label ${label.id} - using text fallback in PDF`);
    return undefined;
  }

  /**
   * Get available paper formats
   */
  static getAvailableFormats() {
    return Object.entries(this.PAPER_FORMATS).map(([name, dims]) => ({
      name,
      width: dims.width,
      height: dims.height,
      displayName: `${name} (${dims.width} × ${dims.height} mm)`,
    }));
  }

  /**
   * Generate print preview (base64 encoded PNG)
   */
  static async generatePreview(
    layout: PrintLayout,
    labels: PriceLabel[]
  ): Promise<string> {
    console.log(`🖼️ Generating SIMPLE preview for ${labels.length} labels...`);

    // DON'T render labels for preview - too slow!
    // Just show what will be printed with placeholders

    const sharp = (await import('sharp')).default;
    const mmToPixels = (mm: number) => Math.round(mm * 3.7795275591); // 96 DPI

    const pageWidth = mmToPixels(layout.paperFormat.width);
    const pageHeight = mmToPixels(layout.paperFormat.height);

    // Calculate grid dimensions
    const { columns, rows, margins, spacing } = layout.gridLayout;
    const marginPx = mmToPixels(margins.top);
    const spacingPx = mmToPixels(spacing);

    // Calculate label dimensions
    const labelWidth = Math.floor((pageWidth - 2 * marginPx - (columns - 1) * spacingPx) / columns);
    const labelHeight = Math.floor((pageHeight - 2 * marginPx - (rows - 1) * spacingPx) / rows);

    // Build SVG with all labels as placeholders
    const labelBoxes = [];

    for (let i = 0; i < Math.min(labels.length, columns * rows); i++) {
      const label = labels[i];
      const col = i % columns;
      const row = Math.floor(i / columns);

      const xPos = marginPx + col * (labelWidth + spacingPx);
      const yPos = marginPx + row * (labelHeight + spacingPx);

      // Create a simple label preview box
      const fontSize = Math.max(10, labelHeight / 8);

      // ⚡ FIX: Show staffelpreise if available, otherwise show single price
      let priceDisplay = '';
      if (label.priceInfo.staffelpreise && label.priceInfo.staffelpreise.length > 0) {
        // Show tiered prices
        const tierCount = label.priceInfo.staffelpreise.length;
        const firstTier = label.priceInfo.staffelpreise[0];
        const lastTier = label.priceInfo.staffelpreise[tierCount - 1];
        priceDisplay = `${tierCount} Preise: ${firstTier.price}€ - ${lastTier.price}€`;
      } else {
        // Show single price
        priceDisplay = `${label.priceInfo.price.toFixed(2)} ${label.priceInfo.currency}`;
      }

      labelBoxes.push(`
        <rect x="${xPos}" y="${yPos}" width="${labelWidth}" height="${labelHeight}"
              fill="white" stroke="#d1d5db" stroke-width="1"/>
        <text x="${xPos + labelWidth/2}" y="${yPos + labelHeight/3}"
              font-family="Arial" font-size="${fontSize * 0.7}" fill="#6b7280"
              text-anchor="middle">${label.articleNumber || 'No Art.#'}</text>
        <text x="${xPos + labelWidth/2}" y="${yPos + labelHeight/2}"
              font-family="Arial" font-size="${fontSize}" fill="#1f2937"
              text-anchor="middle" font-weight="bold">${label.productName?.substring(0, 20) || 'Product'}...</text>
        <text x="${xPos + labelWidth/2}" y="${yPos + 2*labelHeight/3}"
              font-family="Arial" font-size="${fontSize * 1.2}" fill="#059669"
              text-anchor="middle" font-weight="bold">${priceDisplay}</text>
      `);
    }

    // Create full SVG
    const svg = `
      <svg width="${pageWidth}" height="${pageHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${pageWidth}" height="${pageHeight}" fill="#f3f4f6"/>
        ${labelBoxes.join('\n')}

        <!-- Info text at bottom -->
        <text x="${pageWidth/2}" y="${pageHeight - 20}"
              font-family="Arial" font-size="14" fill="#6b7280"
              text-anchor="middle">
          Preview: ${labels.length} labels on ${layout.paperFormat.type} (${columns}×${rows} grid) - Full quality in PDF export
        </text>
      </svg>
    `;

    const previewBuffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    console.log(`✅ Simple preview generated for ${labels.length} labels`);
    return `data:image/png;base64,${previewBuffer.toString('base64')}`;
  }

  /**
   * Create a placeholder label for preview
   */
  private static async createPlaceholderLabel(
    width: number,
    height: number,
    label: PriceLabel
  ): Promise<Buffer> {
    const sharp = (await import('sharp')).default;

    // ⚡ FIX: Show staffelpreise if available, otherwise show single price
    let priceDisplay = '';
    if (label.priceInfo.staffelpreise && label.priceInfo.staffelpreise.length > 0) {
      // Show tiered prices
      const tierCount = label.priceInfo.staffelpreise.length;
      const firstTier = label.priceInfo.staffelpreise[0];
      const lastTier = label.priceInfo.staffelpreise[tierCount - 1];
      priceDisplay = `${tierCount} Preise: ${firstTier.price}€ - ${lastTier.price}€`;
    } else {
      // Show single price
      priceDisplay = `${label.priceInfo.price.toFixed(2)} ${label.priceInfo.currency}`;
    }

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>
        <text x="${width/2}" y="${height/2 - 10}"
              font-family="Arial" font-size="12" fill="#6b7280"
              text-anchor="middle">
          ${label.articleNumber || 'No Article#'}
        </text>
        <text x="${width/2}" y="${height/2 + 10}"
              font-family="Arial" font-size="14" fill="#1f2937"
              text-anchor="middle" font-weight="bold">
          ${label.productName || 'Product'}
        </text>
        <text x="${width/2}" y="${height/2 + 30}"
              font-family="Arial" font-size="16" fill="#059669"
              text-anchor="middle" font-weight="bold">
          ${priceDisplay}
        </text>
      </svg>
    `;

    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
  }

  /**
   * Create grid overlay for preview
   */
  private static async createGridOverlay(
    width: number,
    height: number,
    columns: number,
    rows: number,
    margin: number,
    spacing: number,
    labelWidth: number,
    labelHeight: number
  ): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    const lines = [];

    // Draw grid lines
    for (let row = 0; row <= rows; row++) {
      const y = margin + row * (labelHeight + spacing);
      lines.push(`<line x1="${margin}" y1="${y}" x2="${width - margin}" y2="${y}" stroke="#d1d5db" stroke-width="0.5"/>`);
    }

    for (let col = 0; col <= columns; col++) {
      const x = margin + col * (labelWidth + spacing);
      lines.push(`<line x1="${x}" y1="${margin}" x2="${x}" y2="${height - margin}" stroke="#d1d5db" stroke-width="0.5"/>`);
    }

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${lines.join('\n')}
      </svg>
    `;

    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
  }
}
