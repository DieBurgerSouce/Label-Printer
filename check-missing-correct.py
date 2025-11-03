#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KORREKTER Vergleich: Excel Spalte A vs ALLE System-Artikel
"""

import pandas as pd
import json
import requests

EXCEL_PATH = r'C:\Users\benfi\Downloads\Alle Artikel_gemerged.xlsx'
API_URL = 'http://localhost:3001/api/articles'

print('ARTIKEL-VERGLEICH - KORREKTE VERSION\n')
print('=' * 60)

# 1. Excel lesen - SPALTE A hat die Artikelnummern!
print('\n1. Lese Excel-Datei (Spalte A = Artikelnummern)...')
df = pd.read_excel(EXCEL_PATH)
print(f'   Excel hat {len(df)} Zeilen')

# Spalte A ist die erste Spalte (Index 0)
first_column = df.columns[0]
print(f'   Spalte A heisst: "{first_column}"')

# Artikelnummern aus Spalte A extrahieren
excel_articles = set()
for value in df[first_column]:
    if pd.notna(value):
        article_num = str(value).strip()
        if article_num and article_num != 'nan':
            excel_articles.add(article_num)

print(f'   Excel hat {len(excel_articles)} unique Artikelnummern')

# 2. ALLE System-Artikel abrufen (nicht nur 20!)
print('\n2. Hole ALLE Artikel aus dem System...')

# Erst mal schauen wieviele es gibt
response = requests.get(f'{API_URL}?limit=1')
data = response.json()
total_count = data.get('pagination', {}).get('total', 0)
print(f'   Total im System: {total_count} Artikel')

# Jetzt ALLE holen
all_system_articles = []
page = 1
limit = 100

while True:
    response = requests.get(f'{API_URL}?page={page}&limit={limit}')
    data = response.json()

    if data.get('success'):
        articles = data.get('data', [])
        all_system_articles.extend(articles)

        print(f'   Seite {page}: {len(articles)} Artikel geladen')

        # Prüfe ob es noch mehr gibt
        pagination = data.get('pagination', {})
        if not pagination.get('hasNext', False):
            break
        page += 1
    else:
        break

print(f'   GESAMT: {len(all_system_articles)} Artikel im System geladen')

# System-Artikel als Set von Artikelnummern
system_article_numbers = set()
for article in all_system_articles:
    if article.get('articleNumber'):
        system_article_numbers.add(str(article['articleNumber']).strip())

print(f'   {len(system_article_numbers)} unique Artikelnummern im System')

# 3. Vergleichen
print('\n3. Vergleiche Excel mit System...')

missing = excel_articles - system_article_numbers
found = excel_articles & system_article_numbers

print(f'   GEFUNDEN: {len(found)} Artikel aus Excel sind bereits im System')
print(f'   FEHLEN:   {len(missing)} Artikel aus Excel fehlen noch')

# 4. Ergebnisse speichern
print('\n4. Speichere Ergebnisse...')

# Liste der fehlenden Artikel mit Details aus Excel
missing_with_details = []
for article_num in sorted(missing):
    # Finde die Zeile in der Excel
    row_data = df[df[first_column] == article_num]
    if not row_data.empty:
        row = row_data.iloc[0].to_dict()
        missing_with_details.append({
            'articleNumber': article_num,
            'beschreibung': row.get('Beschreibung', ''),
            'einheit': row.get('Einheit', ''),
            'preis1': row.get('Preis 1', 0),
            'excelData': row
        })
    else:
        missing_with_details.append({
            'articleNumber': article_num
        })

# Speichere JSON
result = {
    'summary': {
        'totalInExcel': len(excel_articles),
        'totalInSystem': len(system_article_numbers),
        'foundInBoth': len(found),
        'missingInSystem': len(missing),
        'coverage': f"{(len(found) / len(excel_articles) * 100):.1f}%"
    },
    'missingArticles': missing_with_details[:500],  # Erste 500 für die Datei
    'missingArticleNumbers': sorted(list(missing))
}

with open('missing-articles-CORRECT.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# Nur die Artikelnummern
with open('missing-numbers-ONLY.json', 'w', encoding='utf-8') as f:
    json.dump(sorted(list(missing)), f, indent=2)

print('   Gespeichert: missing-articles-CORRECT.json')
print('   Gespeichert: missing-numbers-ONLY.json')

# 5. Zusammenfassung
print('\n' + '=' * 60)
print('KORREKTE ZUSAMMENFASSUNG:')
print('=' * 60)
print(f'Excel (Spalte A):           {len(excel_articles):>6} Artikel')
print(f'System (ALLE):              {len(system_article_numbers):>6} Artikel')
print(f'Bereits vorhanden:          {len(found):>6} ✓')
print(f'FEHLEN noch:                {len(missing):>6} ✗')
print(f'Abdeckung:                  {(len(found) / len(excel_articles) * 100):>5.1f}%')
print('=' * 60)

# Zeige ein paar fehlende
if missing:
    print(f'\nErste 10 fehlende Artikelnummern:')
    for i, num in enumerate(sorted(list(missing))[:10], 1):
        print(f'   {i:2}. {num}')
    if len(missing) > 10:
        print(f'   ... und {len(missing) - 10} weitere')