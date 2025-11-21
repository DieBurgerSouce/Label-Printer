const http = require('http');

http.get('http://localhost:3001/api/articles?limit=10', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('Total articles:', json.pagination.total);
    console.log('\nArticles:');
    json.data.forEach((a, i) => {
      console.log(`  ${i+1}. ${a.articleNumber} - ${a.productName}`);
      console.log(`      Price: ${a.price} ${a.currency} (Type: ${a.priceType})`);
      console.log(`      Tiered: ${a.tieredPrices?.length || 0} tiers`);
    });
  });
});
