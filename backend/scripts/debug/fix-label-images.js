const fs = require('fs').promises;
const path = require('path');

async function fixLabelImages() {
  const labelsDir = path.join(__dirname, 'data', 'labels');

  try {
    const labelFolders = await fs.readdir(labelsDir);
    let fixed = 0;
    let errors = 0;

    console.log(`🔍 Found ${labelFolders.length} label folders to check...`);

    for (const folder of labelFolders) {
      const labelPath = path.join(labelsDir, folder, 'label.json');
      const imagePath = path.join(labelsDir, folder, 'image.png');

      try {
        // Check if image.png already exists
        try {
          await fs.access(imagePath);
          console.log(`✅ ${folder} already has image.png`);
          continue;
        } catch (e) {
          // No image.png, need to create it
        }

        // Read label.json
        const labelData = JSON.parse(await fs.readFile(labelPath, 'utf-8'));

        if (labelData.imageData) {
          if (labelData.imageData.type === 'Buffer' && Array.isArray(labelData.imageData.data)) {
            // Convert JSON Buffer to real Buffer
            const buffer = Buffer.from(labelData.imageData.data);

            // Save as image.png
            await fs.writeFile(imagePath, buffer);

            // Remove imageData from label.json to save space
            delete labelData.imageData;
            await fs.writeFile(labelPath, JSON.stringify(labelData, null, 2));

            fixed++;
            console.log(`✅ Fixed ${folder} - created image.png (${buffer.length} bytes)`);
          }
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error processing ${folder}:`, error.message);
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`✅ Fixed: ${fixed} labels`);
    console.log(`❌ Errors: ${errors} labels`);
    console.log(`⏭️  Skipped: ${labelFolders.length - fixed - errors} labels (already had image.png)`);

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

fixLabelImages();