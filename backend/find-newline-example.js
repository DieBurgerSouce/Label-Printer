const fs = require('fs');

const old = JSON.parse(fs.readFileSync('../data/articles-export-2025-11-02.json', 'utf-8'));

// Find article with newlines
const articleWithNewlines = old.articles.find(a => a.description && a.description.includes('\n'));

if (articleWithNewlines) {
  console.log('=== Article with newlines ===');
  console.log('Article:', articleWithNewlines.articleNumber, '-', articleWithNewlines.productName);
  console.log('\nDescription:');
  console.log(articleWithNewlines.description);
  console.log('\n--- Visualizing newlines (\\n shown as [NL]) ---');
  console.log(articleWithNewlines.description.replace(/\n/g, '[NL]').substring(0, 500));

  // Check for concatenated words pattern
  console.log('\n--- Checking for concatenated words ---');
  const lines = articleWithNewlines.description.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const currentLine = lines[i];
    const nextLine = lines[i+1];

    if (currentLine && nextLine) {
      const lastChar = currentLine.trim().slice(-1);
      const firstChar = nextLine.trim().charAt(0);

      // Check if last word of current line + first word of next line would be problematic
      const lastWord = currentLine.trim().split(' ').pop();
      const firstWord = nextLine.trim().split(' ')[0];

      console.log(`Line ${i+1} ends with: "${lastWord}" | Line ${i+2} starts with: "${firstWord}"`);

      // Check if when concatenated it would be a problem
      if (lastWord && firstWord && /[a-z]$/.test(lastWord) && /^[A-Z]/.test(firstWord)) {
        console.log(`  ⚠️  Would create: "${lastWord}${firstWord}" (lowercase+uppercase)`);
      }
    }
  }
}
