/**
 * Markiert Artikel über die API
 * SHOP_ONLY = Nicht in Excel (324 Artikel)
 * FROM_EXCEL = In Excel vorhanden (445 Artikel)
 */

const fs = require('fs');

const API_URL = 'http://localhost:3001';

async function markArticlesViaApi() {
  console.log('========================================');
  console.log('MARKIERE ARTIKEL: Shop-Only vs Excel');
  console.log('========================================\n');

  try {
    // Lade die Markierungsdaten
    const markData = JSON.parse(fs.readFileSync('mark-these-articles.json', 'utf-8'));
    const shopOnlyNumbers = markData.articleNumbers; // 324 Artikel die NUR im Shop sind

    console.log(`Zu markieren als SHOP_ONLY: ${shopOnlyNumbers.length} Artikel`);

    // Hole ALLE Artikel aus dem System
    console.log('\n1. Lade alle System-Artikel...');
    const allArticles = [];
    let page = 1;

    while (true) {
      const response = await fetch(`${API_URL}/api/articles?page=${page}&limit=100`);
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        allArticles.push(...data.data);
        console.log(`   Seite ${page}: ${data.data.length} Artikel`);

        if (!data.pagination.hasNext) break;
        page++;
      } else {
        break;
      }
    }

    console.log(`   Gesamt: ${allArticles.length} Artikel geladen\n`);

    // Markiere jeden Artikel einzeln
    console.log('2. Markiere Artikel...');
    let markedAsShopOnly = 0;
    let markedAsFromExcel = 0;
    let errors = 0;

    for (const article of allArticles) {
      const isShopOnly = shopOnlyNumbers.includes(article.articleNumber);
      const newCategory = isShopOnly ? 'SHOP_ONLY' : 'FROM_EXCEL';

      try {
        const response = await fetch(`${API_URL}/api/articles/${article.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: newCategory
          })
        });

        if (response.ok) {
          if (isShopOnly) {
            markedAsShopOnly++;
          } else {
            markedAsFromExcel++;
          }

          // Zeige Fortschritt alle 50 Artikel
          if ((markedAsShopOnly + markedAsFromExcel) % 50 === 0) {
            console.log(`   Fortschritt: ${markedAsShopOnly + markedAsFromExcel}/${allArticles.length}`);
          }
        } else {
          errors++;
        }
      } catch (error) {
        errors++;
        console.log(`   Fehler bei ${article.articleNumber}: ${error.message}`);
      }
    }

    // Ergebnis
    console.log('\n========================================');
    console.log('ERGEBNIS:');
    console.log('========================================');
    console.log(`SHOP_ONLY markiert:  ${markedAsShopOnly} Artikel (nicht in Excel)`);
    console.log(`FROM_EXCEL markiert: ${markedAsFromExcel} Artikel (in Excel)`);
    console.log(`Fehler:              ${errors}`);
    console.log('========================================\n');

    // Verifizierung
    console.log('3. Verifiziere Markierungen...');
    const verifyResponse = await fetch(`${API_URL}/api/articles?limit=5`);
    const verifyData = await verifyResponse.json();

    if (verifyData.success) {
      console.log('\nBeispiele (erste 5 Artikel):');
      verifyData.data.forEach(a => {
        console.log(`   ${a.articleNumber}: category = "${a.category}"`);
      });
    }

    console.log('\n✅ FERTIG!');
    console.log('\nArtikel sind jetzt markiert:');
    console.log('- SHOP_ONLY: Artikel die NUR vom Shop gecrawlt wurden');
    console.log('- FROM_EXCEL: Artikel die auch in der Excel sind');
    console.log('\nBeim Bulk-Drucken kann jetzt gefiltert werden!');

  } catch (error) {
    console.error('Fehler:', error);
  }
}

// Führe aus
markArticlesViaApi();