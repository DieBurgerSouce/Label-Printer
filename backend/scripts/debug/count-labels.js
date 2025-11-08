const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.label.count()
  .then(count => {
    console.log(`✅ Labels in DB: ${count}`);
    return prisma.$disconnect();
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
