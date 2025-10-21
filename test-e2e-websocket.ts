/**
 * End-to-End WebSocket Integration Test
 * Tests the full workflow: API → Database → WebSocket → Frontend
 */

import { io, Socket } from 'socket.io-client';
import axios from 'axios';

const WS_URL = 'http://localhost:3001';
const API_URL = 'http://localhost:3001/api';

interface EventCounter {
  jobCreated: number;
  jobUpdated: number;
  jobCompleted: number;
  jobFailed: number;
  screenshotCaptured: number;
  ocrCompleted: number;
  labelGenerated: number;
}

async function testE2EWebSocket() {
  console.log('🚀 End-to-End WebSocket Integration Test\n');
  console.log('='.repeat(60));
  console.log('\n📡 Step 1: Connecting to WebSocket server...\n');

  const socket: Socket = io(WS_URL, {
    transports: ['websocket', 'polling'],
  });

  const events: EventCounter = {
    jobCreated: 0,
    jobUpdated: 0,
    jobCompleted: 0,
    jobFailed: 0,
    screenshotCaptured: 0,
    ocrCompleted: 0,
    labelGenerated: 0,
  };

  let jobId: string | null = null;
  let jobCompleted = false;

  return new Promise<void>((resolve) => {
    socket.on('connect', async () => {
      console.log(`✅ Connected to WebSocket server (ID: ${socket.id})\n`);

      // Set up event listeners BEFORE starting the job
      socket.on('job:created', (data) => {
        console.log(`📨 [EVENT] job:created`);
        console.log(`   Job ID: ${data.jobId}`);
        console.log(`   Type: ${data.jobType}`);
        console.log(`   Name: ${data.name}\n`);
        events.jobCreated++;

        // Subscribe to this job
        if (data.jobType === 'automation') {
          jobId = data.jobId;
          socket.emit('job:subscribe', jobId);
          console.log(`📡 Subscribed to job room: job:${jobId}\n`);
        }
      });

      socket.on('job:updated', (data) => {
        console.log(`📨 [EVENT] job:updated`);
        console.log(`   Job ID: ${data.jobId}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Progress: ${data.progress}%`);
        console.log(`   Stage: ${data.currentStage}\n`);
        events.jobUpdated++;
      });

      socket.on('job:completed', (data) => {
        console.log(`📨 [EVENT] job:completed`);
        console.log(`   Job ID: ${data.jobId}`);
        console.log(`   Duration: ${data.duration}ms`);
        console.log(`   Results:`, JSON.stringify(data.results?.summary, null, 2));
        console.log('\n');
        events.jobCompleted++;
        jobCompleted = true;

        // Wait a bit for any remaining events
        setTimeout(() => {
          printSummary();
          socket.disconnect();
          resolve();
        }, 2000);
      });

      socket.on('job:failed', (data) => {
        console.log(`📨 [EVENT] job:failed`);
        console.log(`   Job ID: ${data.jobId}`);
        console.log(`   Error: ${data.error}`);
        console.log(`   Stage: ${data.stage}\n`);
        events.jobFailed++;

        setTimeout(() => {
          printSummary();
          socket.disconnect();
          resolve();
        }, 1000);
      });

      socket.on('screenshot:captured', (data) => {
        console.log(`📨 [EVENT] screenshot:captured`);
        console.log(`   Screenshot ID: ${data.screenshotId}`);
        console.log(`   Product: ${data.productName || 'N/A'}`);
        console.log(`   URL: ${data.url}\n`);
        events.screenshotCaptured++;
      });

      socket.on('ocr:completed', (data) => {
        console.log(`📨 [EVENT] ocr:completed`);
        console.log(`   OCR Result ID: ${data.ocrResultId}`);
        console.log(`   Article: ${data.data.articleNumber || 'N/A'}`);
        console.log(`   Price: ${data.data.price || 'N/A'}\n`);
        events.ocrCompleted++;
      });

      socket.on('label:generated', (data) => {
        console.log(`📨 [EVENT] label:generated`);
        console.log(`   Label ID: ${data.labelId}`);
        console.log(`   Article: ${data.articleNumber}\n`);
        events.labelGenerated++;
      });

      // Step 2: Start an automation job via API
      console.log('📋 Step 2: Starting automation job via API...\n');

      try {
        const response = await axios.post(`${API_URL}/automation/start`, {
          name: 'E2E WebSocket Test Job',
          shopUrl: 'https://example.com/products',
          templateId: 'test-template',
          crawlerConfig: {
            maxProducts: 3,
            followPagination: false,
          },
          ocrConfig: {
            extractFields: ['articleNumber', 'price'],
          },
          excelData: [],
        });

        console.log(`✅ Automation job started successfully!`);
        console.log(`   Job ID: ${response.data.jobId}`);
        console.log(`   Status: ${response.data.status}\n`);
        console.log('⏳ Waiting for WebSocket events...\n');
        console.log('='.repeat(60) + '\n');
      } catch (error: any) {
        console.error('❌ Failed to start automation job:', error.message);
        if (error.response) {
          console.error('   Response:', error.response.data);
        }
        socket.disconnect();
        resolve();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      resolve();
    });

    function printSummary() {
      console.log('='.repeat(60));
      console.log('\n📊 TEST SUMMARY\n');
      console.log('='.repeat(60));
      console.log('\n📈 Events Received:\n');
      console.log(`   job:created events:        ${events.jobCreated}`);
      console.log(`   job:updated events:        ${events.jobUpdated}`);
      console.log(`   job:completed events:      ${events.jobCompleted}`);
      console.log(`   job:failed events:         ${events.jobFailed}`);
      console.log(`   screenshot:captured events: ${events.screenshotCaptured}`);
      console.log(`   ocr:completed events:      ${events.ocrCompleted}`);
      console.log(`   label:generated events:    ${events.labelGenerated}`);
      console.log(`\n   Total Events Received:     ${Object.values(events).reduce((a, b) => a + b, 0)}`);

      console.log('\n');
      const success = jobCompleted && events.jobCreated > 0 && events.jobUpdated > 0;
      if (success) {
        console.log('✅ E2E WebSocket Integration: SUCCESS!');
      } else {
        console.log('❌ E2E WebSocket Integration: INCOMPLETE');
        console.log('   Job may still be running or failed');
      }
      console.log('\n' + '='.repeat(60) + '\n');
    }

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!jobCompleted) {
        console.log('\n⏱️  Test timeout reached (5 minutes)');
        printSummary();
        socket.disconnect();
        resolve();
      }
    }, 300000);
  });
}

// Run test
testE2EWebSocket()
  .then(() => {
    console.log('🏁 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
