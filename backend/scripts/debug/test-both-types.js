/**
 * Test preview with both single-price and staffelpreise articles
 */

async function testBoth() {
  console.log('🧪 Testing preview with both article types...\n');

  // Test staffelpreise article (#4631)
  console.log('1️⃣ Testing STAFFELPREISE article #4631...');
  let response = await fetch('http://localhost:3001/api/print/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      labelIds: ['0abf6e79-de37-43be-a5e2-b5d24be17cf1'],
      format: 'A4',
      gridConfig: { columns: 2, rows: 3, spacing: 5, marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10 }
    }),
  });
  
  if (response.ok) {
    console.log('   ✅ Preview generated\n');
  } else {
    console.error('   ❌ Failed:', await response.text());
  }

  // Test single-price article (#8196)
  console.log('2️⃣ Testing SINGLE PRICE article #8196...');
  response = await fetch('http://localhost:3001/api/print/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      labelIds: ['15555ef5-9bae-4ad3-9291-39cddcc20c95'],
      format: 'A4',
      gridConfig: { columns: 2, rows: 3, spacing: 5, marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10 }
    }),
  });
  
  if (response.ok) {
    console.log('   ✅ Preview generated\n');
  } else {
    console.error('   ❌ Failed:', await response.text());
  }

  console.log('✅ Both types tested! Check backend logs for results.\n');
}

testBoth().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
