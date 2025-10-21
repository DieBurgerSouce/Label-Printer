import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import * as fs from 'fs-extra';
import path from 'path';
import { createLogger } from '../utils/logger';
import {
  PrintLayout,
  PriceLabel,
  PaperFormat,
  GridConfig,
  LayoutSettings,
  ExportSettings,
  ExportFormat,
  PAPER_FORMATS,
  PaperFormatType,
  Orientation,
  DEFAULT_DPI,
  DEFAULT_GRID_SPACING,
  DEFAULT_MARGINS,
} from '../types/label-types';

const logger = createLogger('LayoutComposerService');

export interface CalculatedGrid {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  spacing: number;
}

export interface LayoutDimensions {
  pageWidth: number;
  pageHeight: number;
  gridWidth: number;
  gridHeight: number;
  cellWidth: number;
  cellHeight: number;
}

export class LayoutComposerService {
  private outputDir: string;

  constructor(outputDir: string = './data/exports') {
    this.outputDir = outputDir;
    this.init();
  }

  /**
   * Initialize service
   */
  private async init(): Promise<void> {
    try {
      await fs.ensureDir(this.outputDir);
      logger.info('LayoutComposerService initialized', { outputDir: this.outputDir });
    } catch (error) {
      logger.error('Failed to initialize LayoutComposerService', { error });
    }
  }

  /**
   * Create a print layout with labels
   */
  async createLayout(
    labels: PriceLabel[],
    paperFormat: Partial<PaperFormat>,
    gridConfig: Partial<GridConfig>,
    settings?: Partial<LayoutSettings>
  ): Promise<PrintLayout> {
    // Build complete paper format
    const completePaperFormat = this.buildPaperFormat(paperFormat);

    // Build complete grid config
    const completeGridConfig = await this.buildGridConfig(
      gridConfig,
      completePaperFormat,
      labels.length
    );

    // Build complete settings
    const completeSettings: LayoutSettings = {
      showCutMarks: settings?.showCutMarks ?? false,
      showBorders: settings?.showBorders ?? true,
      labelScale: settings?.labelScale ?? 'fit',
      dpi: settings?.dpi ?? DEFAULT_DPI,
      colorProfile: settings?.colorProfile ?? 'RGB',
      compression: settings?.compression ?? true,
      bleed: settings?.bleed ?? 0,
      rotation: settings?.rotation ?? 0,
    };

    const layout: PrintLayout = {
      id: `layout-${Date.now()}`,
      name: `Layout ${new Date().toISOString()}`,
      paperFormat: completePaperFormat,
      gridLayout: completeGridConfig,
      labels,
      settings: completeSettings,
      createdAt: new Date(),
    };

    logger.info('Print layout created', {
      layoutId: layout.id,
      labels: labels.length,
      paperFormat: completePaperFormat.type,
      grid: `${completeGridConfig.columns}x${completeGridConfig.rows}`,
    });

    return layout;
  }

  /**
   * Build complete paper format from partial config
   */
  private buildPaperFormat(partial: Partial<PaperFormat>): PaperFormat {
    const type: PaperFormatType = partial.type || 'A4';
    const defaultDimensions = PAPER_FORMATS[type];
    const orientation: Orientation = partial.orientation || 'portrait';

    let width = partial.width || defaultDimensions.width;
    let height = partial.height || defaultDimensions.height;

    // Swap dimensions if landscape
    if (orientation === 'landscape') {
      [width, height] = [height, width];
    }

    return {
      type,
      width,
      height,
      orientation,
    };
  }

  /**
   * Build complete grid config with auto-calculation if needed
   */
  private async buildGridConfig(
    partial: Partial<GridConfig>,
    paperFormat: PaperFormat,
    labelCount: number
  ): Promise<GridConfig> {
    const margins = partial.margins || DEFAULT_MARGINS;
    const spacing = partial.spacing ?? DEFAULT_GRID_SPACING;

    // If auto-calculate or not specified
    if (partial.autoCalculate !== false && (!partial.columns || !partial.rows)) {
      const calculated = this.calculateOptimalGrid(paperFormat, labelCount, margins, spacing);
      return {
        columns: calculated.columns,
        rows: calculated.rows,
        spacing,
        margins,
        autoCalculate: true,
      };
    }

    return {
      columns: partial.columns || 1,
      rows: partial.rows || 1,
      spacing,
      margins,
      autoCalculate: false,
    };
  }

