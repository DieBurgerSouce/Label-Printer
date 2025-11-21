import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get a successful article (not placeholder)
  const successfulArticle = await prisma.product.findFirst({
    where: {
      productName: {
        not: {
          startsWith: 'Product '
        }
      }
    },
    select: {
      id: true,
      articleNumber: true,
      productName: true,
      ocrConfidence: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log('\n✅ Latest successful article:');
  console.log(JSON.stringify(successfulArticle, null, 2));
}

main().finally(() => prisma.$disconnect());
