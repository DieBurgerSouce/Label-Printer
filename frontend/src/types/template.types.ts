/**
 * Template Rule System
 * Enables automatic template matching based on article properties
 */

export type RuleField = 'priceType' | 'category' | 'priceRange' | 'manufacturer';
export type RuleOperator = 'is' | 'isNot' | 'greaterThan' | 'lessThan' | 'contains';
export type PriceType = 'normal' | 'tiered';

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: string | number;
}

export interface TemplateRule {
  id: string;
  enabled: boolean;
  conditions: RuleCondition[];
  logic: 'AND' | 'OR';
}

export interface LabelTemplate {
  id: string;
  name: string;
  elements: TemplateElement[];
  printLayoutId?: string;
  printLayoutName?: string;
  width: number;
  height: number;
  widthMm?: number;
  heightMm?: number;

  // Template Rules for Auto-Matching
  rules?: TemplateRule;
  autoMatchEnabled: boolean;
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'articleNumber' | 'price' | 'description' | 'image' | 'qrCode' | 'priceTable';
  x: number;
  y: number;
  width: number;
  height: number;
  // ... weitere Element-Properties
}

export interface MatchResult {
  matched: Array<{
    articleId: string;
    templateId: string;
    articleNumber: string;
    templateName: string;
  }>;
  skipped: Array<{
    articleId: string;
    articleNumber: string;
    reason: string;
  }>;
}
