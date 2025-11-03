/**
 * CHECK MISSING ARTICLES BEFORE IMPORT
 *
 * Dieses Script zeigt dir WELCHE Artikel aus deiner Excel
 * NICHT in der Datenbank gefunden werden - BEVOR du importierst!
 *
 * Usage:
 *   node check-missing-before-import.js deine-excel.xlsx
 *
 * Output:
 *   - Liste der fehlenden Artikelnummern
 *   - JSON-Datei: missing-articles.json
 */

const XLSX = require('xlsx');
const fs = require('fs');

// API-Konfiguration
const API_URL = 'http://localhost:3001/api/articles';

/**
 * Lade alle Artikel aus dem System
 */
async function fetchAllArticles() {
  console.log('📡 Lade Artikel aus dem System...');

  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    if (!data.success) {
      throw new Error('API returned error');
    }

    const articles = data.data || [];
    console.log(`✅ ${articles.length} Artikel aus System geladen\n`);

    return articles;
  } catch (error) {
    console.error('❌ Fehler beim Laden der Artikel:', error.message);
    console.error('   Stelle sicher dass Backend läuft: http://localhost:3001');
    process.exit(1);
  }
}

/**
 * Parse Excel und extrahiere Artikelnummern
 */
function parseExcelArticleNumbers(filePath) {
  console.log(`📄 Lese Excel-Datei: ${filePath}`);

  try {
    const workbook = XLSX.readFile(filePath);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert to array of arrays
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: '',
      blankrows: false
    });

    if (rows.length === 0) {
      throw new Error('Excel ist leer');
    }

    // Erste Zeile = Headers
    const headers = rows[0].map(h => String(h || '').trim().toLowerCase());

    // Finde Artikelnummer-Spalte (auto-detect)
    const patterns = [
      'artikelnummer',
      'article number',
      'art-nr',
      'art.nr',
      'artnr',
      'sku',
      'item number',
      'product number'
    ];

    let columnIndex = -1;
    for (let i = 0; i < headers.length; i++) {
      if (patterns.some(pattern => headers[i].includes(pattern))) {
        columnIndex = i;
        break;
      }
    }

    if (columnIndex === -1) {
      console.log('\n⚠️  Artikelnummer-Spalte nicht automatisch gefunden!');
      console.log('   Verfügbare Spalten:', headers);
      console.log('\n   Bitte gib die Spalten-Nummer ein (0-basiert):');

      // Hier könntest du einen Prompt einbauen für manuelle Eingabe
      // Für jetzt nehmen wir einfach die erste Spalte
      columnIndex = 0;
      console.log(`   → Verwende Spalte ${columnIndex}: "${headers[columnIndex]}"\n`);
    } else {
      console.log(`✅ Artikelnummer-Spalte gefunden: "${headers[columnIndex]}" (Index ${columnIndex})\n`);
    }

    // Extrahiere alle Artikelnummern (skip header)
    const articleNumbers = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const articleNumber = String(row[columnIndex] || '').trim();

      if (articleNumber) {
        articleNumbers.push(articleNumber);
      }
    }

    console.log(`✅ ${articleNumbers.length} Artikelnummern aus Excel extrahiert\n`);

    return articleNumbers;

  } catch (error) {
    console.error('❌ Fehler beim Lesen der Excel:', error.message);
    process.exit(1);
  }
}

/**
 * Vergleiche und finde fehlende Artikel
 */
function findMissingArticles(excelNumbers, systemArticles) {
  console.log('🔍 Vergleiche Excel mit System...\n');

  // Erstelle Set der System-Artikelnummern
  const systemNumbers = new Set(
    systemArticles.map(a => a.articleNumber)
  );

  // Finde fehlende
  const missing = excelNumbers.filter(num => !systemNumbers.has(num));

  // Finde doppelte in Excel
  const seen = new Set();
  const duplicates = [];
  excelNumbers.forEach(num => {
    if (seen.has(num)) {
      duplicates.push(num);
    }
    seen.add(num);
  });

  return {
    missing: [...new Set(missing)], // Remove duplicates
    duplicates: [...new Set(duplicates)],
    excelTotal: excelNumbers.length,
    excelUnique: seen.size,
    systemTotal: systemArticles.length,
    matchedCount: excelNumbers.filter(num => systemNumbers.has(num)).length
  };
}

