/**
 * Prisma Client for Database Operations
 * Handles PostgreSQL connection via Prisma ORM
 */

import { PrismaClient } from '@prisma/client';

// Prisma Client für Database Operations (PostgreSQL)
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
