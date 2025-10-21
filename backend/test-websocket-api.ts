/**
 * Test WebSocket via API Endpoint
 * This test connects a WebSocket client and then triggers events via API
 */

import { io, Socket } from 'socket.io-client';

const WS_URL = 'http://localhost:3001';
const API_URL = 'http://localhost:3001/api/test-websocket/run';

async function testWebSocketViaAPI() {
  console.log('🚀 Testing WebSocket Integration via API Endpoint\n');
  console.log('==================================================\n');

  // Connect WebSocket client
  console.log(`📡 Connecting to WebSocket server at ${WS_URL}...`);
  const socket: Socket = io(WS_URL);

  await new Promise((resolve) => socket.on('connect', resolve));
  console.log(`✅ Connected to WebSocket server (ID: ${socket.id})\n`);

  // Event counters
  const events = {
    jobCreated: 0,
    jobUpdated: 0,
    jobCompleted: 0,
    screenshotCaptured: 0,
    ocrCompleted: 0,
  };

  let jobId: string | null = null;

  // Listen to all events
  socket.on('job:created', (data) => {
    console.log(`📨 [EVENT] job:created`, data);
    events.jobCreated++;

    // Subscribe to this job's room to receive job-specific events
    jobId = data.jobId;
    socket.emit('job:subscribe', jobId);
    console.log(`📡 Subscribed to job room: job:${jobId}\n`);
  });

  socket.on('job:updated', (data) => {
    console.log(`📨 [EVENT] job:updated`, data);
    events.jobUpdated++;
  });

  socket.on('job:completed', (data) => {
    console.log(`📨 [EVENT] job:completed`, data);
    events.jobCompleted++;
  });

  socket.on('screenshot:captured', (data) => {
    console.log(`📨 [EVENT] screenshot:captured`, data);
    events.screenshotCaptured++;
  });

  socket.on('ocr:completed', (data) => {
    console.log(`📨 [EVENT] ocr:completed`, data);
    events.ocrCompleted++;
  });

  console.log('⏳ Triggering test workflow via API...\n');

  // Call the API endpoint to trigger database operations
  const response = await fetch(API_URL, { method: 'POST' });
  const result = await response.json();

  console.log('\n📊 API Response:', result);

  // Wait a bit for all events to be received
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('\n==================================================\n');
  console.log('📊 Event Summary:\n');
  console.log(`   job:created events:        ${events.jobCreated}`);
  console.log(`   job:updated events:        ${events.jobUpdated}`);
  console.log(`   job:completed events:      ${events.jobCompleted}`);
  console.log(`   screenshot:captured events: ${events.screenshotCaptured}`);
  console.log(`   ocr:completed events:      ${events.ocrCompleted}`);

  const totalEvents =
    events.jobCreated +
    events.jobUpdated +
    events.jobCompleted +
    events.screenshotCaptured +
    events.ocrCompleted;

  console.log(`\n   Total Events Received:     ${totalEvents}`);

  console.log('\n==================================================\n');

  if (totalEvents >= 5) {
    console.log('✅ WebSocket Integration: SUCCESS!\n');
  } else {
    console.log('⚠️  WebSocket Integration: INCOMPLETE\n');
    console.log(`   Expected at least 5 events, got ${totalEvents}\n`);
  }

  socket.disconnect();
  console.log('🔌 Disconnected from WebSocket server\n');

  process.exit(totalEvents >= 5 ? 0 : 1);
}

testWebSocketViaAPI().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
