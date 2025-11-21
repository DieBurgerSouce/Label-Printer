/**
 * Cleanup Database - Keep Only 5 Articles
 *
 * Deletes all articles from PostgreSQL except the first 5
 */

import { prisma } from './src/lib/supabase.js';

async function cleanupDatabase() {
  console.log('='.repeat(80));
  console.log('Database Cleanup - Keep Only 5 Articles');
  console.log('='.repeat(80));

  try {
    // Get current count
    const totalCount = await prisma.product.count();
    console.log(`\nCurrent articles in database: ${totalCount}`);

    if (totalCount <= 5) {
      console.log(`\n✅ Already have ${totalCount} articles (≤ 5). Nothing to do.`);
      await prisma.$disconnect();
      return;
    }

    // Get first 5 articles (ordered by createdAt desc)
    const articlesToKeep = await prisma.product.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        articleNumber: true,
        productName: true
      }
    });

    console.log(`\n📋 Keeping these 5 articles:`);
    articlesToKeep.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.articleNumber} - ${a.productName}`);
    });

    const idsToKeep = articlesToKeep.map(a => a.id);

    // Delete all others
    console.log(`\n🗑️  Deleting ${totalCount - 5} articles...`);

    const deleteResult = await prisma.product.deleteMany({
      where: {
        id: {
          notIn: idsToKeep
        }
      }
    });

    console.log(`\n✅ Deleted ${deleteResult.count} articles`);

    // Verify
    const newCount = await prisma.product.count();
    console.log(`\n📊 Verification:`);
    console.log(`  Before: ${totalCount} articles`);
    console.log(`  After: ${newCount} articles`);
    console.log(`  Deleted: ${totalCount - newCount}`);

    if (newCount === 5) {
      console.log(`\n✅ Success! Database now has exactly 5 articles`);
      console.log(`\n🚀 Ready for new crawl job!`);
    } else {
      console.log(`\n⚠️  Warning: Expected 5 articles but found ${newCount}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup
cleanupDatabase()
  .then(() => {
    console.log('\n✅ Cleanup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });
