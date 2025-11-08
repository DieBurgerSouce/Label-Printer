/**
 * Label to Rendering Template Converter
 * Converts Label Templates (from Visual Editor) to Rendering Templates (for Server-Side Rendering)
 */

import {
  LabelTemplate,
  TemplateLayer,
  DynamicTextLayerProperties,
  TextLayerProperties,
  ImageLayerProperties,
  QRCodeLayerProperties,
  TextStyle,
  TemplateDimensions,
  FormattingOptions
} from '../types/template-types';

// Frontend LabelElement types (simplified - matches LabelTemplateEditor.tsx)
interface LabelElement {
  id: string;
  type: 'text' | 'freeText' | 'image' | 'price' | 'priceTable' | 'articleNumber' | 'qrCode' | 'description';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
  tableConfig?: any;
  labelFontSize?: number;
  labelFontWeight?: 'normal' | 'bold';
  labelColor?: string;
}

interface FrontendLabelTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  widthMm?: number;
  heightMm?: number;
  printLayoutId?: string;
  elements: LabelElement[];
  settings: {
    backgroundColor: string;
    backgroundImage?: string;
    defaultFontFamily: string;
    defaultFontColor: string;
    defaultFontSize: number;
    borderEnabled: boolean;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    padding: number;
  };
  articleOverrides?: any;
  rules?: any;
}

