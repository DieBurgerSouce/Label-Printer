const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('\n🔍 Checking automation jobs...\n');

  const allJobs = await prisma.automationJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3
  });

  console.log(`📋 Recent jobs (${allJobs.length}):\n`);

  allJobs.forEach(job => {
    console.log(`Job ${job.id.substring(0, 8)}...`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Created: ${job.createdAt}`);
    console.log('');
  });

  await prisma.$disconnect();
}

check();
