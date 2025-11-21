import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Analyzing broken articles pattern...\n');

  // Get ALL broken articles
  const broken = await prisma.product.findMany({
    where: {
      productName: {
        startsWith: 'Product '
      }
    },
    select: {
      articleNumber: true,
      sourceUrl: true,
      ocrConfidence: true
    },
    orderBy: {
      articleNumber: 'asc'
    }
  });

  console.log(`Total broken: ${broken.length}\n`);

  // Check for patterns
  const withDash = broken.filter(a => a.articleNumber.includes('-'));
  const withoutDash = broken.filter(a => !a.articleNumber.includes('-'));

  console.log(`📊 Pattern Analysis:`);
  console.log(`  With dash (-): ${withDash.length} (${(withDash.length / broken.length * 100).toFixed(1)}%)`);
  console.log(`  Without dash:  ${withoutDash.length} (${(withoutDash.length / broken.length * 100).toFixed(1)}%)\n`);

  // Show examples
  console.log(`📋 Sample broken articles WITH dash:`);
  withDash.slice(0, 10).forEach(a => {
    const url = a.sourceUrl || '';
    const urlPart = url.split('/').pop() || '';
    console.log(`  ${a.articleNumber} - ${urlPart.substring(0, 50)}`);
  });

  console.log(`\n📋 Sample broken articles WITHOUT dash:`);
  withoutDash.slice(0, 10).forEach(a => {
    const url = a.sourceUrl || '';
    const urlPart = url.split('/').pop() || '';
    console.log(`  ${a.articleNumber} - ${urlPart.substring(0, 50)}`);
  });

  // Check OCR confidence distribution
  const avgConf = broken.reduce((sum, a) => sum + (a.ocrConfidence || 0), 0) / broken.length;
  console.log(`\n📈 Average OCR Confidence: ${avgConf.toFixed(3)}`);
}

main().finally(() => prisma.$disconnect());
