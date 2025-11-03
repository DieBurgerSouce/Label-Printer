/**
 * Script zum Vergleich von Excel-Artikeln mit System-Artikeln
 * Findet alle Artikel, die in der Excel aber nicht im System sind
 */

const xlsx = require('xlsx');
const fs = require('fs');

const API_URL = 'http://localhost:3001';
const EXCEL_PATH = 'C:\\Users\\benfi\\Downloads\\Alle Artikel_gemerged.xlsx';

async function checkMissingArticles() {
  console.log('📊 Analysiere fehlende Artikel aus Excel...\n');

  try {
    // Schritt 1: Excel-Datei lesen
    console.log('1️⃣ Lese Excel-Datei...');
    const workbook = xlsx.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const excelData = xlsx.utils.sheet_to_json(worksheet);

    console.log(`   ✅ ${excelData.length} Zeilen in Excel gefunden`);

    // Extrahiere Artikelnummern aus Excel
    const excelArticles = new Map();
    const articleNumberFields = ['Artikel', 'Artikelnummer', 'Art.-Nr.', 'Art.Nr.', 'Artikel-Nr.', 'ArtikelNr'];

    excelData.forEach(row => {
      let articleNumber = null;

      // Suche nach Artikelnummer in verschiedenen möglichen Feldnamen
      for (const field of articleNumberFields) {
        if (row[field]) {
          articleNumber = String(row[field]).trim();
          break;
        }
      }

      if (articleNumber) {
        excelArticles.set(articleNumber, row);
      }
    });

    console.log(`   ✅ ${excelArticles.size} unique Artikelnummern in Excel`);

    // Schritt 2: Alle Artikel aus dem System abrufen
    console.log('\n2️⃣ Rufe System-Artikel ab...');

    const response = await fetch(`${API_URL}/api/articles?limit=2000`);
    const systemData = await response.json();

    if (!systemData.success) {
      throw new Error('Fehler beim Abrufen der System-Artikel');
    }

    const systemArticles = new Set();
    systemData.data.forEach(article => {
      if (article.articleNumber) {
        systemArticles.add(String(article.articleNumber).trim());
      }
    });

    console.log(`   ✅ ${systemArticles.size} Artikel im System gefunden`);

    // Schritt 3: Fehlende Artikel identifizieren
    console.log('\n3️⃣ Identifiziere fehlende Artikel...');

    const missingArticles = [];
    const foundInSystem = [];

    excelArticles.forEach((excelRow, articleNumber) => {
      if (!systemArticles.has(articleNumber)) {
        missingArticles.push({
          articleNumber: articleNumber,
          data: excelRow
        });
      } else {
        foundInSystem.push(articleNumber);
      }
    });

    console.log(`   ❌ ${missingArticles.length} Artikel fehlen im System`);
    console.log(`   ✅ ${foundInSystem.length} Artikel bereits im System`);

    // Schritt 4: Ergebnis als JSON speichern
    console.log('\n4️⃣ Speichere Ergebnisse...');

    const result = {
      timestamp: new Date().toISOString(),
      summary: {
        totalInExcel: excelArticles.size,
        totalInSystem: systemArticles.size,
        missingCount: missingArticles.length,
        foundCount: foundInSystem.length
      },
      missingArticles: missingArticles.map(item => ({
        articleNumber: item.articleNumber,
        productName: item.data['Bezeichnung'] || item.data['Produktname'] || item.data['Artikel'] || '',
        price: item.data['Preis'] || item.data['VK-Preis'] || item.data['Einzelpreis'] || 0,
        excelRow: item.data
      }))
    };

    // Speichere vollständige JSON
    fs.writeFileSync('missing-articles.json', JSON.stringify(result, null, 2));
    console.log('   ✅ Vollständige Liste gespeichert in: missing-articles.json');

    // Speichere nur Artikelnummern
    const missingNumbersOnly = missingArticles.map(item => item.articleNumber);
    fs.writeFileSync('missing-article-numbers.json', JSON.stringify(missingNumbersOnly, null, 2));
    console.log('   ✅ Artikelnummern-Liste gespeichert in: missing-article-numbers.json');

    // Zeige erste 10 fehlende Artikel
    console.log('\n📋 Erste 10 fehlende Artikel:');
    missingArticles.slice(0, 10).forEach((item, index) => {
      const name = item.data['Bezeichnung'] || item.data['Produktname'] || 'Unbekannt';
      console.log(`   ${index + 1}. ${item.articleNumber} - ${name}`);
    });

    // Statistik
    console.log('\n📊 ZUSAMMENFASSUNG:');
    console.log('═'.repeat(50));
    console.log(`Excel-Artikel (unique):     ${excelArticles.size}`);
    console.log(`System-Artikel:             ${systemArticles.size}`);
    console.log(`Bereits im System:          ${foundInSystem.length} ✅`);
    console.log(`Fehlen im System:           ${missingArticles.length} ❌`);
    console.log(`Abdeckung:                  ${((foundInSystem.length / excelArticles.size) * 100).toFixed(1)}%`);
    console.log('═'.repeat(50));

    return result;

  } catch (error) {
    console.error('❌ Fehler:', error.message);

    // Versuche mit node-xlsx wenn xlsx nicht installiert ist
    console.log('\n🔄 Versuche alternativen Ansatz...');

    // Erstelle ein Python-Script als Alternative
    const pythonScript = `
import pandas as pd
import json
import requests

excel_path = r'C:\\Users\\benfi\\Downloads\\Alle Artikel_gemerged.xlsx'
api_url = 'http://localhost:3001/api/articles?limit=2000'

# Excel lesen
df = pd.read_excel(excel_path)
print(f"Excel hat {len(df)} Zeilen")

# Artikelnummern aus Excel extrahieren
article_columns = ['Artikel', 'Artikelnummer', 'Art.-Nr.', 'Art.Nr.', 'Artikel-Nr.', 'ArtikelNr']
excel_articles = set()

for col in article_columns:
    if col in df.columns:
        excel_articles.update(df[col].dropna().astype(str).str.strip())
        break

print(f"Excel hat {len(excel_articles)} unique Artikelnummern")

# System-Artikel abrufen
response = requests.get(api_url)
system_data = response.json()

if system_data.get('success'):
    system_articles = {str(a['articleNumber']).strip() for a in system_data['data'] if a.get('articleNumber')}
    print(f"System hat {len(system_articles)} Artikel")

    # Fehlende identifizieren
    missing = excel_articles - system_articles
    found = excel_articles & system_articles

    print(f"\\nFehlend: {len(missing)}")
    print(f"Gefunden: {len(found)}")

    # Als JSON speichern
    result = {
        'summary': {
            'totalInExcel': len(excel_articles),
            'totalInSystem': len(system_articles),
            'missingCount': len(missing),
            'foundCount': len(found)
        },
        'missingArticleNumbers': sorted(list(missing))
    }

    with open('missing-articles.json', 'w') as f:
        json.dump(result, f, indent=2)

    print("\\nGespeichert in: missing-articles.json")
`;

    fs.writeFileSync('check-missing-articles.py', pythonScript);
    console.log('Python-Script erstellt: check-missing-articles.py');
    console.log('Führe aus mit: python check-missing-articles.py');
  }
}

// Führe Analyse aus
checkMissingArticles().catch(console.error);