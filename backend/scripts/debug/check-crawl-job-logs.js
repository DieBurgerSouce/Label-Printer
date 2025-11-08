/**
 * Extract all logs for a specific job
 */
const fs = require('fs');
const { execSync } = require('child_process');

const jobId = 'c5a7f5ca-40e4-46f2-abad-a348499610bf';

console.log(`\n📋 Extracting ALL logs for job ${jobId}...\n`);

// Get logs from Docker (last 10000 lines)
const logs = execSync(`docker logs screenshot-algo-backend 2>&1 | tail -10000`).toString();

// Split into lines
const lines = logs.split('\n');

// Find job start
const startIndex = lines.findIndex(l => l.includes(`Starting automation job: ${jobId}`));

if (startIndex === -1) {
  console.log('❌ Job start not found in logs');
  process.exit(1);
}

// Find job end
const endIndex = lines.findIndex((l, i) => i > startIndex && l.includes(`Automation job ${jobId} completed`));

if (endIndex === -1) {
  console.log('⚠️  Job end not found - job may still be running or crashed');
}

// Extract relevant logs
const jobLogs = lines.slice(startIndex, endIndex > 0 ? endIndex + 10 : undefined);

console.log(`Found ${jobLogs.length} log lines for this job\n`);
console.log('='.repeat(80));
console.log(jobLogs.join('\n'));
console.log('='.repeat(80));
