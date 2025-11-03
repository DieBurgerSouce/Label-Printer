/**
 * Comprehensive Memory Leak Test
 * Tests all memory leak fixes with live monitoring
 */

async function comprehensiveTest() {
  console.log('🔍 COMPREHENSIVE MEMORY LEAK TEST\n');
  console.log('=' .repeat(60));

  // Get initial memory
  const initialHealth = await fetch('http://localhost:3001/api/health');
  const initial = await initialHealth.json();
  console.log('\n📊 INITIAL STATE:');
  console.log('   Process Memory:');
  console.log('     - RSS:', initial.memory.process.rss, 'MB');
  console.log('     - Heap Used:', initial.memory.process.heapUsed, 'MB');
  console.log('   System Memory:');
  console.log('     - Usage:', initial.memory.system.percentage, '%');

  // Test 1: Invalid URL (should trigger browser cleanup)
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Invalid URL - Browser Cleanup on Error');
  console.log('='.repeat(60));

  const test1Start = Date.now();
  try {
    const response = await fetch('http://localhost:3001/api/crawler/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopUrl: 'https://totally-invalid-url-that-will-definitely-fail-12345678.com',
        maxPages: 1
      })
    });

    const result = await response.json();
    const jobId = result.jobId;
    console.log('✅ Job started:', jobId);
    console.log('   Waiting for job to fail...');

    // Poll job status
    let attempts = 0;
    let jobStatus = null;

    while (attempts < 20) {
      await new Promise(r => setTimeout(r, 1000));
      attempts++;

      const statusResponse = await fetch(`http://localhost:3001/api/crawler/status/${jobId}`);
      jobStatus = await statusResponse.json();

      console.log(`   [${attempts}s] Job status: ${jobStatus.status}`);

      if (jobStatus.status === 'failed' || jobStatus.status === 'completed') {
        break;
      }
    }

    const test1End = Date.now();
    const test1Duration = Math.round((test1End - test1Start) / 1000);

    if (jobStatus && jobStatus.status === 'failed') {
      console.log('✅ Job failed as expected');
      console.log('   Error:', jobStatus.error);
      console.log('   Duration:', test1Duration, 'seconds');
    } else {
      console.log('⚠️  Job did not fail as expected');
      console.log('   Final Status:', jobStatus ? jobStatus.status : 'unknown');
    }

  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }

  // Wait a bit for cleanup
  console.log('\n   Waiting for browser cleanup...');
  await new Promise(r => setTimeout(r, 3000));

  // Check memory after test 1
  const afterTest1Health = await fetch('http://localhost:3001/api/health');
  const afterTest1 = await afterTest1Health.json();

  console.log('\n📊 AFTER TEST 1:');
  console.log('   Process Memory:');
  console.log('     - RSS:', afterTest1.memory.process.rss, 'MB (',
              afterTest1.memory.process.rss - initial.memory.process.rss, 'MB change)');
  console.log('     - Heap Used:', afterTest1.memory.process.heapUsed, 'MB (',
              afterTest1.memory.process.heapUsed - initial.memory.process.heapUsed, 'MB change)');

  // Test 2: Another invalid URL (test multiple failures)
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Multiple Failed Jobs - No Memory Accumulation');
  console.log('='.repeat(60));

  const test2Start = Date.now();
  try {
    const response = await fetch('http://localhost:3001/api/crawler/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopUrl: 'https://another-invalid-url-9876543210.com',
        maxPages: 1
      })
    });

    const result = await response.json();
    const jobId = result.jobId;
    console.log('✅ Job 2 started:', jobId);
    console.log('   Waiting for job to fail...');

    // Poll job status
    let attempts = 0;
    let jobStatus = null;

    while (attempts < 20) {
      await new Promise(r => setTimeout(r, 1000));
      attempts++;

      const statusResponse = await fetch(`http://localhost:3001/api/crawler/status/${jobId}`);
      jobStatus = await statusResponse.json();

      console.log(`   [${attempts}s] Job status: ${jobStatus.status}`);

      if (jobStatus.status === 'failed' || jobStatus.status === 'completed') {
        break;
      }
    }

    const test2End = Date.now();
    const test2Duration = Math.round((test2End - test2Start) / 1000);

    if (jobStatus && jobStatus.status === 'failed') {
      console.log('✅ Job 2 failed as expected');
      console.log('   Error:', jobStatus.error);
      console.log('   Duration:', test2Duration, 'seconds');
    }

  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }

  // Wait for cleanup
  console.log('\n   Waiting for browser cleanup...');
  await new Promise(r => setTimeout(r, 3000));

  // Final memory check
  const finalHealth = await fetch('http://localhost:3001/api/health');
  const final = await finalHealth.json();

  console.log('\n📊 FINAL STATE (After 2 failed jobs):');
  console.log('   Process Memory:');
  console.log('     - RSS:', final.memory.process.rss, 'MB (',
              final.memory.process.rss - initial.memory.process.rss, 'MB total change)');
  console.log('     - Heap Used:', final.memory.process.heapUsed, 'MB (',
              final.memory.process.heapUsed - initial.memory.process.heapUsed, 'MB total change)');
  console.log('   System Memory:');
  console.log('     - Usage:', final.memory.system.percentage, '%');

  // Analysis
  console.log('\n' + '='.repeat(60));
  console.log('ANALYSIS:');
  console.log('='.repeat(60));

  const rssChange = final.memory.process.rss - initial.memory.process.rss;
  const heapChange = final.memory.process.heapUsed - initial.memory.process.heapUsed;

  if (rssChange < 50 && heapChange < 20) {
    console.log('✅ MEMORY LEAK FIX VERIFIED');
    console.log('   Memory increase after 2 failed jobs is minimal:');
    console.log('   - RSS increase:', rssChange, 'MB (acceptable)');
    console.log('   - Heap increase:', heapChange, 'MB (acceptable)');
  } else {
    console.log('⚠️  POTENTIAL MEMORY LEAK DETECTED');
    console.log('   Memory increase is significant:');
    console.log('   - RSS increase:', rssChange, 'MB');
    console.log('   - Heap increase:', heapChange, 'MB');
  }

  console.log('\n' + '='.repeat(60));
  console.log('NEXT STEPS:');
  console.log('='.repeat(60));
  console.log('1. Check Docker logs for "✅ Browser cleaned up after error" messages');
  console.log('2. Run: docker logs screenshot-algo-backend | grep "Browser cleaned"');
  console.log('3. Monitor long-term with: docker stats screenshot-algo-backend');
}

comprehensiveTest().catch(console.error);
