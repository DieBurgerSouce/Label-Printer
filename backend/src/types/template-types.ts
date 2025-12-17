/**
 * Template Type Definitions
 * Supports dynamic text styling for individual fields
 */

export interface LabelTemplate {
  id: string;
  name: string;
  description?: string;
  version: string;

  // Template dimensions
  dimensions: TemplateDimensions;

  // Layers (elements on the template)
  layers: TemplateLayer[];

  // Field styling configurations
  fieldStyles: FieldStyleConfig[];

  // Formatting options
  formattingOptions: FormattingOptions;

  // Global styles
  globalStyles: GlobalStyles;

  // Variables and data bindings
  variables: TemplateVariable[];

  // Settings
  settings: TemplateSettings;

  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateDimensions {
  width: number;
  height: number;
  unit: 'mm' | 'cm' | 'inch' | 'px';
  dpi: number;
}

export interface TemplateLayer {
  id: string;
  name: string;
  type: 'text' | 'image' | 'qrcode' | 'barcode' | 'shape' | 'dynamic-text';
  visible: boolean;
  locked: boolean;
  order: number; // z-index

  // Position and size
  position: Position;
  size: Size;
  rotation: number; // degrees

  // Layer-specific properties
  properties: LayerProperties;
}

export interface Position {
  x: number;
  y: number;
  unit: 'mm' | 'cm' | 'inch' | 'px';
}

export interface Size {
  width: number;
  height: number;
  unit: 'mm' | 'cm' | 'inch' | 'px';
}

export type LayerProperties =
  | TextLayerProperties
  | ImageLayerProperties
  | QRCodeLayerProperties
  | BarcodeLayerProperties
  | ShapeLayerProperties
  | DynamicTextLayerProperties;

export interface TextLayerProperties {
  type: 'text';
  content: string;
  style: TextStyle;
}

/**
 * DYNAMIC TEXT - The key feature for individual field styling!
 * This allows article numbers, prices, tiered prices to have different styles
 */
export interface DynamicTextLayerProperties {
  type: 'dynamic-text';
  dataField: string; // e.g., 'articleNumber', 'price', 'tieredPrices'
  fieldType: FieldType;
  style: DynamicTextStyle; // Different style per field type!
  formatting?: FieldFormatting;
}

export type FieldType =
  | 'articleNumber'
  | 'productName'
  | 'price'
  | 'tieredPrice'
  | 'ean'
  | 'description'
  | 'custom';

export interface ImageLayerProperties {
  type: 'image';
  source: string; // URL or data field
  fit: 'cover' | 'contain' | 'fill' | 'none';
  alignment: Alignment;
}

export interface QRCodeLayerProperties {
  type: 'qrcode';
  data: string; // QR code content or data field
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  color: string;
  backgroundColor: string;
}

export interface BarcodeLayerProperties {
  type: 'barcode';
  data: string; // Barcode content or data field
  format: 'CODE128' | 'EAN13' | 'UPC' | 'CODE39';
  displayValue: boolean;
  fontSize: number;
}

export interface ShapeLayerProperties {
  type: 'shape';
  shape: 'rectangle' | 'circle' | 'line';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * TEXT STYLING - Base text style
 */
export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight:
    | 'normal'
    | 'bold'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900';
  fontStyle: 'normal' | 'italic' | 'oblique';
  color: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  verticalAlign: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  letterSpacing: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through';

  // Effects
  shadow?: TextShadow;
  background?: string;
  padding?: Padding;
  border?: Border;
}

/**
 * DYNAMIC TEXT STYLE - Individual styling per field type!
 * This is what enables: Article numbers in BOLD, Tiered prices in BLUE!
 */
export interface DynamicTextStyle extends TextStyle {
  // Field-specific overrides
  fieldType: FieldType;

  // Conditional styling based on value
  conditionalStyles?: ConditionalStyle[];
}

export interface ConditionalStyle {
  condition: StyleCondition;
  style: Partial<TextStyle>;
}

export interface StyleCondition {
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'startsWith' | 'endsWith';
  value: string | number;
}

export interface TextShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Border {
  width: number;
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  radius?: number;
}

export interface Alignment {
  horizontal: 'left' | 'center' | 'right';
  vertical: 'top' | 'middle' | 'bottom';
}

/**
 * FIELD STYLE CONFIG - Configuration for styling specific fields
 */
export interface FieldStyleConfig {
  id: string;
  fieldType: FieldType;
  fieldName: string;
  style: DynamicTextStyle;
  enabled: boolean;
}

/**
 * FORMATTING OPTIONS - How to format extracted data
 */
export interface FormattingOptions {
  articleNumber?: ArticleNumberFormatting;
  price?: PriceFormatting;
  tieredPrice?: TieredPriceFormatting;
  date?: DateFormatting;
}

export interface ArticleNumberFormatting {
  prefix?: string; // e.g., "Art.Nr.: "
  suffix?: string;
  casing?: 'original' | 'uppercase' | 'lowercase';
  grouping?: {
    enabled: boolean;
    separator: string; // e.g., "-"
    pattern: number[]; // e.g., [3, 3, 3] for "123-456-789"
  };
}

export interface PriceFormatting {
  currencySymbol: string; // e.g., "€"
  currencyPosition: 'before' | 'after';
  decimalPlaces: number;
  decimalSeparator: string; // e.g., ","
  thousandsSeparator: string; // e.g., "."
  showCurrencyCode?: boolean; // e.g., "EUR"
}

export interface TieredPriceFormatting {
  layout: 'horizontal' | 'vertical' | 'table';
  separator: string; // e.g., " | "

