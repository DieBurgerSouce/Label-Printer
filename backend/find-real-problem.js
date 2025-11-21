const fs = require('fs');

const old = JSON.parse(fs.readFileSync('../data/articles-export-2025-11-02.json', 'utf-8'));

console.log('Searching for articles with problematic newline concatenations...\n');

let foundProblems = 0;

for (const article of old.articles) {
  if (!article.description || !article.description.includes('\n')) continue;

  const lines = article.description.split('\n');
  let hasRealProblem = false;

  for (let i = 0; i < lines.length - 1; i++) {
    const currentLine = lines[i];
    const nextLine = lines[i+1];

    if (currentLine && nextLine) {
      const currentTrimmed = currentLine.trim();
      const nextTrimmed = nextLine.trim();

      if (!currentTrimmed || !nextTrimmed) continue;

      const lastChar = currentTrimmed.slice(-1);
      const firstChar = nextTrimmed.charAt(0);

      // Check if this would create a word concatenation problem
      // Pattern: ends with letter/number, starts with capital letter
      const wouldConcatenate = (
        (/[a-zäöüß0-9]/.test(lastChar) && /[A-ZÄÖÜ]/.test(firstChar)) ||
        (/[a-zäöüß]/.test(lastChar) && /[A-ZÄÖÜ]/.test(firstChar))
      );

      if (wouldConcatenate) {
        if (!hasRealProblem) {
          console.log('='.repeat(80));
          console.log(`Article ${article.articleNumber}: ${article.productName}`);
          console.log('='.repeat(80));
          hasRealProblem = true;
          foundProblems++;
        }

        console.log(`\n⚠️  Line ${i+1} -> ${i+2} would concatenate:`);
        console.log(`   Line ${i+1}: "...${currentTrimmed.slice(-50)}"`);
        console.log(`   Line ${i+2}: "${nextTrimmed.substring(0, 50)}..."`);
        console.log(`   Would become: "...${lastChar}${firstChar}..." (PROBLEMATIC!)`);
      }
    }
  }

  if (foundProblems >= 5) break; // Show first 5 examples
}

console.log('\n' + '='.repeat(80));
console.log(`Found ${foundProblems} articles with potential concatenation issues`);
