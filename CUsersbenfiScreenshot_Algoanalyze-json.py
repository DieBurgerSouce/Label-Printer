import json

with open(r'C:\Users\benfi\Screenshot_Algo\missing-articles-CORRECT.json', encoding='utf-8') as f:
    data = json.load(f)

print('=' * 80)
print('MISSING-ARTICLES JSON ANALYSE')
print('=' * 80)
print(f'\nAnzahl Artikel: {len(data)}')

print('\n--- BEISPIEL 1 ---')
print(json.dumps(data[0], indent=2, ensure_ascii=False))

print('\n--- BEISPIEL 2 ---')
print(json.dumps(data[1], indent=2, ensure_ascii=False))

print('\n--- BEISPIEL 3 ---')
print(json.dumps(data[2], indent=2, ensure_ascii=False))

# Analysiere Felder
all_keys = set()
for article in data:
    all_keys.update(article.keys())

print(f'\n\nAlle verwendeten Felder: {sorted(all_keys)}')

# Preis-Analyse
auf_anfrage = [a for a in data if a.get('preis') == 'Auf Anfrage']
print(f'\nArtikel mit "Auf Anfrage": {len(auf_anfrage)}')

# Artikel mit numerischem Preis
numeric_preis = [a for a in data if a.get('preis') != 'Auf Anfrage']
print(f'Artikel mit numerischem Preis: {len(numeric_preis)}')
if numeric_preis:
    print('\nBeispiel mit numerischem Preis:')
    print(json.dumps(numeric_preis[0], indent=2, ensure_ascii=False))
