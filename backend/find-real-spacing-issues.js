const fs = require('fs');

const data = JSON.parse(fs.readFileSync('../data/articles-export.json', 'utf-8'));

console.log('='.repeat(80));
console.log('Finding REAL spacing issues in current articles');
console.log('='.repeat(80));

let totalIssues = 0;
let articlesWithIssues = 0;

for (const article of data.articles.slice(0, 10)) {  // First 10 articles
  const desc = article.description;
  if (!desc) continue;

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Artikel ${article.articleNumber}: ${article.productName}`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`\nDescription:\n${desc.substring(0, 250)}...\n`);

  let foundIssue = false;

  // Pattern 1: Word ending with lowercase/digit followed by word starting with uppercase - NO SPACE
  // e.g., "vonFolien" or "100Stück"
  const pattern1 = /([a-zäöüß0-9])([A-ZÄÖÜ][a-zäöüß])/g;
  let matches = [];
  let match;

  while ((match = pattern1.exec(desc)) !== null) {
    const fullMatch = match[0];
    const char1 = match[1];
    const char2 = match[2];

    // Skip false positives
    if (fullMatch === 'sG' || fullMatch === 'kG' || fullMatch === 'mG') continue;

    matches.push({
      match: fullMatch,
      index: match.index,
      context: desc.substring(Math.max(0, match.index - 30), Math.min(desc.length, match.index + 40))
    });
  }

  if (matches.length > 0) {
    foundIssue = true;
    articlesWithIssues++;
    console.log(`⚠️  Found ${matches.length} potential concatenation(s):`);
    matches.forEach((m, i) => {
      console.log(`   ${i+1}. "${m.match}" at pos ${m.index}`);
      console.log(`      Context: "...${m.context}..."`);
      console.log(`      Should be: Add space → "${m.match[0]} ${m.match.substring(1)}"`);
      totalIssues++;
    });
  }

  // Pattern 2: Quote followed immediately by capital letter - NO SPACE
  // e.g., "NEU"Maße instead of "NEU" Maße
  const pattern2 = /"([A-ZÄÖÜ][a-zäöüß]+)/g;
  let quoteMatches = [];

  while ((match = pattern2.exec(desc)) !== null) {
    const beforeQuote = desc[match.index - 1];
    // Check if previous char is a letter/number (closing quote scenario)
    if (beforeQuote && /[a-zA-Z0-9]/.test(beforeQuote)) {
      quoteMatches.push({
        match: match[0],
        index: match.index,
        context: desc.substring(Math.max(0, match.index - 30), Math.min(desc.length, match.index + 40))
      });
    }
  }

  if (quoteMatches.length > 0) {
    foundIssue = true;
    if (!matches.length) articlesWithIssues++;
    console.log(`\n⚠️  Found ${quoteMatches.length} quote spacing issue(s):`);
    quoteMatches.forEach((m, i) => {
      console.log(`   ${i+1}. "${m.match}" at pos ${m.index}`);
      console.log(`      Context: "...${m.context}..."`);
      console.log(`      Should be: Add space before quote → " ${m.match}"`);
      totalIssues++;
    });
  }

  if (!foundIssue) {
    console.log('✅ No spacing issues detected');
  }
}

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Articles checked: 10`);
console.log(`Articles with issues: ${articlesWithIssues}`);
console.log(`Total issues found: ${totalIssues}`);

if (totalIssues > 0) {
  console.log('\n❌ YES - There ARE real spacing issues in the current data!');
  console.log('These need to be fixed in the HTML extraction logic.');
} else {
  console.log('\n✅ No real spacing issues found');
}
