/**
 * Prisma Client for Database Operations
 * Handles PostgreSQL connection via Prisma ORM
 * Includes transaction utilities for data consistency
 */

import { PrismaClient, Prisma } from '@prisma/client';
import logger from '../utils/logger';

// Prisma Client für Database Operations (PostgreSQL)
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * Transaction client type for use in transaction callbacks
 */
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Options for transaction execution
 */
export interface TransactionOptions {
  maxWait?: number; // Maximum time to wait for acquiring a transaction (default 5000ms)
  timeout?: number; // Maximum time for the transaction to complete (default 10000ms)
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

const DEFAULT_TRANSACTION_OPTIONS: TransactionOptions = {
  maxWait: 5000,
  timeout: 10000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

/**
 * Execute multiple operations in a transaction with automatic rollback on failure
 *
 * @example
 * const result = await withTransaction(async (tx) => {
 *   const user = await tx.user.create({ data: userData });
 *   const profile = await tx.profile.create({ data: { userId: user.id, ...profileData } });
 *   return { user, profile };
 * });
 */
export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const mergedOptions = { ...DEFAULT_TRANSACTION_OPTIONS, ...options };

  try {
    const result = await prisma.$transaction(fn, {
      maxWait: mergedOptions.maxWait,
      timeout: mergedOptions.timeout,
      isolationLevel: mergedOptions.isolationLevel,
    });

    return result;
  } catch (error) {
    logger.error('Transaction failed - rolled back', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Execute multiple independent operations in a batch (all or nothing)
 * Useful for bulk inserts/updates where order doesn't matter
 *
 * @example
 * const results = await batchTransaction([
 *   prisma.product.create({ data: product1 }),
 *   prisma.product.create({ data: product2 }),
 *   prisma.product.create({ data: product3 }),
 * ]);
 */
export async function batchTransaction<T>(operations: Prisma.PrismaPromise<T>[]): Promise<T[]> {
  try {
    const results = await prisma.$transaction(operations);
    logger.debug('Batch transaction completed', { operationCount: operations.length });
    return results;
  } catch (error) {
    logger.error('Batch transaction failed - rolled back', {
      operationCount: operations.length,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
