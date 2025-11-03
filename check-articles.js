const axios = require('axios');

async function checkArticles() {
  try {
    const response = await axios.get('http://localhost:3001/api/articles');
    const articles = response.data.data;

    console.log('✅ Artikel in Datenbank:', articles.length);
    console.log('\n📦 Artikel-Details:\n');

    articles.forEach((article, i) => {
      console.log(`${i + 1}. Artikel ${article.articleNumber}`);
      console.log(`   Name: ${article.productName?.substring(0, 60)}...`);
      console.log(`   Preis: ${article.price || article.tieredPricesText || 'N/A'}`);
      console.log(`   Beschreibung: ${article.description ? 'Vorhanden' : 'Keine'}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('✅ Frontend-URL: http://localhost:3001');
    console.log('Du kannst jetzt die Artikel im Frontend sehen und Labels drucken!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Fehler:', error.message);
  }
}

checkArticles();
