/**
 * Template Engine Service
 * Merges OCR/Excel data with templates and applies dynamic styling
 */

import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  LabelTemplate,
  RenderContext,
  RenderResult,
  DynamicTextLayerProperties,
  TextLayerProperties,
  FieldType,
  ArticleNumberFormatting,
  PriceFormatting,
  TieredPriceFormatting,
  DEFAULT_FORMATTING,
  TemplateLayer,
} from '../types/template-types';

class TemplateEngine {
  private templatesCache: Map<string, LabelTemplate> = new Map();

  /**
   * Render a template with data
   */
  async render(context: RenderContext): Promise<RenderResult> {
    const startTime = Date.now();
    const { template, data, options = {} } = context;

    try {
      console.log(`🎨 Rendering template: ${template.name}`);

      // Calculate pixel dimensions
      const pixelDimensions = this.calculatePixelDimensions(
        template.dimensions,
        options.scale || 1
      );

      // Create base canvas
      const { width, height } = pixelDimensions;

      // Generate SVG with styled text
      const svg = await this.generateSVG(template, data, width, height);

      // Render SVG to image using Sharp
      const format = options.format || template.settings.exportSettings?.format || 'png';
      const quality = options.quality || template.settings.exportSettings?.quality || 90;

      const buffer = await sharp(Buffer.from(svg))
        .resize(width, height)
        .toFormat(format as any, { quality })
        .toBuffer();

      const renderTime = Date.now() - startTime;

      console.log(`✅ Template rendered in ${renderTime}ms`);

      return {
        success: true,
        buffer,
        base64: buffer.toString('base64'),
        format,
        width,
        height,
        renderTime,
      };
    } catch (error: any) {
      console.error('❌ Template rendering failed:', error);
      return {
        success: false,
        format: options.format || 'png',
        width: 0,
        height: 0,
        renderTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Generate SVG with all layers and styled text
   */
  private async generateSVG(
    template: LabelTemplate,
    data: Record<string, any>,
    width: number,
    height: number
  ): Promise<string> {
    const bgColor = template.globalStyles.backgroundColor || '#FFFFFF';

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Background
    svg += `<rect width="100%" height="100%" fill="${bgColor}"/>`;

    // Render layers in order
    const sortedLayers = [...template.layers].sort((a, b) => a.order - b.order);

    for (const layer of sortedLayers) {
      if (!layer.visible) continue;

      const layerSVG = await this.renderLayer(layer, data, template);
      svg += layerSVG;
    }

    svg += '</svg>';

    return svg;
  }

  /**
   * Render a single layer
   */
  private async renderLayer(
    layer: TemplateLayer,
    data: Record<string, any>,
    template: LabelTemplate
  ): Promise<string> {
    const props = layer.properties;

    switch (props.type) {
      case 'dynamic-text':
        return this.renderDynamicText(layer, props, data, template);

      case 'text':
        return this.renderStaticText(layer, props);

      case 'image':
        return ''; // TODO: Implement image layers

      case 'qrcode':
        return this.renderQRCode(layer, props, data);

      case 'shape':
        return this.renderShape(layer, props);

      default:
        return '';
    }
  }

  /**
   * Render dynamic text with field-specific styling
   * This is where the magic happens! Different styles for different fields!
   */
  private renderDynamicText(
    layer: TemplateLayer,
    props: DynamicTextLayerProperties,
    data: Record<string, any>,
    template: LabelTemplate
  ): string {
    // Get data value
    let value = data[props.dataField];
    if (value === undefined || value === null) {
      return ''; // Field not found
    }

    // Format the value based on field type
    const formattedValue = this.formatFieldValue(
      value,
      props.fieldType,
      template.formattingOptions,
      props.formatting
    );

    // Get position and size
    const x = this.convertToPixels(layer.position.x, layer.position.unit, template.dimensions.dpi);
    const y = this.convertToPixels(layer.position.y, layer.position.unit, template.dimensions.dpi);
    const width = this.convertToPixels(layer.size.width, layer.size.unit, template.dimensions.dpi);
    const height = this.convertToPixels(layer.size.height, layer.size.unit, template.dimensions.dpi);

    // Apply dynamic styling based on field type
    const style = props.style;

    let svg = '<g>';

    // Background
    if (style.background) {
      const bgPadding = style.padding || { top: 0, right: 0, bottom: 0, left: 0 };
      svg += `<rect x="${x - bgPadding.left}" y="${y - bgPadding.top}" `;
      svg += `width="${width + bgPadding.left + bgPadding.right}" `;
      svg += `height="${height + bgPadding.top + bgPadding.bottom}" `;
      svg += `fill="${style.background}"`;
      if (style.border) {
        svg += ` stroke="${style.border.color}" stroke-width="${style.border.width}"`;
        if (style.border.radius) {
          svg += ` rx="${style.border.radius}" ry="${style.border.radius}"`;
        }
      }
      svg += '/>';
    }

    // Text
    const fontSize = style.fontSize;
    const fontWeight = style.fontWeight;
    const fontStyle = style.fontStyle;
    const fontFamily = style.fontFamily;
    const color = style.color;
    const textAlign = style.textAlign;
    const textTransform = style.textTransform || 'none';

    let transformedText = formattedValue;
    if (textTransform === 'uppercase') transformedText = formattedValue.toUpperCase();
    if (textTransform === 'lowercase') transformedText = formattedValue.toLowerCase();
    if (textTransform === 'capitalize') {
      transformedText = formattedValue
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }

    // Calculate text anchor based on alignment
    let textAnchor = 'start';
    let textX = x;
    if (textAlign === 'center') {
      textAnchor = 'middle';
      textX = x + width / 2;
    } else if (textAlign === 'right') {
      textAnchor = 'end';
      textX = x + width;
    }

    // Text shadow
    if (style.shadow) {
      svg += `<text x="${textX + style.shadow.offsetX}" y="${y + fontSize + style.shadow.offsetY}" `;
      svg += `font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" `;
      svg += `font-style="${fontStyle}" text-anchor="${textAnchor}" `;
      svg += `fill="${style.shadow.color}" opacity="0.5">`;
      svg += this.escapeXML(transformedText);
      svg += '</text>';
    }

    // Main text
    svg += `<text x="${textX}" y="${y + fontSize}" `;
    svg += `font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" `;
    svg += `font-style="${fontStyle}" text-anchor="${textAnchor}" fill="${color}"`;
    if (style.letterSpacing) {
      svg += ` letter-spacing="${style.letterSpacing}"`;
    }
    if (style.textDecoration) {
      svg += ` text-decoration="${style.textDecoration}"`;
    }
    svg += '>';

    // Handle multi-line text (for tiered prices)
    if (props.fieldType === 'tieredPrice' && Array.isArray(value)) {
      const lines = transformedText.split('\n');
      lines.forEach((line, i) => {
        if (i === 0) {
          svg += this.escapeXML(line);
        } else {
          svg += `<tspan x="${textX}" dy="${fontSize * style.lineHeight}">${this.escapeXML(line)}</tspan>`;
        }
      });
    } else {
      svg += this.escapeXML(transformedText);
    }

    svg += '</text>';
    svg += '</g>';

    return svg;
  }

  /**
   * Render static text
   */
  private renderStaticText(_layer: TemplateLayer, props: TextLayerProperties): string {
    // Similar to dynamic text but with static content
    const x = 0; // Simplified for now
    const y = 0;

    const style = props.style;
    const fontSize = style.fontSize;

    return `<text x="${x}" y="${y + fontSize}" font-family="${style.fontFamily}" font-size="${fontSize}" fill="${style.color}">${this.escapeXML(props.content)}</text>`;
  }

  /**
   * Render QR code placeholder
   */
  private renderQRCode(layer: TemplateLayer, _props: any, _data: Record<string, any>): string {
    // TODO: Generate actual QR code using a library
    const x = this.convertToPixels(layer.position.x, layer.position.unit, 300);
    const y = this.convertToPixels(layer.position.y, layer.position.unit, 300);
    const size = this.convertToPixels(layer.size.width, layer.size.unit, 300);

    return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#000" opacity="0.1"/>
            <text x="${x + size/2}" y="${y + size/2}" text-anchor="middle" font-size="10" fill="#666">QR Code</text>`;
  }

  /**
   * Render shape
   */
  private renderShape(layer: TemplateLayer, props: any): string {
    const x = this.convertToPixels(layer.position.x, layer.position.unit, 300);
    const y = this.convertToPixels(layer.position.y, layer.position.unit, 300);
    const width = this.convertToPixels(layer.size.width, layer.size.unit, 300);
    const height = this.convertToPixels(layer.size.height, layer.size.unit, 300);

    if (props.shape === 'rectangle') {
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${props.fill || 'none'}" stroke="${props.stroke || 'none'}" stroke-width="${props.strokeWidth || 1}"/>`;
    }

    return '';
  }

  /**
   * Format field value based on type and formatting options
   */
  private formatFieldValue(
    value: any,
    fieldType: FieldType,
    formattingOptions: any,
    _customFormatting?: any
  ): string {
    const formatting = { ...DEFAULT_FORMATTING, ...formattingOptions };

    switch (fieldType) {
      case 'articleNumber':
        return this.formatArticleNumber(value, formatting.articleNumber);

      case 'price':
        return this.formatPrice(value, formatting.price);

      case 'tieredPrice':
        return this.formatTieredPrice(value, formatting.tieredPrice);

      case 'ean':
        return String(value);

      case 'productName':
      case 'description':
      case 'custom':
      default:
        return String(value);
    }
  }

  /**
   * Format article number
   */
  private formatArticleNumber(value: string, formatting?: ArticleNumberFormatting): string {
    if (!formatting) return value;

    let formatted = value;

    // Apply casing
    if (formatting.casing === 'uppercase') formatted = formatted.toUpperCase();
    if (formatting.casing === 'lowercase') formatted = formatted.toLowerCase();

    // Apply grouping
    if (formatting.grouping?.enabled && formatting.grouping.pattern) {
      const separator = formatting.grouping.separator || '-';
      const pattern = formatting.grouping.pattern;

      const groups: string[] = [];
      let index = 0;

      for (const groupSize of pattern) {
        if (index >= formatted.length) break;
        groups.push(formatted.substr(index, groupSize));
        index += groupSize;
      }

      if (index < formatted.length) {
        groups.push(formatted.substr(index));
      }

      formatted = groups.join(separator);
    }

    // Apply prefix/suffix
    if (formatting.prefix) formatted = formatting.prefix + formatted;
    if (formatting.suffix) formatted = formatted + formatting.suffix;

    return formatted;
  }

  /**
   * Format price
   */
  private formatPrice(value: number | string, formatting?: PriceFormatting): string {
    if (!formatting) return String(value);

    // Convert to number
    const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;

    if (isNaN(numValue)) return String(value);

    // Format number
    const fixedValue = numValue.toFixed(formatting.decimalPlaces || 2);
    const [intPart, decPart] = fixedValue.split('.');

    // Add thousands separator
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, formatting.thousandsSeparator || '');

    // Combine
    let formatted = formattedInt + (formatting.decimalSeparator || ',') + decPart;

    // Add currency
    if (formatting.currencyPosition === 'before') {
      formatted = (formatting.currencySymbol || '€') + ' ' + formatted;
    } else {
      formatted = formatted + ' ' + (formatting.currencySymbol || '€');
    }

    return formatted;
  }

  /**
   * Format tiered price - THIS IS KEY FOR BLUE STYLING!
   */
  private formatTieredPrice(
    value: Array<{ quantity: number; price: string }>,
    formatting?: TieredPriceFormatting
  ): string {
    if (!Array.isArray(value) || value.length === 0) return '';
    if (!formatting) formatting = DEFAULT_FORMATTING.tieredPrice!;

    const lines: string[] = [];

    for (const tier of value) {
      let line = '';

      // Quantity
      if (formatting.quantityPrefix) line += formatting.quantityPrefix;
      line += tier.quantity;
      if (formatting.quantitySuffix) line += formatting.quantitySuffix;

      line += ': ';

      // Price
      if (formatting.pricePrefix) line += formatting.pricePrefix;
      line += tier.price;
      if (formatting.priceSuffix) line += formatting.priceSuffix;

      lines.push(line);
    }

    // Join based on layout
    if (formatting.layout === 'vertical') {
      return lines.join('\n');
    } else if (formatting.layout === 'horizontal') {
      return lines.join(formatting.separator || ' | ');
    } else {
      // Table layout - for now use horizontal
      return lines.join(formatting.separator || ' | ');
    }
  }

  /**
   * Calculate pixel dimensions from template dimensions
   */
  private calculatePixelDimensions(
    dimensions: any,
    scale: number
  ): { width: number; height: number } {
    const dpi = dimensions.dpi || 300;

    let width = dimensions.width;
    let height = dimensions.height;

    // Convert to pixels if needed
    if (dimensions.unit === 'mm') {
      width = (width / 25.4) * dpi;
      height = (height / 25.4) * dpi;
    } else if (dimensions.unit === 'cm') {
      width = (width / 2.54) * dpi;
      height = (height / 2.54) * dpi;
    } else if (dimensions.unit === 'inch') {
      width = width * dpi;
      height = height * dpi;
    }

    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    };
  }

