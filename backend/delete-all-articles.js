const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllArticles() {
  try {
    console.log('🗑️  Lösche ALLE Artikel aus der Datenbank...');
    
    const result = await prisma.product.deleteMany({});
    
    console.log(`✅ ${result.count} Artikel erfolgreich gelöscht`);
    
    const remaining = await prisma.product.count();
    console.log(`📊 Verbleibende Artikel: ${remaining}`);
    
  } catch (error) {
    console.error('❌ Fehler:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllArticles();