  quantityPrefix?: string; // e.g., "ab "
  quantitySuffix?: string; // e.g., " Stück"

  pricePrefix?: string;
  priceSuffix?: string;

  showQuantityLabel?: boolean;
  quantityLabel?: string; // e.g., "Menge:"

  highlightBestPrice?: boolean;
  bestPriceStyle?: Partial<TextStyle>;
}

export interface DateFormatting {
  format: string; // e.g., "DD.MM.YYYY"
  locale: string; // e.g., "de-DE"
}

export interface FieldFormatting {
  format?: string;
  transform?: (value: any) => string;
}

/**
 * GLOBAL STYLES - Default styles for the template
 */
export interface GlobalStyles {
  backgroundColor?: string;
  defaultFont?: string;
  defaultFontSize?: number;
  defaultColor?: string;
}

/**
 * TEMPLATE VARIABLE - Data binding
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'image' | 'object';
  defaultValue?: any;
  required: boolean;
  description?: string;
}

/**
 * TEMPLATE SETTINGS
 */
export interface TemplateSettings {
  printSettings?: PrintSettings;
  exportSettings?: ExportSettings;
}

export interface PrintSettings {
  paperSize?: string; // e.g., "A4", "Letter"
  orientation?: 'portrait' | 'landscape';
  margins?: Padding;
  bleed?: number;
  cropMarks?: boolean;
}

export interface ExportSettings {
  format: 'png' | 'pdf' | 'svg' | 'jpg';
  quality?: number; // 0-100
  dpi?: number;
  colorSpace?: 'RGB' | 'CMYK';
}

/**
 * RENDER CONTEXT - Data to render on template
 */
export interface RenderContext {
  template: LabelTemplate;
  data: Record<string, any>;
  options?: RenderOptions;
}

export interface RenderOptions {
  format?: 'png' | 'pdf' | 'svg' | 'jpg';
  quality?: number;
  scale?: number;
  backgroundColor?: string;
}

/**
 * RENDER RESULT
 */
export interface RenderResult {
  success: boolean;
  buffer?: Buffer;
  base64?: string;
  format: string;
  width: number;
  height: number;
  renderTime: number;
  error?: string;
}

/**
 * DEFAULT FIELD STYLES - Pre-configured styles for common fields
 */
export const DEFAULT_FIELD_STYLES: Record<FieldType, DynamicTextStyle> = {
  articleNumber: {
    fieldType: 'articleNumber',
    fontFamily: 'Arial',
    fontSize: 14,
    fontWeight: 'bold', // ✨ FETT wie gewünscht!
    fontStyle: 'normal',
    color: '#000000',
    textAlign: 'left',
    verticalAlign: 'top',
    lineHeight: 1.2,
    letterSpacing: 0,
  },
  productName: {
    fieldType: 'productName',
    fontFamily: 'Arial',
    fontSize: 16,
    fontWeight: 'bold',
    fontStyle: 'normal',
    color: '#000000',
    textAlign: 'left',
    verticalAlign: 'top',
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  price: {
    fieldType: 'price',
    fontFamily: 'Arial',
    fontSize: 24,
    fontWeight: 'bold',
    fontStyle: 'normal',
    color: '#000000', // ✨ SCHWARZ wie gewünscht!
    textAlign: 'right',
    verticalAlign: 'middle',
    lineHeight: 1.2,
    letterSpacing: 0,
  },
  tieredPrice: {
    fieldType: 'tieredPrice',
    fontFamily: 'Arial',
    fontSize: 11,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#0066CC', // ✨ BLAU wie gewünscht!
    textAlign: 'left',
    verticalAlign: 'top',
    lineHeight: 1.4,
    letterSpacing: 0,
    background: '#F0F8FF', // Light blue background
    padding: {
      top: 4,
      right: 6,
      bottom: 4,
      left: 6,
    },
    border: {
      width: 1,
      color: '#0066CC',
      style: 'solid',
      radius: 3,
    },
  },
  ean: {
    fieldType: 'ean',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#666666',
    textAlign: 'left',
    verticalAlign: 'bottom',
    lineHeight: 1.2,
    letterSpacing: 1,
  },
  description: {
    fieldType: 'description',
    fontFamily: 'Arial',
    fontSize: 10,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#333333',
    textAlign: 'left',
    verticalAlign: 'top',
    lineHeight: 1.5,
    letterSpacing: 0,
  },
  custom: {
    fieldType: 'custom',
    fontFamily: 'Arial',
    fontSize: 12,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#000000',
    textAlign: 'left',
    verticalAlign: 'top',
    lineHeight: 1.2,
    letterSpacing: 0,
  },
};

/**
 * DEFAULT FORMATTING OPTIONS
 */
export const DEFAULT_FORMATTING: FormattingOptions = {
  articleNumber: {
    prefix: 'Art.Nr.: ',
    casing: 'original',
  },
  price: {
    currencySymbol: '€',
    currencyPosition: 'after',
    decimalPlaces: 2,
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  tieredPrice: {
    layout: 'horizontal',
    separator: ' | ',
    quantityPrefix: 'ab ',
    quantitySuffix: ' Stk',
    showQuantityLabel: false,
  },
  date: {
    format: 'DD.MM.YYYY',
    locale: 'de-DE',
  },
};
