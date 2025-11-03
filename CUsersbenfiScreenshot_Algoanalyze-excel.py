import pandas as pd
import json

xl = pd.read_excel(r'C:\Users\benfi\Downloads\Alle Artikel_gemerged.xlsx')

print('=' * 80)
print('EXCEL-DATEI STRUKTUR')
print('=' * 80)
print(f'\nAnzahl Artikel: {len(xl)}')
print(f'\nSpaltennamen: {list(xl.columns)}')
print(f'\nDatentypen:\n{xl.dtypes}')

print('\n' + '=' * 80)
print('PREIS-ANALYSE')
print('=' * 80)

# Auf Anfrage Artikel
auf_anfrage = xl[xl['Preis 1'].astype(str).str.contains('Auf Anfrage', na=False)]
print(f'\nArtikel mit "Auf Anfrage": {len(auf_anfrage)}')

# Numerische Preise
numerisch = xl[pd.to_numeric(xl['Preis 1'], errors='coerce') > 0]
print(f'Artikel mit numerischem Preis 1: {len(numerisch)}')

# Mehrere Preise
preis2_numeric = pd.to_numeric(xl['Preis 2'], errors='coerce')
preis3_numeric = pd.to_numeric(xl['Preis 3'], errors='coerce')
preis4_numeric = pd.to_numeric(xl['Preis 4'], errors='coerce')

multi_preis = xl[
    (preis2_numeric > 0) | 
    (preis3_numeric > 0) | 
    (preis4_numeric > 0)
]
print(f'Artikel mit Staffelpreisen (Preis 2/3/4): {len(multi_preis)}')

print('\n' + '=' * 80)
print('BEISPIELE: NUR PREIS 1')
print('=' * 80)
nur_p1 = xl[
    (pd.to_numeric(xl['Preis 1'], errors='coerce') > 0) & 
    (preis2_numeric == 0)
].head(5)
print(nur_p1[['Artikelnummer', 'Matchcode', 'Preis 1', 'Preis 2', 'Preis 3', 'Preis 4', 'Preis pro']].to_string())

print('\n' + '=' * 80)
print('BEISPIELE: STAFFELPREISE')
print('=' * 80)
print(multi_preis.head(10)[['Artikelnummer', 'Matchcode', 'Beschreibung', 'Preis 1', 'Preis 2', 'Preis 3', 'Preis 4', 'Preis pro']].to_string())

print('\n' + '=' * 80)
print('BESCHREIBUNGS-ANALYSE FÜR STAFFELPREISE')
print('=' * 80)
print('\nBeispiele mit Beschreibung:')
for idx, row in multi_preis.head(5).iterrows():
    print(f"\nArtikel {row['Artikelnummer']}:")
    print(f"  Matchcode: {row['Matchcode']}")
    print(f"  Beschreibung: {row['Beschreibung']}")
    print(f"  Preise: {row['Preis 1']} / {row['Preis 2']} / {row['Preis 3']} / {row['Preis 4']}")
    print(f"  Preis pro: {row['Preis pro']}")
