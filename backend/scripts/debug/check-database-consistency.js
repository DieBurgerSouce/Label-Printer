/**
 * Check database consistency and review all products
 */

const { prisma } = require('./dist/lib/supabase');

async function checkDatabase() {
  console.log('='.repeat(70));
  console.log('🔍 DATABASE CONSISTENCY CHECK');
  console.log('='.repeat(70));

  // Get total count
  const total = await prisma.product.count();
  console.log('\n📊 Total products:', total);

  // Get all products with details
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      articleNumber: true,
      productName: true,
      price: true,
      tieredPrices: true,
      tieredPricesText: true,
      imageUrl: true,
      crawlJobId: true,
      ocrConfidence: true,
      sourceUrl: true,
      ean: true,
      description: true,
      createdAt: true
    }
  });

  console.log('\n📋 ALL PRODUCTS IN DATABASE:\n');

  let issues = [];

  products.forEach((p, idx) => {
    console.log(`[${idx + 1}] Article: ${p.articleNumber}`);
    console.log(`    Name: ${p.productName}`);
    console.log(`    Price: ${p.price} EUR`);

    // Check for tiered prices
    if (p.tieredPrices && Array.isArray(p.tieredPrices) && p.tieredPrices.length > 0) {
      console.log(`    Tiered Prices: ${p.tieredPrices.length} tiers`);
      p.tieredPrices.forEach(tier => {
        console.log(`      - ab ${tier.quantity} Stk: ${tier.price} EUR`);
      });

      // Check tiered prices integrity
      const sortedPrices = [...p.tieredPrices].sort((a, b) => a.quantity - b.quantity);
      if (JSON.stringify(sortedPrices) !== JSON.stringify(p.tieredPrices)) {
        issues.push(`Product ${idx + 1} (${p.articleNumber}): Tiered prices not sorted by quantity`);
      }
    } else {
      console.log(`    Tiered Prices: none`);
    }

    console.log(`    Image: ${p.imageUrl ? 'YES (' + p.imageUrl + ')' : 'NO'}`);
    console.log(`    Source: ${p.sourceUrl}`);
    console.log(`    EAN: ${p.ean || 'none'}`);
    console.log(`    Description: ${p.description ? p.description.substring(0, 50) + '...' : 'none'}`);
    console.log(`    Crawl Job: ${p.crawlJobId}`);
    console.log(`    Created: ${p.createdAt}`);

    // Check for issues
    if (!p.articleNumber) {
      issues.push(`Product ${idx + 1}: Missing articleNumber`);
    }
    if (!p.productName || p.productName === 'Unknown Product') {
      issues.push(`Product ${idx + 1} (${p.articleNumber}): Missing or unknown productName`);
    }
    if (p.price === 0 && (!p.tieredPrices || p.tieredPrices.length === 0)) {
      issues.push(`Product ${idx + 1} (${p.articleNumber}): No price and no tiered prices`);
    }
    if (!p.imageUrl) {
      issues.push(`Product ${idx + 1} (${p.articleNumber}): Missing image URL`);
    }
    if (!p.sourceUrl || p.sourceUrl === 'https://shop.firmenich.de') {
      issues.push(`Product ${idx + 1} (${p.articleNumber}): Generic or missing source URL`);
    }

    console.log('');
  });

  console.log('='.repeat(70));
  console.log('🔍 CONSISTENCY ISSUES FOUND:');
  console.log('='.repeat(70));

  if (issues.length === 0) {
    console.log('✅ No major issues found!');
  } else {
    console.log(`\n⚠️  Found ${issues.length} issues:\n`);
    issues.forEach(issue => console.log('  -', issue));
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 STATISTICS:');
  console.log('='.repeat(70));
  console.log('Total products:', products.length);
  console.log('With tiered prices:', products.filter(p => p.tieredPrices && p.tieredPrices.length > 0).length);
  console.log('Without tiered prices:', products.filter(p => !p.tieredPrices || p.tieredPrices.length === 0).length);
  console.log('With single price > 0:', products.filter(p => p.price > 0).length);
  console.log('With images:', products.filter(p => p.imageUrl).length);
  console.log('With EAN:', products.filter(p => p.ean).length);
  console.log('With description:', products.filter(p => p.description).length);
  console.log('Average tiered prices per product:',
    (products.reduce((sum, p) => sum + (p.tieredPrices ? p.tieredPrices.length : 0), 0) / products.length).toFixed(2));

  // Check for duplicate article numbers
  const articleNumbers = products.map(p => p.articleNumber);
  const duplicates = articleNumbers.filter((item, index) => articleNumbers.indexOf(item) !== index);
  if (duplicates.length > 0) {
    console.log('\n⚠️  DUPLICATE ARTICLE NUMBERS:', duplicates);
  } else {
    console.log('\n✅ No duplicate article numbers');
  }

  console.log('='.repeat(70));

  process.exit(0);
}

checkDatabase().catch(console.error);
