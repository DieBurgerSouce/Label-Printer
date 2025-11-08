const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.label.findFirst({
  where: { articleNumber: '8116' },
  select: {
    id: true,
    articleNumber: true,
    productName: true,
    priceInfo: true,
    imageData: true
  }
}).then(label => {
  console.log('\n✅ Label for Article #8116:');
  console.log('   Product:', label.productName);
  console.log('   Price Info:', JSON.stringify(label.priceInfo, null, 2));
  console.log('   Has Image Data:', !!label.imageData);
  console.log('   Image Size:', label.imageData ? `${label.imageData.length} bytes` : 'N/A');
  return prisma.$disconnect();
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
