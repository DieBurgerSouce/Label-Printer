const { PrismaClient } = require('@prisma/client');
const { AutomationService } = require('./dist/services/automation-service');

const prisma = new PrismaClient();

(async () => {
  console.log('='.repeat(80));
  console.log('Delete and Re-crawl Articles 8120 & 8121');
  console.log('='.repeat(80));

  // Step 1: Delete
  console.log('\n🗑️  Deleting articles 8120 and 8121...');
  const deleted = await prisma.product.deleteMany({
    where: {
      articleNumber: { in: ['8120', '8121'] }
    }
  });
  console.log(`   ✅ Deleted ${deleted.count} articles`);

  // Step 2: Crawl
  console.log('\n🌐 Re-crawling URL with NEW backend...');
  const url = 'https://shop.firmenich.de/Erntekoerbe/Apfelpflueckkorb-klein-aus-Aluminium-verschiedene-Ausfuehrungen';

  const automationService = new AutomationService();
  await automationService.processUrl(url);

  console.log('\n✅ Done!');
  await prisma.$disconnect();
})();
