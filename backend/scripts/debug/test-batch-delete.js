/**
 * Test the batch delete API
 */

async function testBatchDelete() {
  console.log('🧪 Testing Batch Delete API...\n');

  // First, get some label IDs to delete
  console.log('1️⃣ Fetching labels...');
  const labelsResponse = await fetch('http://localhost:3001/api/labels?limit=5');
  const labelsData = await labelsResponse.json();

  if (!labelsData.success) {
    console.error('❌ Failed to fetch labels:', labelsData.error);
    return;
  }

  const labels = labelsData.data.labels || [];
  console.log(`   Found ${labels.length} labels\n`);

  if (labels.length < 2) {
    console.log('⚠️  Need at least 2 labels to test batch delete');
    return;
  }

  // Select first 2 labels for testing
  const testLabelIds = labels.slice(0, 2).map(l => l.id);
  console.log(`2️⃣ Testing batch delete with 2 labels:`);
  testLabelIds.forEach((id, i) => {
    const label = labels[i];
    console.log(`   ${i + 1}. ${label.articleNumber}: ${label.productName} (${id})`);
  });

  // Ask for confirmation (since this is a test script, we'll skip)
  console.log(`\n⚠️  About to delete these ${testLabelIds.length} labels...`);
  console.log(`   (This is a test - proceeding automatically)\n`);

  // Test batch delete
  console.log('3️⃣ Calling batch delete API...');
  const deleteResponse = await fetch('http://localhost:3001/api/labels/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation: 'delete',
      labelIds: testLabelIds
    })
  });

  const deleteResult = await deleteResponse.json();

  if (deleteResult.success) {
    console.log(`   ✅ Batch delete successful!`);
    console.log(`   Response:`, JSON.stringify(deleteResult, null, 2));
  } else {
    console.error(`   ❌ Batch delete failed:`, deleteResult.error);
  }

  // Verify deletion
  console.log(`\n4️⃣ Verifying deletion...`);
  for (const id of testLabelIds) {
    const verifyResponse = await fetch(`http://localhost:3001/api/labels/${id}`);
    const verifyResult = await verifyResponse.json();

    if (verifyResult.success) {
      console.log(`   ❌ Label ${id} still exists (should have been deleted)`);
    } else {
      console.log(`   ✅ Label ${id} successfully deleted`);
    }
  }

  console.log('\n✅ Test complete!\n');
}

testBatchDelete().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
