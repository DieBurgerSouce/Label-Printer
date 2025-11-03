/**
 * Template Checker - Prüft, ob Templates korrekt gespeichert werden
 *
 * Verwendung:
 *   node check-templates.js
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';
const TEMPLATES_DIR = path.join(__dirname, 'backend', 'data', 'label-templates');

async function checkTemplates() {
  console.log('🔍 Template System Check\n');
  console.log('='.repeat(50));

  // 1. Check if templates directory exists
  console.log('\n📁 Checking templates directory...');
  try {
    const stat = await fs.stat(TEMPLATES_DIR);
    console.log(`✓ Directory exists: ${TEMPLATES_DIR}`);
    console.log(`  Permissions: ${stat.mode.toString(8)}`);
  } catch (error) {
    console.log(`✗ Directory not found: ${TEMPLATES_DIR}`);
    console.log('  Creating directory...');
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    console.log('✓ Directory created');
  }

  // 2. List all template files
  console.log('\n📋 Listing template files...');
  try {
    const files = await fs.readdir(TEMPLATES_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.log('  No templates found');
    } else {
      console.log(`  Found ${jsonFiles.length} template(s):`);
      for (const file of jsonFiles) {
        const content = await fs.readFile(path.join(TEMPLATES_DIR, file), 'utf-8');
        const template = JSON.parse(content);
        console.log(`    - ${file}: "${template.name}" (${template.elements?.length || 0} elements)`);
      }
    }
  } catch (error) {
    console.log(`✗ Error reading directory: ${error.message}`);
  }

  // 3. Test API endpoint
  console.log('\n🌐 Testing API endpoint...');
  try {
    const response = await axios.get(`${API_BASE_URL}/api/label-templates`);

    if (response.data.success) {
      console.log(`✓ API is working`);
      console.log(`  Templates returned: ${response.data.templates?.length || 0}`);

      if (response.data.templates && response.data.templates.length > 0) {
        console.log('  Template list:');
        response.data.templates.forEach(t => {
          console.log(`    - ID: ${t.id}, Name: "${t.name}", Elements: ${t.elementsCount}`);
        });
      }
    } else {
      console.log('✗ API returned success=false');
    }
  } catch (error) {
    console.log(`✗ API Error: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.log('  → Backend is not running! Start it with: docker-compose up -d');
    }
  }

  // 4. Test write permissions
  console.log('\n✏️  Testing write permissions...');
  const testFile = path.join(TEMPLATES_DIR, 'test-write-permission.json');
  try {
    await fs.writeFile(testFile, JSON.stringify({ test: true }, null, 2));
    console.log('✓ Write permission OK');
    await fs.unlink(testFile);
    console.log('✓ Delete permission OK');
  } catch (error) {
    console.log(`✗ Write/Delete permission error: ${error.message}`);
    console.log('  → Run as Administrator or check folder permissions!');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Check complete!\n');
}

// Run the check
checkTemplates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
