/**
 * Import-Script für 594 fehlende Excel-Artikel
 * Importiert in Batches mit Fortschrittsanzeige
 */

const fs = require('fs');

const API_URL = 'http://localhost:3001/api/articles';
const BATCH_SIZE = 20; // Kleinere Batches für sicheren Import
const DELAY_BETWEEN_BATCHES = 1000; // 1 Sekunde Pause zwischen Batches

// Hilfsfunktion für Verzögerung
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function importArticles() {
  console.log('='['repeat'](70));
  console.log('ARTIKEL-IMPORT: 594 fehlende Excel-Artikel');
  console.log('='['repeat'](70));

  try {
    // 1. Lade Import-Daten
    console.log('\n1. Lade Import-Daten...');
    const importData = JSON.parse(fs.readFileSync('import-ready.json', 'utf-8'));
    const articles = importData.articles;

    console.log(`   Gefunden: ${articles.length} Artikel`);
    console.log(`   - Einzelpreis: ${importData.statistics.single_price}`);
    console.log(`   - Staffelpreis: ${importData.statistics.tiered_price}`);
    console.log(`   - Auf Anfrage: ${importData.statistics.auf_anfrage}`);

    // 2. Import in Batches
    console.log(`\n2. Starte Import (Batch-Größe: ${BATCH_SIZE})...`);

    const results = {
      success: 0,
      failed: 0,
      errors: [],
      importedArticles: []
    };

    const totalBatches = Math.ceil(articles.length / BATCH_SIZE);

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      console.log(`\n   Batch ${batchNum}/${totalBatches}: Importiere ${batch.length} Artikel...`);

      for (const article of batch) {
        try {
          // Entferne temporäre Felder
          const articleToImport = { ...article };

          // API-Call
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(articleToImport)
          });

          const result = await response.json();

          if (response.ok && result.success) {
            results.success++;
            results.importedArticles.push({
              articleNumber: article.articleNumber,
              id: result.data.id,
              needsTierQuantities: article.manufacturer === 'NEEDS_TIER_QUANTITIES'
            });

            // Zeige Fortschritt
            if (results.success % 10 === 0) {
              process.stdout.write(`   ✓ ${results.success} `);
            }
          } else {
            // Duplikat oder anderer Fehler
            if (result.error && result.error.includes('already exists')) {
              // Artikel existiert bereits, Update versuchen
              const existingResponse = await fetch(`${API_URL}?search=${article.articleNumber}&limit=1`);
              const existingData = await existingResponse.json();

              if (existingData.success && existingData.data.length > 0) {
                const existingId = existingData.data[0].id;

                // Update-Versuch
                const updateResponse = await fetch(`${API_URL}/${existingId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(articleToImport)
                });

                if (updateResponse.ok) {
                  results.success++;
                  process.stdout.write('U');
                } else {
                  results.failed++;
                  results.errors.push({
                    articleNumber: article.articleNumber,
                    error: 'Update fehlgeschlagen'
                  });
                }
              }
            } else {
              results.failed++;
              results.errors.push({
                articleNumber: article.articleNumber,
                error: result.error || 'Unbekannter Fehler'
              });
              process.stdout.write('✗');
            }
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            articleNumber: article.articleNumber,
            error: error.message
          });
          process.stdout.write('E');
        }
      }

      // Pause zwischen Batches
      if (i + BATCH_SIZE < articles.length) {
        console.log(`\n   Pause ${DELAY_BETWEEN_BATCHES}ms...`);
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    // 3. Ergebnis-Report
    console.log('\n\n' + '='['repeat'](70));
    console.log('IMPORT ABGESCHLOSSEN');
    console.log('='['repeat'](70));
    console.log(`Erfolgreich: ${results.success} Artikel`);
    console.log(`Fehlgeschlagen: ${results.failed} Artikel`);

    if (results.errors.length > 0) {
      console.log('\nFehler (erste 10):');
      results.errors.slice(0, 10).forEach(err => {
        console.log(`   - ${err.articleNumber}: ${err.error}`);
      });

      // Speichere Fehler-Log
      fs.writeFileSync('import-errors.json', JSON.stringify(results.errors, null, 2));
      console.log(`\nAlle Fehler gespeichert in: import-errors.json`);
    }

    // 4. Speichere Import-Report
    const report = {
      timestamp: new Date().toISOString(),
      totalArticles: articles.length,
      imported: results.success,
      failed: results.failed,
      needsTierQuantities: results.importedArticles.filter(a => a.needsTierQuantities).length,
      importedArticles: results.importedArticles
    };

    fs.writeFileSync('import-report.json', JSON.stringify(report, null, 2));
    console.log(`\nImport-Report gespeichert: import-report.json`);

    // 5. Statistik der Artikel mit fehlenden Staffelmengen
    const needsQuantities = results.importedArticles.filter(a => a.needsTierQuantities);
    if (needsQuantities.length > 0) {
      console.log('\n' + '='['repeat'](70));
      console.log(`WICHTIG: ${needsQuantities.length} Artikel benötigen Mengenpflege!`);
      console.log('='['repeat'](70));
      console.log('Diese Artikel haben Staffelpreise ohne Mengenangaben.');
      console.log('Bitte pflegen Sie die Mengen nach in:');
      console.log('   → nachpflege-staffelmengen.csv');
      console.log('\nDie Artikel sind markiert mit: manufacturer = "NEEDS_TIER_QUANTITIES"');
    }

    // 6. Verifizierung
    console.log('\n5. Verifiziere Import...');
    const verifyResponse = await fetch(`${API_URL}?limit=1`);
    const verifyData = await verifyResponse.json();

    if (verifyData.success && verifyData.pagination) {
      console.log(`   Gesamt-Artikel im System: ${verifyData.pagination.total}`);
      console.log(`   Erwartete Anzahl: ${769 + results.success}`);

      if (verifyData.pagination.total >= 769 + results.success) {
        console.log('   ✅ Import erfolgreich verifiziert!');
      }
    }

  } catch (error) {
    console.error('\n❌ FEHLER beim Import:', error);
  }
}

// Führe Import aus
console.log('Starte Import in 3 Sekunden...\n');
setTimeout(() => {
  importArticles();
}, 3000);