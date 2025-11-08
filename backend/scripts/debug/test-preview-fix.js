/**
 * Test the preview fix - verify staffelpreise are displayed correctly
 */

async function testPreview() {
  console.log('🔍 Testing Print Preview Fix...\n');

  // Create a simple print setup with article #8358 (has 4 staffelpreise)
  const response = await fetch('http://localhost:3001/api/print/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      labelIds: ['20a90532-6676-46c8-99ef-bda3d10a21f2'], // Article #8358
      format: 'A4',
      gridConfig: {
        columns: 2,
        rows: 3,
        spacing: 5,
        marginTop: 10,
        marginBottom: 10,
        marginLeft: 10,
        marginRight: 10
      }
    }),
  });

  if (response.ok) {
    const svgText = await response.text();
    
    console.log('✅ Preview generated successfully\n');
    console.log('📄 SVG length:', svgText.length, 'characters\n');
    
    // Save SVG to file for inspection
    const fs = require('fs');
    fs.writeFileSync('/app/test-preview.svg', svgText);
    console.log('💾 Saved to /app/test-preview.svg\n');
    
    // Show a sample of the SVG content
    console.log('📋 First 1000 characters:');
    console.log(svgText.substring(0, 1000));
    console.log('\n...\n');
    
    // Search for price-related content
    const priceLines = svgText.split('\n').filter(line => 
      line.toLowerCase().includes('preis') || 
      line.includes('€') || 
      line.includes('EUR') ||
      line.includes('8358')
    );
    
    console.log('💰 Price-related lines found:', priceLines.length);
    priceLines.slice(0, 10).forEach((line, i) => {
      console.log(`   ${i+1}:`, line.trim().substring(0, 100));
    });
    
  } else {
    console.error('❌ Failed to generate preview:', response.status);
    const error = await response.text();
    console.error('   Error:', error);
  }
}

testPreview().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
