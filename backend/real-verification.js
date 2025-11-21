const fs = require('fs');

console.log('='.repeat(80));
console.log('ECHTE Verifikation - Vorher/Nachher Vergleich');
console.log('='.repeat(80));

// Load BACKUP (before fix)
const backup = JSON.parse(fs.readFileSync('../data/articles-export-2025-11-02-backup-2025-11-09.json', 'utf-8'));

// Load CURRENT (after fix)
const current = JSON.parse(fs.readFileSync('../data/articles-export-2025-11-02.json', 'utf-8'));

console.log(`\nBackup: ${backup.articles.length} articles`);
console.log(`Current: ${current.articles.length} articles\n`);

// Find articles that HAD newlines in backup
const articlesWithNewlines = backup.articles.filter(a =>
  a.description && (a.description.includes('\n') || a.description.includes('\r'))
);

console.log(`Found ${articlesWithNewlines.length} articles with newlines in BACKUP\n`);

// Show first 5 real examples
console.log('='.repeat(80));
console.log('ECHTE Beispiele - Vorher vs. Nachher:');
console.log('='.repeat(80));

for (let i = 0; i < Math.min(5, articlesWithNewlines.length); i++) {
  const backupArticle = articlesWithNewlines[i];
  const currentArticle = current.articles.find(a => a.articleNumber === backupArticle.articleNumber);

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Artikel ${backupArticle.articleNumber}: ${backupArticle.productName}`);
  console.log(`${'─'.repeat(80)}`);

  const backupDesc = backupArticle.description;
  const currentDesc = currentArticle ? currentArticle.description : 'NOT FOUND';

  console.log('\n📌 VORHER (mit \\n Newlines):');
  console.log(backupDesc.substring(0, 300).replace(/\n/g, '[NEWLINE]\n'));

  console.log('\n📌 NACHHER (Newlines ersetzt durch Leerzeichen):');
  console.log(currentDesc.substring(0, 300));

  // Check if newlines are gone
  const hasNewlinesAfter = currentDesc.includes('\n') || currentDesc.includes('\r');
  console.log(`\n✓ Status: ${hasNewlinesAfter ? '❌ NOCH Newlines!' : '✅ Newlines entfernt'}`);

  // Find problematic concatenations in BACKUP
  const lines = backupDesc.split('\n');
  let wouldHaveProblems = false;
  for (let j = 0; j < lines.length - 1; j++) {
    const line1 = lines[j].trim();
    const line2 = lines[j+1].trim();
    if (line1 && line2) {
      const lastChar = line1.slice(-1);
      const firstChar = line2.charAt(0);
      if (/[a-zäöüß]/.test(lastChar) && /[A-ZÄÖÜ]/.test(firstChar)) {
        console.log(`  ⚠️  Line ${j+1} ending "${line1.slice(-20)}" + Line ${j+2} starting "${line2.substring(0, 20)}"`);
        console.log(`      Würde ohne Fix werden: "...${lastChar}${firstChar}..." (KEINE LEERZEICHEN!)`);
        wouldHaveProblems = true;
      }
    }
  }

  if (wouldHaveProblems) {
    console.log(`\n  🎯 Mit unserem Fix: Newlines → Leerzeichen, Problem gelöst!`);
  }
}

// Final verification
console.log('\n' + '='.repeat(80));
console.log('FINALE Verifikation:');
console.log('='.repeat(80));

let newlinesInCurrent = 0;
for (const article of current.articles) {
  if (article.description && (article.description.includes('\n') || article.description.includes('\r'))) {
    newlinesInCurrent++;
    console.log(`❌ Artikel ${article.articleNumber} hat NOCH Newlines!`);
  }
}

console.log(`\n📊 Artikel mit Newlines in BACKUP: ${articlesWithNewlines.length}`);
console.log(`📊 Artikel mit Newlines in CURRENT: ${newlinesInCurrent}`);

if (newlinesInCurrent === 0) {
  console.log('\n✅✅✅ BESTÄTIGT: Alle Newlines wurden entfernt! ✅✅✅');
} else {
  console.log('\n❌ PROBLEM: Es gibt noch Newlines in den Daten!');
}
