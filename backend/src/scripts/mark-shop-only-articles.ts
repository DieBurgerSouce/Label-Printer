/**
 * Script zum Markieren von Artikeln die NUR im Shop sind (nicht in Excel)
 * Diese können dann beim Bulk-Drucken optional ausgeschlossen werden
 */

import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

async function markShopOnlyArticles() {
  console.log('========================================');
  console.log('Markiere Shop-Only Artikel');
  console.log('========================================\n');

  try {
    // Lade die Markierungsdaten
    const dataPath = path.join(__dirname, '../../../mark-these-articles.json');
    const markData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    const toMarkNumbers = markData.articleNumbers;

    console.log(`Zu markieren: ${toMarkNumbers.length} Artikel\n`);

    // 1. Markiere Shop-Only Artikel (nicht in Excel)
    console.log('1. Markiere Shop-Only Artikel...');
    const markedResult = await prisma.product.updateMany({
      where: {
        articleNumber: {
          in: toMarkNumbers,
        },
      },
      data: {
        category: 'SHOP_ONLY', // Diese sind NUR vom Shop, NICHT in Excel
      },
    });
    console.log(`   --> ${markedResult.count} als SHOP_ONLY markiert`);

    // 2. Markiere Excel-Artikel (in Excel vorhanden)
    console.log('\n2. Markiere Excel-Artikel...');
    const excelResult = await prisma.product.updateMany({
      where: {
        articleNumber: {
          notIn: toMarkNumbers,
        },
      },
      data: {
        category: 'FROM_EXCEL', // Diese sind in der Excel
      },
    });
    console.log(`   --> ${excelResult.count} als FROM_EXCEL markiert`);

    // 3. Verifizierung
    console.log('\n3. Verifiziere Markierungen...');
    const shopOnlyCount = await prisma.product.count({
      where: { category: 'SHOP_ONLY' },
    });
    const fromExcelCount = await prisma.product.count({
      where: { category: 'FROM_EXCEL' },
    });
    const totalCount = await prisma.product.count();

    console.log(`   Shop-Only: ${shopOnlyCount}`);
    console.log(`   From Excel: ${fromExcelCount}`);
    console.log(`   Gesamt: ${totalCount}`);

    // 4. Beispiele zeigen
    console.log('\n4. Beispiele:');
    const shopOnlyExamples = await prisma.product.findMany({
      where: { category: 'SHOP_ONLY' },
      take: 5,
      select: {
        articleNumber: true,
        productName: true,
        category: true,
      },
    });

    console.log('\n   Shop-Only Artikel (erste 5):');
    shopOnlyExamples.forEach((a) => {
      console.log(`   - ${a.articleNumber}: ${a.productName?.substring(0, 40)}`);
    });

    console.log('\n========================================');
    console.log('FERTIG!');
    console.log('========================================');
    console.log('\nArtikel sind jetzt markiert:');
    console.log('- SHOP_ONLY: Nicht in Excel (324 Artikel)');
    console.log('- FROM_EXCEL: In Excel vorhanden (445 Artikel)');
    console.log('\nBeim Bulk-Drucken kann jetzt gefiltert werden:');
    console.log('- Nur Excel-Artikel: WHERE category = "FROM_EXCEL"');
    console.log('- Alle Artikel: Kein Filter');
  } catch (error) {
    console.error('Fehler:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Führe Script aus
markShopOnlyArticles();
