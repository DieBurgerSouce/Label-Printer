const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.product.count()
  .then(count => {
    console.log(`✅ Products in DB: ${count}`);
    return prisma.$disconnect();
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
