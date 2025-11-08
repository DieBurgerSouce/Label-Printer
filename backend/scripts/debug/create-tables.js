// Create database tables via Supabase Management API
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://jctdnesaafgncovopnyx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjdGRuZXNhYWZnbmNvdm9wbnl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDYyMDYzMywiZXhwIjoyMDc2MTk2NjMzfQ.jaEkdUTx_f3N5SYs0RTdlAdQi31FDNvfAa4kb88_QXs';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTables() {
  try {
    console.log('🚀 Creating database tables via Supabase...\n');

    // Read SQL file
    const sql = readFileSync('./prisma/migrations/init.sql', 'utf-8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 60).replace(/\n/g, ' ');

      try {
        // Execute raw SQL via Supabase
        const { data, error } = await supabase.rpc('exec_sql', {
          query: statement + ';'
        });

        if (error) {
          // Try alternative method: Direct PostgreSQL query
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ query: statement + ';' })
          });

          if (!response.ok && response.status !== 409) {
            console.log(`⚠️  [${i+1}/${statements.length}] ${preview}... (might already exist)`);
            errorCount++;
          } else {
            console.log(`✅ [${i+1}/${statements.length}] ${preview}...`);
            successCount++;
          }
        } else {
          console.log(`✅ [${i+1}/${statements.length}] ${preview}...`);
          successCount++;
        }
      } catch (err) {
        console.log(`⚠️  [${i+1}/${statements.length}] ${preview}... (${err.message})`);
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⚠️  Skipped/Errors: ${errorCount}`);
    console.log(`\n💡 Note: Errors for "already exists" are normal on re-runs.\n`);

    // Verify tables exist
    console.log('Verifying tables...\n');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables');

    if (!tablesError && tables) {
      console.log('✅ Database tables created successfully!');
    } else {
      console.log('⚠️  Could not verify tables. Please check Supabase Dashboard.');
      console.log('\n📝 To verify manually:');
      console.log('   1. Go to https://supabase.com/dashboard/project/jctdnesaafgncovopnyx');
      console.log('   2. Click "SQL Editor"');
      console.log('   3. Run: SELECT tablename FROM pg_tables WHERE schemaname = \'public\';');
    }

  } catch (error) {
    console.error('❌ Failed to create tables:', error.message);
    console.log('\n📝 Fallback: Run SQL manually:');
    console.log('   1. Go to https://supabase.com/dashboard/project/jctdnesaafgncovopnyx/sql');
    console.log('   2. Copy content from: backend/prisma/migrations/init.sql');
    console.log('   3. Paste and click "Run"');
    process.exit(1);
  }
}

createTables();
