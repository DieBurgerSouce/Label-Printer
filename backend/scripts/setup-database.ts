/**
 * Database Setup Script
 *
 * This script performs a clean database setup:
 * 1. Generates Prisma Client
 * 2. Creates initial migration
 * 3. Runs migration against Supabase
 * 4. Verifies all tables are created
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';

const execAsync = promisify(exec);

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

function logStep(step: number, total: number, message: string) {
  log(`\n${colors.bright}[${step}/${total}] ${message}${colors.reset}`, colors.cyan);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

async function setupDatabase() {
  const totalSteps = 5;

  try {
    log('\n🚀 Starting Database Setup for Label Printer System\n', colors.bright);
    log('═══════════════════════════════════════════════════════', colors.cyan);

    // Step 1: Generate Prisma Client
    logStep(1, totalSteps, 'Generating Prisma Client...');
    try {
      const { stdout } = await execAsync('npx prisma generate', { cwd: process.cwd() });
      logSuccess('Prisma Client generated successfully');
      if (stdout) console.log(stdout);
    } catch (error: any) {
      logError('Failed to generate Prisma Client');
      throw error;
    }

    // Step 2: Create Initial Migration
    logStep(2, totalSteps, 'Creating initial migration...');
    try {
      const { stdout } = await execAsync(
        'npx prisma migrate dev --name initial_setup --create-only',
        { cwd: process.cwd() }
      );
      logSuccess('Initial migration created');
      if (stdout) console.log(stdout);
    } catch (error: any) {
      logError('Failed to create migration');
      throw error;
    }

    // Step 3: Apply Migration
    logStep(3, totalSteps, 'Applying migration to database...');
    try {
      const { stdout } = await execAsync('npx prisma migrate deploy', { cwd: process.cwd() });
      logSuccess('Migration applied successfully');
      if (stdout) console.log(stdout);
    } catch (error: any) {
      logError('Failed to apply migration');
      throw error;
    }

    // Step 4: Test Database Connection
    logStep(4, totalSteps, 'Testing database connection...');
    try {
      await prisma.$connect();
      logSuccess('Database connection established');
    } catch (error: any) {
      logError('Failed to connect to database');
      throw error;
    }

    // Step 5: Verify Tables
    logStep(5, totalSteps, 'Verifying database schema...');
    try {
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
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

      if (missingTables.length > 0) {
        logWarning(`Missing tables: ${missingTables.join(', ')}`);
      } else {
        logSuccess('All tables created successfully');
      }

      log('\n📊 Database Tables:', colors.bright);
      existingTables.forEach(table => {
        log(`   • ${table}`, colors.green);
      });
    } catch (error: any) {
      logError('Failed to verify schema');
      throw error;
    }

    // Success Summary
    log('\n═══════════════════════════════════════════════════════', colors.cyan);
    log('\n🎉 Database Setup Complete!\n', colors.green + colors.bright);
    log('Next steps:', colors.bright);
    log('  1. Start the backend: npm run dev');
    log('  2. Test the API: GET http://localhost:3001/api/health');
    log('  3. Optional: Seed test data with: npm run seed:db\n');

  } catch (error: any) {
    log('\n═══════════════════════════════════════════════════════', colors.red);
    logError('\nDatabase Setup Failed!\n');
    console.error(error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Check DATABASE_URL in .env');
    console.error('  2. Verify Supabase credentials');
    console.error('  3. Ensure database is accessible');
    console.error('  4. Check prisma/schema.prisma for errors\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run setup
setupDatabase().catch(console.error);
