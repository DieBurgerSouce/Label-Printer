/**
 * Import der 236 fehlgeschlagenen Staffelpreis-Artikel
 * Importiert sie OHNE Staffelpreise (nur Basispreis) und markiert sie
 */

const fs = require('fs');

const API_URL = 'http://localhost:3001/api/articles';

async function importFailedArticles() {
  console.log('='['repeat'](70));
  console.log('NACHIMPORT: 236 Staffelpreis-Artikel (ohne Staffeln)');
  console.log('='['repeat'](70));

  try {
    // 1. Lade fehlgeschlagene Artikel
    console.log('\n1. Lade fehlgeschlagene Artikel...');
    const errors = JSON.parse(fs.readFileSync('import-errors.json', 'utf-8'));
    const importData = JSON.parse(fs.readFileSync('import-ready.json', 'utf-8'));

    // Finde die Original-Artikel für die fehlgeschlagenen
    const failedArticles = [];
    for (const error of errors) {
      const originalArticle = importData.articles.find(a => a.articleNumber === error.articleNumber);
      if (originalArticle) {
        failedArticles.push(originalArticle);
      }
    }

    console.log(`   Gefunden: ${failedArticles.length} fehlgeschlagene Artikel`);
    console.log('   Diese haben Staffelpreise aber keine Mengenangaben');

    // 2. Importiere ohne Staffelpreise
    console.log('\n2. Importiere Artikel OHNE Staffelpreise...');

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < failedArticles.length; i++) {
      const article = failedArticles[i];

      try {
        // Bereite Artikel vor - OHNE tieredPrices!
        const articleToImport = {
          articleNumber: article.articleNumber,
          productName: article.productName,
          description: article.description || '',
          price: article.price || 0,
          currency: article.currency || 'EUR',
          sourceUrl: article.sourceUrl || 'https://shop.firmenich.de',
          category: 'FROM_EXCEL',
          manufacturer: 'NEEDS_TIER_QUANTITIES',  // MARKIERUNG!
          published: true,
          verified: false  // Nicht verifiziert wegen fehlender Staffelmengen
        };

        // Speichere Staffelpreise als Text für spätere Referenz
        if (article.tieredPrices && article.tieredPrices.length > 0) {
          const pricesText = article.tieredPrices.map(t => t.price).join(' / ');
          articleToImport.tieredPricesText = `Staffelpreise: ${pricesText} EUR (Mengen fehlen)`;
        }

        // Falls "Auf Anfrage"
        if (article.tieredPricesText === 'Auf Anfrage') {
          articleToImport.tieredPricesText = 'Auf Anfrage';
        }

        // Einheit im EAN-Feld
        if (article.ean) {
          articleToImport.ean = article.ean;
        }

        // API-Call
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(articleToImport)
        });

        const result = await response.json();

        if (response.ok && result.success) {
          results.success++;

          // Fortschritt
          if (results.success % 20 === 0) {
            console.log(`   ✓ ${results.success} importiert`);
          } else if (results.success % 10 === 0) {
            process.stdout.write('.');
          }
        } else {
          results.failed++;
          results.errors.push({
            articleNumber: article.articleNumber,
            error: result.error || 'Unbekannter Fehler'
          });
        }

      } catch (error) {
        results.failed++;
        results.errors.push({
          articleNumber: article.articleNumber,
          error: error.message
        });
      }
    }

    // 3. Ergebnis
    console.log('\n\n' + '='['repeat'](70));
    console.log('NACHIMPORT ABGESCHLOSSEN');
    console.log('='['repeat'](70));
    console.log(`Erfolgreich importiert: ${results.success} Artikel`);
    console.log(`Fehlgeschlagen: ${results.failed} Artikel`);

    if (results.errors.length > 0) {
      console.log('\nVerbleibende Fehler:');
      results.errors.forEach(err => {
        console.log(`   - ${err.articleNumber}: ${err.error}`);
      });

      fs.writeFileSync('import-still-failed.json', JSON.stringify(results.errors, null, 2));
      console.log(`\nFehler gespeichert in: import-still-failed.json`);
    }

    // 4. Finale Verifizierung
    console.log('\n4. Finale Verifizierung...');
    const verifyResponse = await fetch(`${API_URL}?limit=1`);
    const verifyData = await verifyResponse.json();

    if (verifyData.success && verifyData.pagination) {
      console.log(`   Gesamt-Artikel im System: ${verifyData.pagination.total}`);
      console.log(`   Davon aus Excel: ${358 + results.success} von 594`);

      // Zähle Artikel mit NEEDS_TIER_QUANTITIES
      const markedResponse = await fetch(`${API_URL}?search=NEEDS_TIER_QUANTITIES&limit=1`);
      const markedData = await markedResponse.json();

      if (markedData.success && markedData.pagination) {
        console.log(`   Markiert für Mengenpflege: ${markedData.pagination.total} Artikel`);
      }
    }

    // 5. Erstelle finale Zusammenfassung
    const finalReport = {
      timestamp: new Date().toISOString(),
      phase1_imported: 358,
      phase2_imported: results.success,
      total_imported: 358 + results.success,
      total_failed: results.failed,
      needs_tier_quantities: results.success,
      csv_for_maintenance: 'nachpflege-staffelmengen.csv'
    };

    fs.writeFileSync('final-import-report.json', JSON.stringify(finalReport, null, 2));

    console.log('\n' + '='['repeat'](70));
    console.log('WICHTIGER HINWEIS:');
    console.log('='['repeat'](70));
    console.log(`${results.success} Artikel wurden mit der Markierung`);
    console.log('"NEEDS_TIER_QUANTITIES" importiert.');
    console.log('\nDiese Artikel haben Staffelpreise, aber die Mengenangaben fehlen!');
    console.log('\nBitte pflegen Sie die Mengen nach:');
    console.log('1. Öffnen Sie: nachpflege-staffelmengen.csv');
    console.log('2. Tragen Sie die Ab-Mengen ein');
    console.log('3. Importieren Sie die aktualisierten Daten');

  } catch (error) {
    console.error('\n❌ FEHLER:', error);
  }
}

// Führe Import aus
importFailedArticles();