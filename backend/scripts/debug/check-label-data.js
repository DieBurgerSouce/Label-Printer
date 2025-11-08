const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.label.findMany({
  take: 5,
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    templateId: true,
    data: true,
    imageUrl: true,
    status: true
  }
}).then(labels => {
  console.log('\n🏷️  Recent Labels:\n');

  labels.forEach(label => {
    const data = label.data;
    console.log(`   Label ID: ${label.id.slice(0, 8)}...`);
    console.log(`   Data:`, JSON.stringify(data, null, 2));
    console.log(`   Image: ${label.imageUrl ? 'Yes' : 'No'}`);
    console.log(`   Status: ${label.status}`);
    console.log('');
  });

  return prisma.$disconnect();
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
