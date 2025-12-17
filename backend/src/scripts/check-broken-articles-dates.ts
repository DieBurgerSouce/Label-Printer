import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const broken = await prisma.product.findMany({
    where: {
      productName: {
        startsWith: 'Product ',
      },
    },
    select: {
      articleNumber: true,
      ocrConfidence: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  console.log('\n📅 Latest 10 broken articles (by creation date):');
  broken.forEach((p) => {
    console.log(
      `  ${p.articleNumber} - ${p.createdAt.toISOString().split('T')[0]} ${p.createdAt.toISOString().split('T')[1].substring(0, 8)} - Conf: ${p.ocrConfidence}`
    );
  });
}

main().finally(() => prisma.$disconnect());