  /**
   * Convert units to pixels
   */
  private convertToPixels(value: number, unit: string, dpi: number): number {
    if (unit === 'px') return value;
    if (unit === 'mm') return (value / 25.4) * dpi;
    if (unit === 'cm') return (value / 2.54) * dpi;
    if (unit === 'inch') return value * dpi;
    return value;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Save template
   */
  async saveTemplate(template: LabelTemplate): Promise<void> {
    const templatesDir = path.join(process.cwd(), 'templates');
    await fs.mkdir(templatesDir, { recursive: true });

    const templatePath = path.join(templatesDir, `${template.id}.json`);
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2));

    this.templatesCache.set(template.id, template);

    console.log(`✅ Template saved: ${template.name}`);
  }

  /**
   * Load template by ID or name
   */
  async loadTemplate(templateId: string): Promise<LabelTemplate | null> {
    // Check cache first
    if (this.templatesCache.has(templateId)) {
      return this.templatesCache.get(templateId)!;
    }

    // Try loading by ID first
    const templatePath = path.join(process.cwd(), 'templates', `${templateId}.json`);

    try {
      const data = await fs.readFile(templatePath, 'utf-8');
      const template = JSON.parse(data) as LabelTemplate;
      this.templatesCache.set(templateId, template);
      return template;
    } catch (error) {
      // If not found by ID, try loading by name
      console.log(`Template not found by ID ${templateId}, trying by name...`);

      try {
        const allTemplates = await this.listTemplates();

        // Search by exact name match (case-insensitive)
        const normalizedQuery = templateId.toLowerCase().replace(/-/g, ' ');
        const matchedTemplate = allTemplates.find(t =>
          t.name.toLowerCase() === normalizedQuery ||
          t.name.toLowerCase().replace(/\s+/g, '-') === templateId.toLowerCase()
        );

        if (matchedTemplate) {
          this.templatesCache.set(templateId, matchedTemplate);
          console.log(`✅ Template found by name: ${matchedTemplate.name}`);
          return matchedTemplate;
        }
      } catch (listError) {
        console.error(`Failed to search templates by name:`, listError);
      }

      console.error(`Failed to load template ${templateId}:`, error);
      return null;
    }
  }

  /**
   * List all templates
   */
  async listTemplates(): Promise<LabelTemplate[]> {
    const templatesDir = path.join(process.cwd(), 'templates');

    try {
      await fs.mkdir(templatesDir, { recursive: true });
      const files = await fs.readdir(templatesDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      const templates: LabelTemplate[] = [];

      for (const file of jsonFiles) {
        const data = await fs.readFile(path.join(templatesDir, file), 'utf-8');
        templates.push(JSON.parse(data));
      }

      return templates;
    } catch (error) {
      console.error('Failed to list templates:', error);
      return [];
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    const templatePath = path.join(process.cwd(), 'templates', `${templateId}.json`);

    try {
      await fs.unlink(templatePath);
      this.templatesCache.delete(templateId);
      console.log(`✅ Template deleted: ${templateId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete template ${templateId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const templateEngine = new TemplateEngine();
