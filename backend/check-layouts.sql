SELECT DISTINCT p.url, p.title
FROM products p
JOIN screenshots s ON s.productId = p.id
WHERE p.crawlJobId = 'c45af749-a1f0-463e-812c-6b441a083b2c'
LIMIT 10;
