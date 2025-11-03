
import pandas as pd
import json
import requests

excel_path = r'C:\Users\benfi\Downloads\Alle Artikel_gemerged.xlsx'
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

    print(f"\nFehlend: {len(missing)}")
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

    print("\nGespeichert in: missing-articles.json")
