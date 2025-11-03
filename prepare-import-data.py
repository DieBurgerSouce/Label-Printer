#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bereitet die 594 fehlenden Artikel für den Import vor
Kategorisiert sie und erstellt die Import-JSON
"""

import pandas as pd
import json
import requests
from datetime import datetime

EXCEL_PATH = r'C:\Users\benfi\Downloads\Alle Artikel_gemerged.xlsx'
API_URL = 'http://localhost:3001/api/articles'

print('='*70)
print('VORBEREITUNG: Import von 594 fehlenden Excel-Artikeln')
print('='*70)

# 1. Excel lesen
print('\n1. Lese Excel-Datei...')
df = pd.read_excel(EXCEL_PATH)
print(f'   Gelesen: {len(df)} Zeilen')

# 2. System-Artikel abrufen um fehlende zu identifizieren
print('\n2. Identifiziere fehlende Artikel...')
all_system_articles = []
page = 1

while True:
    response = requests.get(f'{API_URL}?page={page}&limit=100')
    data = response.json()

    if data.get('success') and data.get('data'):
        all_system_articles.extend(data.get('data', []))
        if not data.get('pagination', {}).get('hasNext', False):
            break
        page += 1
    else:
        break

system_article_numbers = {str(a['articleNumber']).strip() for a in all_system_articles}
print(f'   System hat: {len(system_article_numbers)} Artikel')

# 3. Fehlende Artikel identifizieren
missing_articles = []
for index, row in df.iterrows():
    article_num = str(row['Artikelnummer']).strip()

    if article_num not in system_article_numbers and article_num != 'nan':
        missing_articles.append(row)

print(f'   Fehlende: {len(missing_articles)} Artikel')

# 4. Kategorisiere und bereite Import vor
import_articles = []
stats = {
    'single_price': 0,
    'tiered_price': 0,
    'auf_anfrage': 0,
    'needs_tier_quantities': 0
}

for row in missing_articles:
    article = {
        'articleNumber': str(row['Artikelnummer']).strip(),
        'productName': str(row.get('Matchcode', '')),
        'description': str(row.get('Beschreibung', '')),
        'currency': 'EUR',
        'sourceUrl': 'https://shop.firmenich.de',
        'category': 'FROM_EXCEL',
        'published': True,
        'verified': True,  # Normale Artikel sind verifiziert
        'ocrConfidence': 1.0
    }

    # Preis-Analyse
    preis1 = row.get('Preis 1', 0)
    preis2 = row.get('Preis 2', 0)
    preis3 = row.get('Preis 3', 0)
    preis4 = row.get('Preis 4', 0)
    einheit = str(row.get('Einheit', 'Stück'))
    preis_pro = row.get('Preis pro', 1)

    # Konvertiere Preise zu float wo möglich
    def to_float(val):
        if pd.isna(val):
            return 0
        if isinstance(val, str):
            if 'Auf Anfrage' in val or 'auf Anfrage' in val:
                return 'Auf Anfrage'
            try:
                return float(val.replace(',', '.').replace('€', '').strip())
            except:
                return 0
        try:
            return float(val)
        except:
            return 0

    preis1 = to_float(preis1)
    preis2 = to_float(preis2)
    preis3 = to_float(preis3)
    preis4 = to_float(preis4)

    # Fall 1: "Auf Anfrage"
    if preis1 == 'Auf Anfrage' or (preis1 == 0 and preis2 == 0 and preis3 == 0 and preis4 == 0):
        article['price'] = 0
        article['tieredPricesText'] = 'Auf Anfrage'
        stats['auf_anfrage'] += 1

    # Fall 2: Staffelpreise (Preis 2, 3 oder 4 sind gefüllt)
    elif preis2 > 0 or preis3 > 0 or preis4 > 0:
        # Basis-Preis
        article['price'] = preis1 if preis1 > 0 else preis2

        # Staffelpreise sammeln
        tiers = []
        if preis2 > 0 and preis2 != preis1:
            tiers.append({'quantity': None, 'price': preis2})
        if preis3 > 0 and preis3 != preis2:
            tiers.append({'quantity': None, 'price': preis3})
        if preis4 > 0 and preis4 != preis3:
            tiers.append({'quantity': None, 'price': preis4})

        if tiers:
            article['tieredPrices'] = tiers
            article['verified'] = False  # Nicht verifiziert wegen fehlender Mengen
            article['manufacturer'] = 'NEEDS_TIER_QUANTITIES'  # Markierung!
            stats['tiered_price'] += 1
            stats['needs_tier_quantities'] += 1
        else:
            # Alle Preise gleich, nur Einzelpreis
            stats['single_price'] += 1

    # Fall 3: Nur Einzelpreis
    elif preis1 > 0:
        article['price'] = preis1
        stats['single_price'] += 1

    # Fall 4: Kein gültiger Preis
    else:
        article['price'] = 0
        article['tieredPricesText'] = 'Preis nicht verfügbar'
        stats['auf_anfrage'] += 1

    # Zusätzliche Felder
    if einheit and einheit != 'nan':
        article['ean'] = einheit  # Missbrauche EAN-Feld für Einheit

    import_articles.append(article)

# 5. Speichere Import-Daten
print('\n3. Kategorisierung abgeschlossen:')
print(f'   Einzelpreis-Artikel: {stats["single_price"]}')
print(f'   Staffelpreis-Artikel: {stats["tiered_price"]} (brauchen Mengenpflege!)')
print(f'   "Auf Anfrage" Artikel: {stats["auf_anfrage"]}')

# Haupt-Import-Datei
import_data = {
    'timestamp': datetime.now().isoformat(),
    'source': 'Excel Import',
    'statistics': stats,
    'totalArticles': len(import_articles),
    'articles': import_articles
}

with open('import-ready.json', 'w', encoding='utf-8') as f:
    json.dump(import_data, f, ensure_ascii=False, indent=2)
print(f'\n4. Import-Datei erstellt: import-ready.json')
print(f'   Enthält {len(import_articles)} Artikel')

# 6. Erstelle CSV für Nachpflege der Staffelpreise
print('\n5. Erstelle Nachpflege-CSV für Staffelpreis-Artikel...')
nachpflege_data = []

for article in import_articles:
    if article.get('manufacturer') == 'NEEDS_TIER_QUANTITIES':
        row_data = {
            'Artikelnummer': article['articleNumber'],
            'Produktname': article['productName'][:50],
            'Preis_1': article['price']
        }

        # Füge Staffelpreise hinzu
        if 'tieredPrices' in article:
            for i, tier in enumerate(article['tieredPrices'], 2):
                row_data[f'Preis_{i}'] = tier['price']
                row_data[f'Ab_Menge_{i}'] = ''  # Leer für manuelle Eingabe

        nachpflege_data.append(row_data)

if nachpflege_data:
    nachpflege_df = pd.DataFrame(nachpflege_data)
    nachpflege_df.to_csv('nachpflege-staffelmengen.csv', index=False, encoding='utf-8-sig')
    print(f'   CSV erstellt: nachpflege-staffelmengen.csv')
    print(f'   Enthält {len(nachpflege_data)} Artikel zur Nachpflege')

print('\n' + '='*70)
print('BEREIT FÜR IMPORT!')
print('='*70)
print(f'Gesamt: {len(import_articles)} Artikel')
print(f'Davon {stats["needs_tier_quantities"]} benötigen Mengenpflege')
print('\nNächster Schritt: node import-articles.js')