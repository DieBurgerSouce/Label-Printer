#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vergleicht Excel-Artikel mit System-Artikeln
und erstellt eine JSON-Datei mit fehlenden Artikeln
"""

import pandas as pd
import json
import requests
from pathlib import Path

# Konfiguration
EXCEL_PATH = r'C:\Users\benfi\Downloads\Alle Artikel_gemerged.xlsx'
API_URL = 'http://localhost:3001/api/articles'

def main():
    print('ARTIKEL-VERGLEICH: Excel vs System\n')
    print('=' * 60)

    # Excel-Datei lesen
    print('\n1. Lese Excel-Datei...')
    try:
        df = pd.read_excel(EXCEL_PATH)
        print(f'   OK: Excel geladen: {len(df)} Zeilen')
    except Exception as e:
        print(f'   FEHLER beim Lesen der Excel: {e}')
        return

    # Zeige Spalten
    print(f'   Spalten: {", ".join(df.columns[:10])}')

    # Artikelnummern extrahieren - versuche verschiedene Spaltennamen
    article_columns = ['Artikel', 'Artikelnummer', 'Art.-Nr.', 'Art.Nr.', 'Artikel-Nr.', 'ArtikelNr']
    excel_articles = {}
    article_column = None

    for col in article_columns:
        if col in df.columns:
            article_column = col
            break

    if not article_column:
        # Wenn keine Standard-Spalte gefunden, nimm die erste Spalte
        article_column = df.columns[0]
        print(f'   Verwende erste Spalte als Artikelnummer: {article_column}')

    # Extrahiere Artikel aus Excel
    for index, row in df.iterrows():
        article_number = str(row[article_column]).strip() if pd.notna(row[article_column]) else None

        if article_number and article_number != 'nan':
            # Sammle alle Daten für diesen Artikel
            article_data = {
                'articleNumber': article_number,
                'excelRow': row.to_dict(),
                'rowIndex': index + 2  # Excel startet bei Zeile 2 (nach Header)
            }

            # Versuche Produktname zu finden
            for col in ['Bezeichnung', 'Produktname', 'Artikel', 'Name', 'Beschreibung']:
                if col in row and pd.notna(row[col]):
                    article_data['productName'] = str(row[col])
                    break

            # Versuche Preis zu finden
            for col in ['Preis', 'VK-Preis', 'Einzelpreis', 'VK', 'Verkaufspreis']:
                if col in row and pd.notna(row[col]):
                    try:
                        article_data['price'] = float(str(row[col]).replace(',', '.').replace('€', '').strip())
                    except:
                        pass
                    break

            excel_articles[article_number] = article_data

    print(f'   OK: {len(excel_articles)} unique Artikelnummern in Excel')

    # System-Artikel abrufen
    print('\n2. Rufe System-Artikel ab...')
    try:
        response = requests.get(API_URL)
        system_data = response.json()

        if system_data.get('success'):
            system_articles = {}
            for article in system_data.get('data', []):
                if article.get('articleNumber'):
                    system_articles[str(article['articleNumber']).strip()] = article

            print(f'   OK: {len(system_articles)} Artikel im System')
        else:
            print('   FEHLER beim Abrufen der System-Artikel')
            system_articles = {}
    except Exception as e:
        print(f'   API-Fehler: {e}')
        system_articles = {}

    # Vergleich durchführen
    print('\n3. Vergleiche Artikel...')

    missing_articles = []
    found_articles = []

    for article_number, excel_data in excel_articles.items():
        if article_number not in system_articles:
            missing_articles.append(excel_data)
        else:
            found_articles.append({
                'articleNumber': article_number,
                'inExcel': excel_data.get('productName', ''),
                'inSystem': system_articles[article_number].get('productName', '')
            })

    print(f'   OK: {len(found_articles)} Artikel bereits im System')
    print(f'   FEHLEN: {len(missing_articles)} Artikel fehlen im System')

    # Ergebnisse speichern
    print('\n4. Speichere Ergebnisse...')

    # Vollständige JSON mit allen Details
    result = {
        'timestamp': pd.Timestamp.now().isoformat(),
        'excelFile': EXCEL_PATH,
        'summary': {
            'totalInExcel': len(excel_articles),
            'totalInSystem': len(system_articles),
            'foundInBoth': len(found_articles),
            'missingInSystem': len(missing_articles),
            'coverage': f"{(len(found_articles) / len(excel_articles) * 100):.1f}%" if excel_articles else "0%"
        },
        'missingArticles': sorted(missing_articles, key=lambda x: x['articleNumber']),
        'foundArticles': sorted(found_articles, key=lambda x: x['articleNumber'])
    }

    with open('missing-articles-full.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print('   Vollstaendige Daten: missing-articles-full.json')

    # Kompakte Liste nur mit Artikelnummern und Namen
    missing_simple = []
    for article in missing_articles:
        missing_simple.append({
            'articleNumber': article['articleNumber'],
            'productName': article.get('productName', ''),
            'price': article.get('price', 0),
            'excelRow': article.get('rowIndex', 0)
        })

    with open('missing-articles.json', 'w', encoding='utf-8') as f:
        json.dump(missing_simple, f, ensure_ascii=False, indent=2)
    print('   Kompakte Liste: missing-articles.json')

    # Nur Artikelnummern
    missing_numbers = [a['articleNumber'] for a in missing_articles]
    with open('missing-article-numbers.json', 'w', encoding='utf-8') as f:
        json.dump(sorted(missing_numbers), f, indent=2)
    print('   Nur Nummern: missing-article-numbers.json')

    # Statistik anzeigen
    print('\n' + '=' * 60)
    print('ZUSAMMENFASSUNG:')
    print('=' * 60)
    print(f'Excel-Artikel:              {len(excel_articles):>6}')
    print(f'System-Artikel:             {len(system_articles):>6}')
    print(f'Bereits im System:          {len(found_articles):>6} [OK]')
    print(f'Fehlen im System:           {len(missing_articles):>6} [FEHLT]')
    if excel_articles:
        coverage = len(found_articles) / len(excel_articles) * 100
        print(f'Abdeckung:                  {coverage:>5.1f}%')
    print('=' * 60)

    # Zeige erste fehlende Artikel
    if missing_articles:
        print('\nErste 10 fehlende Artikel:')
        for i, article in enumerate(missing_articles[:10], 1):
            name = article.get('productName', 'Unbekannt')[:50]
            print(f'   {i:2}. {article["articleNumber"]:10} - {name}')

        if len(missing_articles) > 10:
            print(f'   ... und {len(missing_articles) - 10} weitere')

if __name__ == '__main__':
    main()