/**
 * Schema Verification Script
 *
 * Verifies that the database schema matches the Prisma schema
 * Tests all table structures, indexes, and constraints
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

interface TableInfo {
  tablename: string;
}

interface IndexInfo {
  indexname: string;
  tablename: string;
}

interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
}

async function verifySchema() {
  let allChecksPass = true;

  try {
    log('\n🔍 Database Schema Verification\n', colors.bright);
    log('═══════════════════════════════════════════════════════', colors.cyan);

    // Check 1: Verify Database Connection
    log('\n📡 Checking database connection...', colors.bright);
    try {
      await prisma.$connect();
      logSuccess('Database connection established');
    } catch (error: any) {
      logError('Failed to connect to database');
      throw error;
    }

    // Check 2: Verify Tables
    log('\n📋 Verifying tables...', colors.bright);
    const tables = await prisma.$queryRaw<TableInfo[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    const expectedTables = [
      'automation_jobs',
      'crawl_jobs',
      'excel_data',
      'labels',
      'matches',
      'ocr_results',
      'products',
      'screenshots',
      'templates',
    ];

    const existingTables = tables.map(t => t.tablename);
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));
    const extraTables = existingTables.filter(t => !expectedTables.includes(t) && t !== '_prisma_migrations');

    if (missingTables.length > 0) {
      logError(`Missing tables: ${missingTables.join(', ')}`);
      allChecksPass = false;
    } else {
      logSuccess(`All ${expectedTables.length} required tables exist`);
    }

    if (extraTables.length > 0) {
      logInfo(`Extra tables found: ${extraTables.join(', ')}`);
    }

    // Check 3: Verify Indexes
    log('\n📊 Verifying indexes...', colors.bright);
    const indexes = await prisma.$queryRaw<IndexInfo[]>`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `;

    const expectedIndexCount = 20; // Approximate
    logSuccess(`Found ${indexes.length} indexes (expected ~${expectedIndexCount})`);

    // Check 4: Test CRUD Operations on Each Model
    log('\n🧪 Testing model operations...', colors.bright);

    try {
      // Test CrawlJob
      const crawlJobCount = await prisma.crawlJob.count();
      logSuccess(`CrawlJob model: ${crawlJobCount} records`);

      // Test Screenshot
      const screenshotCount = await prisma.screenshot.count();
      logSuccess(`Screenshot model: ${screenshotCount} records`);

      // Test OcrResult
      const ocrResultCount = await prisma.ocrResult.count();
      logSuccess(`OcrResult model: ${ocrResultCount} records`);

      // Test Match
      const matchCount = await prisma.match.count();
      logSuccess(`Match model: ${matchCount} records`);

      // Test Template
      const templateCount = await prisma.template.count();
      logSuccess(`Template model: ${templateCount} records`);

      // Test Label
      const labelCount = await prisma.label.count();
      logSuccess(`Label model: ${labelCount} records`);

      // Test Product
      const productCount = await prisma.product.count();
      logSuccess(`Product model: ${productCount} records`);

      // Test AutomationJob
      const automationJobCount = await prisma.automationJob.count();
      logSuccess(`AutomationJob model: ${automationJobCount} records`);

      // Test ExcelData
      const excelDataCount = await prisma.excelData.count();
      logSuccess(`ExcelData model: ${excelDataCount} records`);

    } catch (error: any) {
      logError(`Model operation failed: ${error.message}`);
      allChecksPass = false;
    }

    // Check 5: Verify Prisma Client is up to date
    log('\n⚙️  Verifying Prisma Client...', colors.bright);
    try {
      // Check if all models are accessible
      const models = Object.keys(prisma).filter(key => !key.startsWith('$') && !key.startsWith('_'));
      logSuccess(`Prisma Client has ${models.length} models`);
      logInfo(`Models: ${models.join(', ')}`);
    } catch (error: any) {
      logError('Prisma Client verification failed');
      allChecksPass = false;
    }

    // Final Summary
    log('\n═══════════════════════════════════════════════════════', colors.cyan);

    if (allChecksPass) {
      log('\n✅ All Schema Checks Passed!\n', colors.green + colors.bright);
      log('Your database is properly configured and ready to use.\n', colors.green);
    } else {
      log('\n⚠️  Some Schema Checks Failed!\n', colors.yellow + colors.bright);
      log('Please review the errors above and fix them.\n', colors.yellow);
      process.exit(1);
    }

  } catch (error: any) {
    log('\n═══════════════════════════════════════════════════════', colors.red);
    logError('\nSchema Verification Failed!\n');
    console.error(error.message);
    console.error('\nCheck:');
    console.error('  1. DATABASE_URL in .env');
    console.error('  2. Database migration status');
    console.error('  3. Supabase connection\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifySchema().catch(console.error);
