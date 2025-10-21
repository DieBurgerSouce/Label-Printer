/**
 * Get real product URLs from last successful crawl
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      crawlJobId: 'c45af749-a1f0-463e-812c-6b441a083b2c',
    },
    select: {
      sourceUrl: true,
      productName: true,
      price: true,
      tieredPrices: true,
    },
    take: 15,
  });

  console.log('Real product URLs from crawl c45af749:');
  console.log('='.repeat(80));

  products.forEach((p, i) => {
    console.log(`${i + 1}. ${p.sourceUrl}`);
    console.log(`   Title: ${p.productName || 'N/A'}`);
    console.log(`   Price: ${p.price || 'N/A'}`);
    console.log(`   Has tiered prices: ${p.tieredPrices ? 'YES' : 'NO'}`);
    console.log('');
  });

  await prisma.$disconnect();
}

main().catch(console.error);
