/**
 * Template Matching Engine
 * Automatically matches articles with templates based on rules
 */

import type { Product } from '../services/api';
import type {
  LabelTemplate,
  TemplateRule,
  RuleCondition,
  MatchResult,
} from '../types/template.types';

/**
 * Evaluates a single condition against an article
 */
export function evaluateCondition(article: Product, condition: RuleCondition): boolean {
  switch (condition.field) {
    case 'priceType': {
      const hasTieredPrices = article.tieredPrices && article.tieredPrices.length > 0;
      const hasNormalPrice = typeof article.price === 'number' && article.price > 0;
      const isAufAnfrage =
        article.tieredPricesText && article.tieredPricesText.toLowerCase().includes('auf anfrage');

      let articlePriceType: 'normal' | 'tiered' | 'auf-anfrage' | 'none';

      // Priority: tieredPrices > auf anfrage > normal > none
      if (hasTieredPrices) {
        articlePriceType = 'tiered';
      } else if (isAufAnfrage) {
        articlePriceType = 'auf-anfrage';
      } else if (hasNormalPrice) {
        articlePriceType = 'normal';
      } else {
        articlePriceType = 'none';
      }

      const expectedType = condition.value as 'normal' | 'tiered' | 'auf-anfrage';

      if (condition.operator === 'is') {
        return articlePriceType === expectedType;
      } else if (condition.operator === 'isNot') {
        return articlePriceType !== expectedType;
      }

      return false;
    }

    case 'category': {
      const articleCategory = article.category || '';
      const expectedCategory = String(condition.value);

      if (condition.operator === 'is') {
        return articleCategory === expectedCategory;
      } else if (condition.operator === 'isNot') {
        return articleCategory !== expectedCategory;
      } else if (condition.operator === 'contains') {
        return articleCategory.toLowerCase().includes(expectedCategory.toLowerCase());
      }

      return false;
    }

    case 'priceRange': {
      const articlePrice = article.price || 0;
      const threshold = Number(condition.value);

      if (condition.operator === 'greaterThan') {
        return articlePrice > threshold;
      } else if (condition.operator === 'lessThan') {
        return articlePrice < threshold;
      }

      return false;
    }

    case 'manufacturer': {
      const articleManufacturer = article.manufacturer || '';
      const expectedManufacturer = String(condition.value);

      if (condition.operator === 'is') {
        return articleManufacturer === expectedManufacturer;
      } else if (condition.operator === 'contains') {
        return articleManufacturer.toLowerCase().includes(expectedManufacturer.toLowerCase());
      }

      return false;
    }

    default:
      return false;
  }
}

/**
 * Evaluates all conditions of a rule using AND/OR logic
 */
export function evaluateRule(article: Product, rule: TemplateRule): boolean {
  if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  const results = rule.conditions.map((condition) => evaluateCondition(article, condition));

  if (rule.logic === 'AND') {
    // All conditions must be true
    return results.every((r) => r === true);
  } else {
    // At least one condition must be true
    return results.some((r) => r === true);
  }
}

/**
 * Finds the first matching template for an article
 * Note: Template order matters! First match wins.
 */
export function findMatchingTemplate(
  article: Product,
  templates: LabelTemplate[]
): LabelTemplate | null {
  // Only consider templates with auto-matching enabled
  const autoMatchTemplates = templates.filter((t) => t.autoMatchEnabled && t.rules?.enabled);

  // Return first matching template
  for (const template of autoMatchTemplates) {
    if (template.rules && evaluateRule(article, template.rules)) {
      return template;
    }
  }

  return null; // No match found
}

/**
 * Main function: Matches all articles with templates
 * Returns matched articles and skipped articles
 */
export function matchArticlesWithTemplates(
  articles: Product[],
  templates: LabelTemplate[]
): MatchResult {
  const matched: MatchResult['matched'] = [];
  const skipped: MatchResult['skipped'] = [];

  for (const article of articles) {
    const matchedTemplate = findMatchingTemplate(article, templates);

    if (matchedTemplate) {
      matched.push({
        articleId: article.id,
        templateId: matchedTemplate.id,
        articleNumber: article.articleNumber,
        templateName: matchedTemplate.name,
      });
    } else {
      skipped.push({
        articleId: article.id,
        articleNumber: article.articleNumber,
        reason: 'Kein passendes Template gefunden',
      });
    }
  }

  return { matched, skipped };
}

/**
 * Helper: Get price type of an article
 */
export function getArticlePriceType(article: Product): 'normal' | 'tiered' | 'none' {
  const hasTieredPrices = article.tieredPrices && article.tieredPrices.length > 0;
  const hasNormalPrice = typeof article.price === 'number' && article.price > 0;

  if (hasTieredPrices) {
    return 'tiered';
  } else if (hasNormalPrice) {
    return 'normal';
  } else {
    return 'none';
  }
}
