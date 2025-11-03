#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MARKIERT alle Artikel im System, die NICHT in der Excel sind
Damit kann man diese beim Bulk-Drucken optional ausschließen
"""

import pandas as pd
import json
import requests

EXCEL_PATH = r'C:\Users\benfi\Downloads\Alle Artikel_gemerged.xlsx'
API_URL = 'http://localhost:3001/api/articles'

print('=' * 70)
print('ARTIKEL MARKIERUNG: Identifiziere Nicht-Excel-Artikel')
print('=' * 70)

# 1. EXCEL LESEN - Spalte A hat die Artikelnummern
print('\n[1/5] Lese Excel-Datei...')
df = pd.read_excel(EXCEL_PATH)
excel_column = df.columns[0]  # Erste Spalte = Artikelnummer
print(f'       Spalte: {excel_column}')

# Excel Artikelnummern als Set
excel_articles = set()
for value in df[excel_column]:
    if pd.notna(value):
        article_num = str(value).strip()
        if article_num and article_num != 'nan':
            excel_articles.add(article_num)

print(f'       OK: {len(excel_articles)} unique Artikelnummern in Excel')

# 2. ALLE SYSTEM-ARTIKEL HOLEN
print('\n[2/5] Lade ALLE Artikel aus dem System...')
all_system_articles = []
page = 1
limit = 100

while True:
    response = requests.get(f'{API_URL}?page={page}&limit={limit}')
    data = response.json()

    if data.get('success') and data.get('data'):
        articles = data.get('data', [])
        all_system_articles.extend(articles)
        print(f'       Seite {page}: {len(articles)} Artikel')

        if not data.get('pagination', {}).get('hasNext', False):
            break
        page += 1
    else:
        break

print(f'       OK: {len(all_system_articles)} Artikel im System')

# 3. VERGLEICHE UND KATEGORISIERE
print('\n[3/5] Analysiere Artikel...')

in_both = []           # In Excel UND System
only_in_system = []    # NUR im System (nicht in Excel) <- DIESE MARKIEREN!
only_in_excel = []     # NUR in Excel (fehlen im System)

# System Artikel durchgehen
for article in all_system_articles:
    art_num = str(article.get('articleNumber', '')).strip()
    if art_num in excel_articles:
        in_both.append(article)
    else:
        only_in_system.append(article)

# Excel Artikel die nicht im System sind
system_numbers = {str(a.get('articleNumber')).strip() for a in all_system_articles}
for excel_num in excel_articles:
    if excel_num not in system_numbers:
        only_in_excel.append(excel_num)

print(f'       OK: {len(in_both)} Artikel in BEIDEN (Excel + System)')
print(f'       WARNUNG: {len(only_in_system)} Artikel NUR im System (WERDEN MARKIERT!)')
print(f'       FEHLT: {len(only_in_excel)} Artikel NUR in Excel (fehlen im System)')

# 4. ERSTELLE UPDATE-BEFEHLE
print('\n[4/5] Erstelle Update-Befehle...')

# Artikel die MARKIERT werden müssen (nicht in Excel)
articles_to_mark = []
for article in only_in_system:
    articles_to_mark.append({
        'id': article['id'],
        'articleNumber': article['articleNumber'],
        'productName': article.get('productName', ''),
        'markAsNotInExcel': True
    })

# Artikel die NICHT markiert werden (sind in Excel)
articles_not_to_mark = []
for article in in_both:
    articles_not_to_mark.append({
        'id': article['id'],
        'articleNumber': article['articleNumber'],
        'productName': article.get('productName', ''),
        'markAsNotInExcel': False
    })

# 5. SPEICHERE ERGEBNISSE
print('\n[5/5] Speichere Ergebnisse...')

# Hauptergebnis
result = {
    'timestamp': pd.Timestamp.now().isoformat(),
    'summary': {
        'totalInExcel': len(excel_articles),
        'totalInSystem': len(all_system_articles),
        'inBoth': len(in_both),
        'onlyInSystem_TO_MARK': len(only_in_system),
        'onlyInExcel_MISSING': len(only_in_excel)
    },
    'articlesToMark': articles_to_mark,
    'articlesNotToMark': articles_not_to_mark,
    'missingInSystem': only_in_excel
}

with open('article-marking-plan.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print('       OK: article-marking-plan.json')

# Liste der zu markierenden IDs für Backend
mark_these = {
    'toMarkAsNotInExcel': [a['id'] for a in articles_to_mark],
    'articleNumbers': [a['articleNumber'] for a in articles_to_mark]
}

with open('mark-these-articles.json', 'w', encoding='utf-8') as f:
    json.dump(mark_these, f, indent=2)
print('       OK: mark-these-articles.json')

# Update SQL/Script Commands
with open('update-commands.sql', 'w', encoding='utf-8') as f:
    f.write('-- SQL Commands to mark articles not in Excel\n')
    f.write('-- Diese Artikel sind NUR vom Shop gecrawlt, nicht in der Excel\n\n')

    # Erst alle auf false setzen (die in Excel sind)
    f.write('-- 1. Setze alle Artikel die IN der Excel sind auf notInExcel = false\n')
    if in_both:
        article_nums = "','".join([a['articleNumber'] for a in in_both])
        f.write(f"UPDATE products SET category = 'FROM_EXCEL' WHERE \"articleNumber\" IN ('{article_nums}');\n\n")

    # Dann die markieren die NICHT in Excel sind
    f.write('-- 2. Markiere alle Artikel die NICHT in der Excel sind\n')
    if only_in_system:
        article_nums = "','".join([a['articleNumber'] for a in only_in_system])
        f.write(f"UPDATE products SET category = 'SHOP_ONLY' WHERE \"articleNumber\" IN ('{article_nums}');\n")

print('       OK: update-commands.sql')

# 6. ZUSAMMENFASSUNG
print('\n' + '=' * 70)
print('ERGEBNIS:')
print('=' * 70)
print(f'Excel-Artikel:                    {len(excel_articles):>6}')
print(f'System-Artikel:                   {len(all_system_articles):>6}')
print('-' * 70)
print(f'In BEIDEN (Excel + System):       {len(in_both):>6} OK:')
print(f'NUR im System (markieren!):       {len(only_in_system):>6} WARNUNG:️ <- WERDEN MARKIERT!')
print(f'NUR in Excel (fehlen):            {len(only_in_excel):>6} FEHLT:')
print('=' * 70)

if only_in_system:
    print('\nWARNUNG:️  DIESE ARTIKEL WERDEN MARKIERT (erste 10):')
    print('   (Sind NUR im Shop, NICHT in deiner Excel)')
    for i, article in enumerate(only_in_system[:10], 1):
        print(f'   {i:3}. {article["articleNumber"]:10} - {article.get("productName", "")[:50]}')
    if len(only_in_system) > 10:
        print(f'   ... und {len(only_in_system) - 10} weitere')

print('\nFERTIG: FERTIG! Die Dateien enthalten:')
print('   - article-marking-plan.json: Kompletter Plan mit allen Details')
print('   - mark-these-articles.json: IDs zum Markieren für Backend')
print('   - update-commands.sql: SQL Befehle zum Ausführen')
print('\n--> Nutze "category" Feld: SHOP_ONLY = nicht in Excel, FROM_EXCEL = in Excel')