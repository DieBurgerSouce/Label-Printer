const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('='.repeat(80));
  console.log('COMPREHENSIVE DATABASE CHECK - ALL ARTICLES');
  console.log('='.repeat(80));

  // Get ALL articles
  const allArticles = await prisma.product.findMany({
    select: {
      articleNumber: true,
      productName: true,
      description: true,
      createdAt: true,
      crawlJobId: true
    }
  });

  console.log(`\n📊 Total Articles in Database: ${allArticles.length}`);

  // Check 1: Spacing Issues
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 1: SPACING ISSUES (letter followed by digit without space)');
  console.log('='.repeat(80));

  const spacingIssues = [];
  allArticles.forEach((a) => {
    const desc = a.description || '';
    const pattern = desc.match(/[a-z]\d/g);
    if (pattern && pattern.length > 0) {
      spacingIssues.push({
        article: a.articleNumber,
        name: a.productName,
        patterns: pattern,
        descSnippet: desc.substring(0, 100)
      });
    }
  });

  if (spacingIssues.length === 0) {
    console.log('✅ ✅ ✅ NO SPACING ISSUES FOUND!');
  } else {
    console.log(`❌ Found ${spacingIssues.length} articles with spacing issues:`);
    spacingIssues.slice(0, 10).forEach((issue, i) => {
      console.log(`\n${i + 1}. Article ${issue.article}:`);
      console.log(`   Name: ${issue.name}`);
      console.log(`   Patterns: ${issue.patterns.join(', ')}`);
      console.log(`   Description: ${issue.descSnippet}...`);
    });
    if (spacingIssues.length > 10) {
      console.log(`\n... and ${spacingIssues.length - 10} more`);
    }
  }

  // Check 2: Empty/Placeholder Products
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 2: EMPTY/PLACEHOLDER PRODUCTS');
  console.log('='.repeat(80));

  const emptyProducts = [];
  allArticles.forEach((a) => {
    if (!a.productName || a.productName.startsWith('Product ')) {
      emptyProducts.push({
        article: a.articleNumber,
        name: a.productName || 'NULL',
        created: a.createdAt
      });
    }
  });

  if (emptyProducts.length === 0) {
    console.log('✅ ✅ ✅ NO EMPTY/PLACEHOLDER PRODUCTS!');
  } else {
    console.log(`❌ Found ${emptyProducts.length} empty/placeholder products:`);
    emptyProducts.forEach((p, i) => {
      console.log(`${i + 1}. Article ${p.article}: "${p.name}" (created: ${p.created})`);
    });
  }

  // Check 3: Show 5 Random Real Examples
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 3: RANDOM SAMPLE - REAL DESCRIPTIONS FROM DATABASE');
  console.log('='.repeat(80));

  const withDescriptions = allArticles.filter(a => a.description && a.description.length > 50);
  const randomSamples = [];
  for (let i = 0; i < Math.min(5, withDescriptions.length); i++) {
    const randomIndex = Math.floor(Math.random() * withDescriptions.length);
    randomSamples.push(withDescriptions[randomIndex]);
  }

  randomSamples.forEach((a, i) => {
    console.log(`\n${i + 1}. Article ${a.articleNumber}:`);
    console.log(`   Name: ${a.productName}`);
    console.log(`   Description: ${a.description.substring(0, 150)}...`);
  });

  // Check 4: Recent Articles (last 24 hours)
  console.log('\n' + '='.repeat(80));
  console.log('CHECK 4: RECENT ARTICLES (Last 24 Hours)');
  console.log('='.repeat(80));

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const recentArticles = allArticles.filter(a => new Date(a.createdAt) > yesterday);
  console.log(`\n📅 Articles created in last 24h: ${recentArticles.length}`);

  const recentSpacingIssues = recentArticles.filter(a => {
    const desc = a.description || '';
    const pattern = desc.match(/[a-z]\d/g);
    return pattern && pattern.length > 0;
  });

  const recentEmptyProducts = recentArticles.filter(a =>
    !a.productName || a.productName.startsWith('Product ')
  );

  console.log(`   Spacing issues: ${recentSpacingIssues.length}`);
  console.log(`   Empty products: ${recentEmptyProducts.length}`);

  if (recentSpacingIssues.length === 0 && recentEmptyProducts.length === 0) {
    console.log('   ✅ All recent articles are CLEAN!');
  }

  // FINAL VERDICT
  console.log('\n' + '='.repeat(80));
  console.log('FINAL VERDICT');
  console.log('='.repeat(80));

  const totalIssues = spacingIssues.length + emptyProducts.length;

  if (totalIssues === 0) {
    console.log('\n🎉 🎉 🎉 PERFEKT! 🎉 🎉 🎉');
    console.log('✅ Keine Spacing-Probleme');
    console.log('✅ Keine Placeholder-Produkte');
    console.log('✅ Alle ' + allArticles.length + ' Artikel sind sauber');
    console.log('\n🚀 System ist 100% bereit für 1000+ Artikel Job!');
  } else {
    console.log(`\n⚠️  ${totalIssues} Probleme gefunden:`);
    console.log(`   - Spacing Issues: ${spacingIssues.length}`);
    console.log(`   - Empty Products: ${emptyProducts.length}`);
    console.log('\n❌ System ist NICHT bereit!');
  }

  console.log('='.repeat(80));

  await prisma.$disconnect();
})();
