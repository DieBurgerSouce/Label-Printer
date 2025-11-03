/**
 * Test Memory Leak Fix - Verify browser cleanup on error
 */

async function testMemoryLeakFix() {
  console.log('🧪 Testing Memory Leak Fix - Browser Cleanup on Error\n');

  // Test 1: Start crawl with invalid URL (should fail and clean up browser)
  console.log('Test 1: Invalid URL - should fail gracefully and clean up browser');

  try {
    const response = await fetch('http://localhost:3001/api/crawler/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopUrl: 'https://this-url-does-not-exist-and-will-fail-12345.com',
        maxPages: 1
      })
    });

    const result = await response.json();
    console.log('   Job started:', result.jobId);

    // Wait for job to fail
    console.log('   Waiting for job to fail...');
    await new Promise(r => setTimeout(r, 5000));

    // Check job status
    const statusResponse = await fetch(`http://localhost:3001/api/crawler/status/${result.jobId}`);
    const status = await statusResponse.json();

    console.log('   Job Status:', status.status);
    console.log('   Job Error:', status.error || 'None');

    if (status.status === 'failed') {
      console.log('   ✅ Job failed as expected - browser should be cleaned up\n');
    } else {
      console.log('   ⚠️  Job did not fail as expected\n');
    }

  } catch (error) {
    console.error('   ❌ Test failed:', error.message);
  }

  // Test 2: Check memory usage
  console.log('Test 2: Memory Usage Check');

  try {
    const healthResponse = await fetch('http://localhost:3001/api/health');
    const health = await healthResponse.json();

    console.log('   Process Memory:');
    console.log('     - RSS:', health.memory.process.rss, 'MB');
    console.log('     - Heap Used:', health.memory.process.heapUsed, 'MB');
    console.log('   System Memory:');
    console.log('     - Used:', health.memory.system.used, 'MB');
    console.log('     - Free:', health.memory.system.free, 'MB');
    console.log('     - Usage:', health.memory.system.percentage, '%');
    console.log('   ✅ Memory stats retrieved successfully\n');

  } catch (error) {
    console.error('   ❌ Health check failed:', error.message);
  }

  console.log('✅ Memory Leak Fix Test Completed');
  console.log('\nNext steps:');
  console.log('1. Check Docker logs for "✅ Browser cleaned up after error" message');
  console.log('2. Monitor memory usage over time with: docker stats screenshot-algo-backend');
}

testMemoryLeakFix().catch(console.error);