  /**
   * Calculate optimal grid layout based on paper size and label count
   */
  calculateOptimalGrid(
    paperFormat: PaperFormat,
    labelCount: number,
    margins = DEFAULT_MARGINS,
    spacing = DEFAULT_GRID_SPACING
  ): CalculatedGrid {
    // Available space after margins
    const availableWidth = paperFormat.width - margins.left - margins.right;
    const availableHeight = paperFormat.height - margins.top - margins.bottom;

    // Try different grid configurations
    let bestConfig: CalculatedGrid | null = null;
    let bestWaste = Infinity;

    // Try from 1x1 to 10x10
    for (let cols = 1; cols <= 10; cols++) {
      for (let rows = 1; rows <= 10; rows++) {
        if (cols * rows < labelCount) continue;

        // Calculate cell dimensions
        const cellWidth = (availableWidth - (cols - 1) * spacing) / cols;
        const cellHeight = (availableHeight - (rows - 1) * spacing) / rows;

        // Skip if cells are too small
        if (cellWidth < 20 || cellHeight < 20) continue;

        // Calculate wasted space
        const waste = cols * rows - labelCount;

        // Calculate efficiency (prefer square-ish cells)
        const aspectRatio = cellWidth / cellHeight;
        const aspectPenalty = Math.abs(1 - aspectRatio);

        const score = waste + aspectPenalty * 5;

        if (score < bestWaste) {
          bestWaste = score;
          bestConfig = {
            columns: cols,
            rows,
            cellWidth,
            cellHeight,
            spacing,
          };
        }
      }
    }

    if (!bestConfig) {
      // Fallback to simple grid
      const cols = Math.ceil(Math.sqrt(labelCount));
      const rows = Math.ceil(labelCount / cols);
      const cellWidth = (availableWidth - (cols - 1) * spacing) / cols;
      const cellHeight = (availableHeight - (rows - 1) * spacing) / rows;

      bestConfig = { columns: cols, rows, cellWidth, cellHeight, spacing };
    }

    logger.info('Optimal grid calculated', {
      paperSize: `${paperFormat.width}x${paperFormat.height}mm`,
      labelCount,
      grid: `${bestConfig.columns}x${bestConfig.rows}`,
      cellSize: `${bestConfig.cellWidth.toFixed(1)}x${bestConfig.cellHeight.toFixed(1)}mm`,
    });

    return bestConfig;
  }

  /**
   * Calculate layout dimensions in pixels
   */
  private calculateDimensions(layout: PrintLayout): LayoutDimensions {
    const dpi = layout.settings.dpi;
    const mmToPx = dpi / 25.4;

    const pageWidth = Math.round(layout.paperFormat.width * mmToPx);
    const pageHeight = Math.round(layout.paperFormat.height * mmToPx);

    const margins = layout.gridLayout.margins;
    const gridWidth = pageWidth - Math.round((margins.left + margins.right) * mmToPx);
    const gridHeight = pageHeight - Math.round((margins.top + margins.bottom) * mmToPx);

    const spacing = Math.round(layout.gridLayout.spacing * mmToPx);
    const cols = layout.gridLayout.columns;
    const rows = layout.gridLayout.rows;

    const cellWidth = Math.round((gridWidth - (cols - 1) * spacing) / cols);
    const cellHeight = Math.round((gridHeight - (rows - 1) * spacing) / rows);

    return {
      pageWidth,
      pageHeight,
      gridWidth,
      gridHeight,
      cellWidth,
      cellHeight,
    };
  }

