// Quick test to find the right Supabase connection string
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jctdnesaafgncovopnyx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjdGRuZXNhYWZnbmNvdm9wbnl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDYyMDYzMywiZXhwIjoyMDc2MTk2NjMzfQ.jaEkdUTx_f3N5SYs0RTdlAdQi31FDNvfAa4kb88_QXs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');

    // Try to query a simple table or create one
    const { data, error } = await supabase
      .from('_test_connection')
      .select('*')
      .limit(1);

    if (error) {
      console.log('Error (expected if table doesnt exist):', error.message);

      // Try to get database info via REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      console.log('REST API Status:', response.status);

      if (response.ok) {
        console.log('✅ Supabase connection is working!');
        console.log('You can now run SQL migrations via Supabase Dashboard');
      }
    } else {
      console.log('✅ Connection successful!');
      console.log('Data:', data);
    }

  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
}

testConnection();
