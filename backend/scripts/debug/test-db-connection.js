const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully!');

    // Test query
    const count = await prisma.product.count();
    console.log(`✅ Products table exists, count: ${count}`);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
