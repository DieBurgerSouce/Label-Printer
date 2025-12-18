import type { TemplateRule } from "@/types/template.types";

export interface TableConfig {
  headerBg: string;
  headerColor: string;
  headerFontSize: number;
  headerFontWeight: 'normal' | 'bold';
  headerAlign: 'left' | 'center' | 'right';
  rowBg: string;
  rowAlternateBg: string;
  rowColor: string;
  rowFontSize: number;
  rowAlign: 'left' | 'center' | 'right';
  borderColor: string;
  borderWidth: number;
  cellPadding: number;
}

export interface LabelElement {
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
  tableConfig?: TableConfig;
  originalWidth?: number;  // For scaling elements proportionally
  originalHeight?: number;
  // Separate styling for label/prefix (e.g., "Artikelnummer:")
  labelFontSize?: number;
  labelFontWeight?: 'normal' | 'bold';
  labelColor?: string;
}

export interface TemplateSettings {
  backgroundColor: string;
  backgroundImage?: string; // base64 or URL
  backgroundImageOpacity: number;
  defaultFontFamily: string;
  defaultFontColor: string;
  defaultFontSize: number;
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  padding: number;
}

export interface LabelTemplate {
  id: string;
  name: string;
  width: number;  // in pixels (for canvas display)
  height: number; // in pixels (for canvas display)
  widthMm?: number;  // in millimeters (for print)
  heightMm?: number; // in millimeters (for print)
  printLayoutId?: string;  // selected print layout ID
  printLayoutName?: string;  // display name of print layout (e.g. "A3 Grid - 2×4")
  printLayoutColumns?: number;  // number of columns in print layout
  printLayoutRows?: number;  // number of rows in print layout
  elements: LabelElement[];
  settings: TemplateSettings;

  // Template Rules for Auto-Matching
  rules?: TemplateRule;
  autoMatchEnabled: boolean;

  // Article-specific overrides
  // Allows customizing element properties per article without creating multiple templates
  // Structure: { [articleNumber]: { [elementId]: Partial<LabelElement> } }
  articleOverrides?: {
    [articleNumber: string]: {
      [elementId: string]: Partial<LabelElement>;
    };
  };
}
