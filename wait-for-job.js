const axios = require('axios');

const jobId = process.argv[2];
const API_BASE = 'http://localhost:3001/api';

async function waitForJob() {
  console.log('⏳ Warte auf Job-Completion...\n');

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));

    try {
      const response = await axios.get(`${API_BASE}/crawler/jobs/${jobId}`);
      const status = response.data.data.status;

      if (status === 'completed') {
        console.log('\n✅ Job completed!');
        process.exit(0);
      } else if (status === 'failed') {
        console.log('\n❌ Job failed!');
        process.exit(1);
      }

      if (i % 5 === 0) {
        process.stdout.write('.');
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  }

  console.log('\n⚠️ Timeout');
  process.exit(1);
}

waitForJob();