/**
 * Main Function
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  CHECK MISSING ARTICLES BEFORE IMPORT                ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Get Excel file path from command line
  const excelPath = process.argv[2];

  if (!excelPath) {
    console.error('❌ Fehler: Excel-Datei fehlt!\n');
    console.log('Usage:');
    console.log('  node check-missing-before-import.js <excel-datei.xlsx>\n');
    console.log('Beispiel:');
    console.log('  node check-missing-before-import.js meine-artikel.xlsx\n');
    process.exit(1);
  }

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Datei nicht gefunden: ${excelPath}\n`);
    process.exit(1);
  }

  // 1. Lade System-Artikel
  const systemArticles = await fetchAllArticles();

  // 2. Parse Excel
  const excelNumbers = parseExcelArticleNumbers(excelPath);

  // 3. Vergleiche
  const result = findMissingArticles(excelNumbers, systemArticles);

  // 4. Ausgabe
  console.log('═'.repeat(60));
  console.log('📊 ERGEBNIS');
  console.log('═'.repeat(60));
  console.log();
  console.log(`Excel-Artikel (gesamt):   ${result.excelTotal}`);
  console.log(`Excel-Artikel (unique):   ${result.excelUnique}`);
  console.log(`System-Artikel (gesamt):  ${result.systemTotal}`);
  console.log();
  console.log(`✅ Gefunden im System:    ${result.matchedCount}`);
  console.log(`❌ NICHT im System:       ${result.missing.length}`);

  if (result.duplicates.length > 0) {
    console.log(`⚠️  Duplikate in Excel:   ${result.duplicates.length}`);
  }

  console.log();

  // 5. Details
  if (result.missing.length > 0) {
    console.log('─'.repeat(60));
    console.log('❌ FEHLENDE ARTIKEL (nicht im System):');
    console.log('─'.repeat(60));

    result.missing.slice(0, 20).forEach((num, i) => {
      console.log(`   ${i + 1}. ${num}`);
    });

    if (result.missing.length > 20) {
      console.log(`   ... und ${result.missing.length - 20} weitere`);
    }

    console.log();
  }

  if (result.duplicates.length > 0) {
    console.log('─'.repeat(60));
    console.log('⚠️  DUPLIKATE IN EXCEL:');
    console.log('─'.repeat(60));

    result.duplicates.slice(0, 10).forEach((num, i) => {
      console.log(`   ${i + 1}. ${num}`);
    });

    if (result.duplicates.length > 10) {
      console.log(`   ... und ${result.duplicates.length - 10} weitere`);
    }

    console.log();
  }

  // 6. Speichere Ergebnis
  const outputFile = 'missing-articles-report.json';
  fs.writeFileSync(outputFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    excelFile: excelPath,
    summary: {
      excelTotal: result.excelTotal,
      excelUnique: result.excelUnique,
      systemTotal: result.systemTotal,
      matched: result.matchedCount,
      missing: result.missing.length,
      duplicates: result.duplicates.length
    },
    missingArticles: result.missing,
    duplicateArticles: result.duplicates
  }, null, 2));

  console.log('─'.repeat(60));
  console.log(`💾 Report gespeichert: ${outputFile}`);
  console.log('─'.repeat(60));
  console.log();

  // 7. Empfehlung
  if (result.missing.length === 0) {
    console.log('✅ PERFEKT! Alle Excel-Artikel sind im System.');
    console.log('   Du kannst jetzt sicher importieren! 🎉');
  } else {
    console.log('⚠️  ACHTUNG!');
    console.log(`   ${result.missing.length} Artikel aus Excel werden beim Import ÜBERSPRUNGEN!`);
    console.log();
    console.log('   Optionen:');
    console.log('   1. Fehlende Artikel zuerst crawlen/erstellen');
    console.log('   2. Import trotzdem durchführen (nur existierende werden upgedated)');
    console.log('   3. Excel bereinigen (fehlende Artikel entfernen)');
  }

  console.log();
}

// Run
main().catch(error => {
  console.error('❌ Unerwarteter Fehler:', error);
  process.exit(1);
});