  /**
   * Export layout as PNG
   */
  async exportAsPNG(layout: PrintLayout, outputPath?: string): Promise<string> {
    logger.info('Exporting layout as PNG', { layoutId: layout.id });

    const dims = this.calculateDimensions(layout);
    const mmToPx = layout.settings.dpi / 25.4;

    // Create base canvas
    const canvas = sharp({
      create: {
        width: dims.pageWidth,
        height: dims.pageHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    });

    const compositeImages: Array<{ input: Buffer; top: number; left: number }> = [];

    // Position labels in grid
    const marginLeft = Math.round(layout.gridLayout.margins.left * mmToPx);
    const marginTop = Math.round(layout.gridLayout.margins.top * mmToPx);
    const spacing = Math.round(layout.gridLayout.spacing * mmToPx);

    let labelIndex = 0;
    for (let row = 0; row < layout.gridLayout.rows; row++) {
      for (let col = 0; col < layout.gridLayout.columns; col++) {
        if (labelIndex >= layout.labels.length) break;

        const label = layout.labels[labelIndex];
        if (!label.imageData) {
          labelIndex++;
          continue;
        }

        // Calculate position
        const x = marginLeft + col * (dims.cellWidth + spacing);
        const y = marginTop + row * (dims.cellHeight + spacing);

        // Resize label to fit cell
        const resized = await sharp(label.imageData)
          .resize(dims.cellWidth, dims.cellHeight, {
            fit: layout.settings.labelScale === 'fit' ? 'inside' : 'cover',
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .toBuffer();

        compositeImages.push({
          input: resized,
          top: y,
          left: x,
        });

        // Add border if enabled
        if (layout.settings.showBorders) {
          // Note: Adding borders would require overlay, simplified here
        }

        labelIndex++;
      }
    }

    // Composite all images
    let result = await canvas.composite(compositeImages).png().toBuffer();

    // Add cut marks if enabled
    if (layout.settings.showCutMarks) {
      result = await this.addCutMarks(result, layout, dims);
    }

    // Save to file
    const finalPath = outputPath || path.join(this.outputDir, `${layout.id}.png`);
    await fs.ensureDir(path.dirname(finalPath));
    await fs.writeFile(finalPath, result);

    logger.info('PNG export completed', { file: finalPath });
    return finalPath;
  }

  /**
   * Export layout as PDF
   */
  async exportAsPDF(layout: PrintLayout, outputPath?: string): Promise<string> {
    logger.info('Exporting layout as PDF', { layoutId: layout.id });

    const finalPath = outputPath || path.join(this.outputDir, `${layout.id}.pdf`);
    await fs.ensureDir(path.dirname(finalPath));

    // Convert mm to points (1mm = 2.83465 points)
    const mmToPoints = 2.83465;
    const width = layout.paperFormat.width * mmToPoints;
    const height = layout.paperFormat.height * mmToPoints;

    // Create PDF document
    const doc = new PDFDocument({
      size: [width, height],
      margins: {
        top: layout.gridLayout.margins.top * mmToPoints,
        bottom: layout.gridLayout.margins.bottom * mmToPoints,
        left: layout.gridLayout.margins.left * mmToPoints,
        right: layout.gridLayout.margins.right * mmToPoints,
      },
    });

    // Pipe to file
    const stream = fs.createWriteStream(finalPath);
    doc.pipe(stream);

    const marginLeft = layout.gridLayout.margins.left * mmToPoints;
    const marginTop = layout.gridLayout.margins.top * mmToPoints;
    const spacing = layout.gridLayout.spacing * mmToPoints;

    const dims = this.calculateDimensions(layout);
    const cellWidth = (dims.cellWidth / (layout.settings.dpi / 72)) * mmToPoints / 25.4;
    const cellHeight = (dims.cellHeight / (layout.settings.dpi / 72)) * mmToPoints / 25.4;

    // Add labels
    let labelIndex = 0;
    for (let row = 0; row < layout.gridLayout.rows; row++) {
      for (let col = 0; col < layout.gridLayout.columns; col++) {
        if (labelIndex >= layout.labels.length) break;

        const label = layout.labels[labelIndex];
        if (!label.imageData) {
          labelIndex++;
          continue;
        }

        const x = marginLeft + col * (cellWidth + spacing);
        const y = marginTop + row * (cellHeight + spacing);

        // Add image to PDF
        try {
          doc.image(label.imageData, x, y, {
            fit: [cellWidth, cellHeight],
            align: 'center',
            valign: 'center',
          });

          // Add border if enabled
          if (layout.settings.showBorders) {
            doc.rect(x, y, cellWidth, cellHeight).stroke();
          }
        } catch (error) {
          logger.warn('Failed to add label to PDF', { labelId: label.id, error });
        }

        labelIndex++;
      }
    }

    // Add cut marks if enabled
    if (layout.settings.showCutMarks) {
      this.addCutMarksToPDF(doc, layout, width, height, mmToPoints);
    }

    // Finalize PDF
    doc.end();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    logger.info('PDF export completed', { file: finalPath });
    return finalPath;
  }

  /**
   * Export layout with custom settings
   */
  async export(
    layout: PrintLayout,
    format: ExportFormat,
    settings?: Partial<ExportSettings>,
    outputPath?: string
  ): Promise<string> {
    // Update layout settings if provided
    if (settings) {
      layout.settings.dpi = settings.dpi || layout.settings.dpi;
      layout.settings.colorProfile = settings.colorProfile || layout.settings.colorProfile;
      layout.settings.compression = settings.compression ?? layout.settings.compression;
    }

    switch (format) {
      case 'pdf':
        return this.exportAsPDF(layout, outputPath);
      case 'png':
        return this.exportAsPNG(layout, outputPath);
      case 'jpeg':
        return this.exportAsJPEG(layout, outputPath, settings?.quality);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export layout as JPEG
   */
  private async exportAsJPEG(layout: PrintLayout, outputPath?: string, quality = 90): Promise<string> {
    // First export as PNG
    const pngPath = await this.exportAsPNG(layout);

    // Convert to JPEG
    const finalPath = outputPath || path.join(this.outputDir, `${layout.id}.jpg`);
    await sharp(pngPath)
      .jpeg({ quality })
      .toFile(finalPath);

    // Clean up PNG
    await fs.remove(pngPath);

    logger.info('JPEG export completed', { file: finalPath, quality });
    return finalPath;
  }

  /**
   * Add cut marks to PNG image
   */
  private async addCutMarks(imageBuffer: Buffer, _layout: PrintLayout, _dims: LayoutDimensions): Promise<Buffer> {
    // For now, return original image
    // Full implementation would draw cut marks using SVG overlay
    return imageBuffer;
  }

  /**
   * Add cut marks to PDF
   */
  private addCutMarksToPDF(
    doc: PDFKit.PDFDocument,
    layout: PrintLayout,
    pageWidth: number,
    pageHeight: number,
    mmToPoints: number
  ): void {
    const markLength = 5 * mmToPoints;
    const marginLeft = layout.gridLayout.margins.left * mmToPoints;
    const marginTop = layout.gridLayout.margins.top * mmToPoints;
    const marginRight = layout.gridLayout.margins.right * mmToPoints;
    const marginBottom = layout.gridLayout.margins.bottom * mmToPoints;

    doc.strokeColor('black').lineWidth(0.5);

    // Top-left
    doc.moveTo(0, marginTop).lineTo(markLength, marginTop).stroke();
    doc.moveTo(marginLeft, 0).lineTo(marginLeft, markLength).stroke();

    // Top-right
    doc.moveTo(pageWidth, marginTop).lineTo(pageWidth - markLength, marginTop).stroke();
    doc.moveTo(pageWidth - marginRight, 0).lineTo(pageWidth - marginRight, markLength).stroke();

    // Bottom-left
    doc.moveTo(0, pageHeight - marginBottom).lineTo(markLength, pageHeight - marginBottom).stroke();
    doc.moveTo(marginLeft, pageHeight).lineTo(marginLeft, pageHeight - markLength).stroke();

    // Bottom-right
    doc.moveTo(pageWidth, pageHeight - marginBottom).lineTo(pageWidth - markLength, pageHeight - marginBottom).stroke();
    doc.moveTo(pageWidth - marginRight, pageHeight).lineTo(pageWidth - marginRight, pageHeight - markLength).stroke();
  }

  /**
   * Generate preview image (low-res for UI)
   */
  async generatePreview(layout: PrintLayout, maxWidth = 800): Promise<Buffer> {
    const dims = this.calculateDimensions(layout);
    const scale = maxWidth / dims.pageWidth;
    const previewWidth = Math.round(dims.pageWidth * scale);
    const previewHeight = Math.round(dims.pageHeight * scale);

    // Create temporary high-res version
    const highRes = await this.exportAsPNG(layout);

    // Resize to preview size
    const preview = await sharp(highRes).resize(previewWidth, previewHeight, { fit: 'inside' }).png().toBuffer();

    // Clean up temp file
    await fs.remove(highRes);

    return preview;
  }

  /**
   * Validate layout configuration
   */
  validateLayout(layout: PrintLayout): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if labels fit in grid
    const totalCells = layout.gridLayout.columns * layout.gridLayout.rows;
    if (layout.labels.length > totalCells) {
      errors.push(`Too many labels (${layout.labels.length}) for grid (${totalCells} cells)`);
    }

    // Check if cells are reasonable size
    const dims = this.calculateDimensions(layout);
    if (dims.cellWidth < 50 || dims.cellHeight < 50) {
      errors.push('Cell size too small (minimum 50px)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
let composerInstance: LayoutComposerService | null = null;

export function getLayoutComposerService(outputDir?: string): LayoutComposerService {
  if (!composerInstance) {
    composerInstance = new LayoutComposerService(outputDir);
  }
  return composerInstance;
}

export function resetLayoutComposerService(): void {
  composerInstance = null;
}
