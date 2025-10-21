// Test different connection strings to find the right one
import pg from 'pg';
const { Client } = pg;

// Password needs URL encoding: v8$M@$3pdxMsq-/ becomes v8%24M%40%243pdxMsq-%2F
const PASSWORD_ENCODED = 'v8%24M%40%243pdxMsq-%2F';

const connectionStrings = [
  // Option 1: Direct connection
  `postgresql://postgres.jctdnesaafgncovopnyx:${PASSWORD_ENCODED}@db.jctdnesaafgncovopnyx.supabase.co:5432/postgres`,

  // Option 2: Pooler connection (Session mode)
  `postgresql://postgres.jctdnesaafgncovopnyx:${PASSWORD_ENCODED}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,

  // Option 3: Pooler (Transaction mode)
  `postgresql://postgres.jctdnesaafgncovopnyx:${PASSWORD_ENCODED}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,

  // Option 4: Pooler port 6543 without pgbouncer flag
  `postgresql://postgres.jctdnesaafgncovopnyx:${PASSWORD_ENCODED}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
];

async function testConnection(connectionString, index) {
  const client = new Client({ connectionString });

  try {
    console.log(`\n🔍 Testing connection #${index + 1}...`);
    console.log(`   ${connectionString.substring(0, 50)}...`);

    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log(`✅ SUCCESS! Server time: ${res.rows[0].now}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    try {
      await client.end();
    } catch {}
    return false;
  }
}

async function findWorkingConnection() {
  console.log('🚀 Testing Supabase PostgreSQL connections...\n');

  for (let i = 0; i < connectionStrings.length; i++) {
    const works = await testConnection(connectionStrings[i], i);
    if (works) {
      console.log(`\n✨ Found working connection! Use this in .env:\n`);
      console.log(`DATABASE_URL="${connectionStrings[i]}"`);
      process.exit(0);
    }
  }

  console.log('\n❌ None of the connections worked.');
  console.log('📝 Please get the correct connection string from Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard/project/jctdnesaafgncovopnyx/settings/database');
  process.exit(1);
}

findWorkingConnection();