export interface ConversionOptions {
  exportDpi?: number;
  targetUnit?: 'mm' | 'cm' | 'inch' | 'px';
  preserveArticleOverrides?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export class LabelToRenderingConverter {
  /**
   * Main conversion function
   */
  static convertLabelTemplate(
    labelTemplate: FrontendLabelTemplate,
    options: ConversionOptions = {}
  ): LabelTemplate {
    const exportDpi = options.exportDpi || 300;
    const targetUnit = options.targetUnit || 'mm';

    console.log('🔄 Converting Label Template to Rendering Template...');
    console.log(`   Template: ${labelTemplate.name}`);
    console.log(`   Elements: ${labelTemplate.elements.length}`);

    // 1. Convert dimensions
    const dimensions = this.convertDimensions(labelTemplate, targetUnit, exportDpi);

    // 2. Convert elements to layers
    const layers: TemplateLayer[] = [];

    // Add background image as layer if present
    if (labelTemplate.settings.backgroundImage) {
      layers.push(this.createBackgroundImageLayer(labelTemplate));
    }

    // Convert all elements
    labelTemplate.elements.forEach((element, index) => {
      try {
        const layer = this.convertElement(element, index + layers.length);
        layers.push(layer);
      } catch (error: any) {
        console.warn(`⚠️  Failed to convert element ${element.id}: ${error.message}`);
      }
    });

    // 3. Create rendering template
    const renderingTemplate: LabelTemplate = {
      id: labelTemplate.id || `converted-${Date.now()}`,
      name: labelTemplate.name,
      version: '1.0.0',
      description: `Converted from Label Template`,

      dimensions,
      layers,
      fieldStyles: [],
      formattingOptions: this.getDefaultFormatting(),
      globalStyles: {
        backgroundColor: labelTemplate.settings.backgroundColor,
        defaultFont: labelTemplate.settings.defaultFontFamily,
        defaultFontSize: labelTemplate.settings.defaultFontSize,
        defaultColor: labelTemplate.settings.defaultFontColor
      },
      variables: [],

      settings: {
        printSettings: labelTemplate.printLayoutId ? {
          paperSize: 'A4',
          orientation: 'portrait',
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
          bleed: 3,
          cropMarks: true
        } : undefined,
        exportSettings: {
          format: 'png',
          quality: 90,
          dpi: exportDpi,
          colorSpace: 'RGB'
        }
      },

      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`✅ Conversion complete: ${layers.length} layers created`);
    return renderingTemplate;
  }

  /**
   * Convert dimensions
   */
  private static convertDimensions(
    labelTemplate: FrontendLabelTemplate,
    targetUnit: string,
    exportDpi: number
  ): TemplateDimensions {
    // Prefer mm if available (print-oriented)
    if (labelTemplate.widthMm && labelTemplate.heightMm) {
      return {
        width: labelTemplate.widthMm,
        height: labelTemplate.heightMm,
        unit: 'mm',
        dpi: exportDpi
      };
    }

    // Fallback to pixels
    return {
      width: labelTemplate.width,
      height: labelTemplate.height,
      unit: 'px',
      dpi: exportDpi
    };
  }

  /**
   * Convert individual element
   */
  private static convertElement(element: LabelElement, index: number): TemplateLayer {
    console.log(`   Converting element: ${element.type} (${element.id})`);

    switch (element.type) {
      case 'text':
        return this.convertTextElement(element, index);
      case 'freeText':
        return this.convertFreeTextElement(element, index);
      case 'image':
        return this.convertImageElement(element, index);
      case 'price':
        return this.convertPriceElement(element, index);
      case 'priceTable':
        return this.convertPriceTableElement(element, index);
      case 'articleNumber':
        return this.convertArticleNumberElement(element, index);
      case 'qrCode':
        return this.convertQRCodeElement(element, index);
      case 'description':
        return this.convertDescriptionElement(element, index);
      default:
        throw new Error(`Unknown element type: ${(element as any).type}`);
    }
  }

  /**
   * Convert text element (can be dynamic or static)
   */
  private static convertTextElement(element: LabelElement, index: number): TemplateLayer {
    const isPlaceholder = element.content?.startsWith('{{');

    if (isPlaceholder) {
      // Dynamic text - extract field name
      const fieldName = element.content.replace(/[{}]/g, '').trim();
      const fieldType = this.getFieldTypeFromPlaceholder(fieldName);

      return {
        id: element.id,
        name: element.content,
        type: 'dynamic-text',
        visible: true,
        locked: false,
        order: index,
        position: { x: element.x, y: element.y, unit: 'px' },
        size: { width: element.width, height: element.height, unit: 'px' },
        rotation: 0,
        properties: {
          type: 'dynamic-text',
          dataField: fieldName,
          fieldType,
          style: this.createTextStyle(element, fieldType),
          formatting: undefined
        } as DynamicTextLayerProperties
      };
    } else {
      // Static text
      return this.createStaticTextLayer(element, index);
    }
  }

  /**
   * Convert free text element (always static)
   */
  private static convertFreeTextElement(element: LabelElement, index: number): TemplateLayer {
    return this.createStaticTextLayer(element, index);
  }

  /**
   * Convert image element
   */
  private static convertImageElement(element: LabelElement, index: number): TemplateLayer {
    return {
      id: element.id,
      name: `image-${index}`,
      type: 'image',
      visible: true,
      locked: false,
      order: index,
      position: { x: element.x, y: element.y, unit: 'px' },
      size: { width: element.width, height: element.height, unit: 'px' },
      rotation: 0,
      properties: {
        type: 'image',
        source: 'imageUrl',
        fit: 'contain',
        alignment: { horizontal: 'center', vertical: 'middle' }
      } as ImageLayerProperties
    };
  }

  /**
   * Convert price element
   */
  private static convertPriceElement(element: LabelElement, index: number): TemplateLayer {
    return {
      id: element.id,
      name: `price-${index}`,
      type: 'dynamic-text',
      visible: true,
      locked: false,
      order: index,
      position: { x: element.x, y: element.y, unit: 'px' },
      size: { width: element.width, height: element.height, unit: 'px' },
      rotation: 0,
      properties: {
        type: 'dynamic-text',
        dataField: 'price',
        fieldType: 'price',
        style: this.createTextStyle(element, 'price'),
        formatting: {
          price: {
            currencySymbol: '€',
            currencyPosition: 'after',
            decimalPlaces: 2,
            decimalSeparator: ',',
            thousandsSeparator: '.',
            showCurrencyCode: false
          }
        }
      } as DynamicTextLayerProperties
    };
  }

  /**
   * Convert priceTable element
   */
  private static convertPriceTableElement(element: LabelElement, index: number): TemplateLayer {
    return {
      id: element.id,
      name: `tiered-price-${index}`,
      type: 'dynamic-text',
      visible: true,
      locked: false,
      order: index,
      position: { x: element.x, y: element.y, unit: 'px' },
      size: { width: element.width, height: element.height, unit: 'px' },
      rotation: 0,
      properties: {
        type: 'dynamic-text',
        dataField: 'tieredPrices',
        fieldType: 'tieredPrice',
        style: this.createTextStyle(element, 'tieredPrice'),
        formatting: {
          tieredPrice: {
            layout: 'vertical',
            separator: ' | ',
            quantityPrefix: 'ab ',
            quantitySuffix: ' Stk',
            pricePrefix: '',
            priceSuffix: ' €',
            showQuantityLabel: false
          }
        }
      } as DynamicTextLayerProperties
    };
  }

  /**
   * Convert articleNumber element
   */
  private static convertArticleNumberElement(element: LabelElement, index: number): TemplateLayer {
    return {
      id: element.id,
      name: `article-number-${index}`,
      type: 'dynamic-text',
      visible: true,
      locked: false,
      order: index,
      position: { x: element.x, y: element.y, unit: 'px' },
      size: { width: element.width, height: element.height, unit: 'px' },
      rotation: 0,
      properties: {
        type: 'dynamic-text',
        dataField: 'articleNumber',
        fieldType: 'articleNumber',
        style: this.createTextStyle(element, 'articleNumber'),
        formatting: {
          articleNumber: {
            prefix: 'Artikelnummer: ',
            suffix: '',
            casing: 'original'
          }
        }
      } as DynamicTextLayerProperties
    };
  }

  /**
   * Convert QR code element
   */
  private static convertQRCodeElement(element: LabelElement, index: number): TemplateLayer {
    return {
      id: element.id,
      name: `qrcode-${index}`,
      type: 'qrcode',
      visible: true,
      locked: false,
      order: index,
      position: { x: element.x, y: element.y, unit: 'px' },
      size: { width: element.width, height: element.height, unit: 'px' },
      rotation: 0,
      properties: {
        type: 'qrcode',
        data: 'sourceUrl',
        errorCorrection: 'M',
        color: '#000000',
        backgroundColor: '#FFFFFF'
      } as QRCodeLayerProperties
    };
  }

  /**
   * Convert description element
   */
  private static convertDescriptionElement(element: LabelElement, index: number): TemplateLayer {
    return {
      id: element.id,
      name: `description-${index}`,
      type: 'dynamic-text',
      visible: true,
      locked: false,
      order: index,
      position: { x: element.x, y: element.y, unit: 'px' },
      size: { width: element.width, height: element.height, unit: 'px' },
      rotation: 0,
      properties: {
        type: 'dynamic-text',
        dataField: 'description',
        fieldType: 'description',
        style: this.createTextStyle(element, 'description'),
        formatting: undefined
      } as DynamicTextLayerProperties
    };
  }

  /**
   * Create background image layer
   */
  private static createBackgroundImageLayer(labelTemplate: FrontendLabelTemplate): TemplateLayer {
    return {
      id: `bg-${Date.now()}`,
      name: 'background-image',
      type: 'image',
      visible: true,
      locked: true,
      order: -1,
      position: { x: 0, y: 0, unit: 'px' },
      size: { width: labelTemplate.width, height: labelTemplate.height, unit: 'px' },
      rotation: 0,
      properties: {
        type: 'image',
        source: labelTemplate.settings.backgroundImage!,
        fit: 'cover',
        alignment: { horizontal: 'center', vertical: 'middle' }
      } as ImageLayerProperties
    };
  }

  /**
   * Create static text layer
   */
  private static createStaticTextLayer(element: LabelElement, index: number): TemplateLayer {
    return {
      id: element.id,
      name: `text-${index}`,
      type: 'text',
      visible: true,
      locked: false,
      order: index,
      position: { x: element.x, y: element.y, unit: 'px' },
      size: { width: element.width, height: element.height, unit: 'px' },
      rotation: 0,
      properties: {
        type: 'text',
        content: element.content,
        style: {
          fontFamily: 'Arial',
          fontSize: element.fontSize || 14,
          fontWeight: element.fontWeight || 'normal',
          fontStyle: 'normal',
          color: element.color || '#000000',
          textAlign: element.align || 'left',
          verticalAlign: 'top',
          lineHeight: 1.2,
          letterSpacing: 0
        }
      } as TextLayerProperties
    };
  }

  /**
   * Create text style from element
   */
  private static createTextStyle(element: LabelElement, fieldType: string): any {
    return {
      fontFamily: 'Arial',
      fontSize: element.fontSize || 14,
      fontWeight: element.fontWeight || 'normal',
      fontStyle: 'normal',
      color: element.color || '#000000',
      textAlign: element.align || 'left',
      verticalAlign: 'top',
      lineHeight: 1.2,
      letterSpacing: 0,
      fieldType
    };
  }

  /**
   * Get field type from placeholder
   */
  private static getFieldTypeFromPlaceholder(placeholder: string): string {
    const map: { [key: string]: string } = {
      'Produktname': 'productName',
      'productName': 'productName',
      'Preis': 'price',
      'price': 'price',
      'Artikelnummer': 'articleNumber',
      'articleNumber': 'articleNumber',
      'Beschreibung': 'description',
      'description': 'description'
    };

    return map[placeholder] || 'custom';
  }

  /**
   * Get default formatting options
   */
  private static getDefaultFormatting(): FormattingOptions {
    return {
      articleNumber: {
        prefix: 'Art.Nr.: ',
        casing: 'original'
      },
      price: {
        currencySymbol: '€',
        currencyPosition: 'after',
        decimalPlaces: 2,
        decimalSeparator: ',',
        thousandsSeparator: '.'
      },
      tieredPrice: {
        layout: 'vertical',
        separator: ' | ',
        quantityPrefix: 'ab ',
        quantitySuffix: ' Stk',
        pricePrefix: '',
        priceSuffix: ' €',
        showQuantityLabel: false
      }
    };
  }

  /**
   * Validate conversion result
   */
  static validateConversion(template: LabelTemplate): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!template.name) errors.push('Template name is required');
    if (!template.dimensions) errors.push('Dimensions are required');
    if (!Array.isArray(template.layers) || template.layers.length === 0) {
      warnings.push('Template has no layers');
    }

    // Check data field references
    for (const layer of template.layers) {
      if (layer.properties?.type === 'dynamic-text') {
        const props = layer.properties as DynamicTextLayerProperties;
        if (!props.dataField) {
          errors.push(`Layer ${layer.name} has no dataField`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

/**
 * Export convenience function for converting Label Templates to Rendering Templates
 */
export function convertLabelTemplateToRenderingTemplate(
  labelTemplate: any,
  options?: Partial<ConversionOptions>
): LabelTemplate {
  return LabelToRenderingConverter.convertLabelTemplate(labelTemplate, options);
}
