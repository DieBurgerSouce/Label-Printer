/**
 * Print Service
 * Handles PDF/PNG generation and print layout composition
 */

import PDFDocument from 'pdfkit';
import { PrintLayout, PriceLabel } from '../types/label-types.js';

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
   * Generate PDF from print layout
   */
  static async generatePDF(
    layout: PrintLayout,
    labels: PriceLabel[]
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      // Create PDF document
      const doc = new PDFDocument({
        size: [
          layout.paperFormat.width * 2.83465, // mm to points
          layout.paperFormat.height * 2.83465,
        ],
        margin: 0,
      });

      // Collect chunks
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Draw labels in grid
      this.drawLabelsGrid(doc, layout, labels);

      // Finalize PDF
      doc.end();
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

    // Draw label content
    const padding = 10;
    const contentX = x + padding;
    const contentY = y + padding;
    const contentWidth = width - 2 * padding;

    // Article number
    doc
      .fontSize(8)
      .text(label.articleNumber, contentX, contentY, {
        width: contentWidth,
        align: 'left',
      });

    // Product name
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(label.productName, contentX, contentY + 15, {
        width: contentWidth,
        align: 'left',
      });

    // Price
    const priceText = `${label.priceInfo.price.toFixed(2)} ${label.priceInfo.currency}`;
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(priceText, contentX, contentY + 35, {
        width: contentWidth,
        align: 'right',
      });

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
    _layout: PrintLayout,
    _labels: PriceLabel[]
  ): Promise<string> {
    // For now, we return a placeholder
    // In real implementation, this would use Sharp to convert PDF to PNG
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
}
