/**
 * Re-parse all tieredPricesText to fix OCR errors (e.g., "SO" -> "50")
 * This script updates existing articles in the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TieredPrice {
  quantity: number;
  price: string;
}

/**
 * Fix common OCR errors in numbers (e.g., "SO" -> "50", "O" -> "0", "l" -> "1")
 */
function fixOCRNumberErrors(text: string): string {
  return (
    text
      // "SO" -> "50" (very common in German price tables - in "AbSO", "BisSO", etc.)
      .replace(/SO(?=\s|$|[^\w])/gi, '50') // ⚡ FIX: Lookahead instead of \b
      // "O" (letter) -> "0" (digit) when surrounded by digits or at end
      .replace(/([0-9])O([0-9])/g, '$10$2')
      .replace(/O([0-9])/g, '0$1')
      .replace(/([0-9])O\b/g, '$10')
      // "l" (lowercase L) or "I" (uppercase i) -> "1"
      .replace(/\bl\b/g, '1')
      .replace(/\bI\b/g, '1')
  );
}

/**
 * Parse tiered prices with OCR error correction
 */
function parseTieredPrices(text: string): TieredPrice[] {
  const prices: TieredPrice[] = [];
  const lines = text.split('\n');

  // ⚡ FIX: Match "Bis" or "Ab" prefix to get the correct quantity!
  // Removed /g flag - we only need ONE match per line!
  const pricePattern = /(?:bis|ab)\s*(\d+)\s*(?:stück|stk|pcs)?.*?(\d+[,.]?\d*)\s*€/i;

  for (let line of lines) {
    // Apply OCR error corrections
    line = fixOCRNumberErrors(line);

    // Use match() instead of exec() - safer!
    const match = line.match(pricePattern);
    if (match) {
      prices.push({
        quantity: parseInt(match[1]),
        price: match[2].replace(',', '.'),
      });
    }
  }

  return prices;
}

async function main() {
  console.log('🔄 Starting tiered prices re-parsing...\n');

  // Get all articles with tieredPricesText
  const articles = await prisma.product.findMany({
    where: {
      tieredPricesText: {
        not: null,
      },
    },
  });

  console.log(`📦 Found ${articles.length} articles with tiered prices\n`);

  let updatedCount = 0;
  let fixedCount = 0;

  for (const article of articles) {
    if (!article.tieredPricesText) continue;

    // Parse with new OCR-error-corrected parser
    const newTieredPrices = parseTieredPrices(article.tieredPricesText);

    // Get old tieredPrices
    const oldTieredPrices = article.tieredPrices as any[];
    const oldCount = Array.isArray(oldTieredPrices) ? oldTieredPrices.length : 0;
    const newCount = newTieredPrices.length;

    // Only update if count changed (meaning OCR errors were fixed)
    if (oldCount !== newCount) {
      console.log(`🔧 Fixing Article #${article.articleNumber}: ${article.productName}`);
      console.log(`   Old: ${oldCount} tiers → New: ${newCount} tiers`);
      console.log(`   Text: ${article.tieredPricesText}`);

      await prisma.product.update({
        where: { id: article.id },
        data: {
          tieredPrices: newTieredPrices as any,
        },
      });

      fixedCount++;
    }

    updatedCount++;
  }

  console.log(`\n✅ Re-parsing complete!`);
  console.log(`   Total articles checked: ${updatedCount}`);
  console.log(`   Articles fixed: ${fixedCount}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
