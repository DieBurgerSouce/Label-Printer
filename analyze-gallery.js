/**
 * Analyze product gallery structure
 */
const puppeteer = require('puppeteer');

async function analyzeGallery() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://shop.firmenich.de/Papier/1-5-kg-Papiertragetasche-Kartoffeln-NEU', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait for images to load
  await new Promise(r => setTimeout(r, 3000));

  const galleryInfo = await page.evaluate(() => {
    // Find all images with itemprop="image"
    const mainImages = Array.from(document.querySelectorAll('img[itemprop="image"]'));

    // Find the product media container
    const mediaContainer = document.querySelector('.product-detail-media');

    // Find all images in the media container
    const allImages = mediaContainer ? Array.from(mediaContainer.querySelectorAll('img')) : [];

    return {
      mainImages: mainImages.map(img => ({
        src: img.src,
        className: img.className,
        width: img.getBoundingClientRect().width,
        height: img.getBoundingClientRect().height,
        parentClass: img.parentElement?.className,
        grandParentClass: img.parentElement?.parentElement?.className
      })),
      allImages: allImages.map(img => ({
        src: img.src,
        className: img.className,
        width: img.getBoundingClientRect().width,
        height: img.getBoundingClientRect().height,
        parentClass: img.parentElement?.className,
        isVisible: img.getBoundingClientRect().width > 0
      })),
      mediaContainerHTML: mediaContainer ? mediaContainer.outerHTML.substring(0, 1000) : 'NOT FOUND'
    };
  });

  console.log('\n📸 GALLERY ANALYSIS');
  console.log('='.repeat(80));

  console.log('\n🎯 Main Images (itemprop="image"):');
  galleryInfo.mainImages.forEach((img, i) => {
    console.log(`\n${i + 1}. ${img.width}x${img.height}px`);
    console.log(`   Class: ${img.className || 'none'}`);
    console.log(`   Parent: ${img.parentClass || 'none'}`);
    console.log(`   GrandParent: ${img.grandParentClass || 'none'}`);
    console.log(`   Src: ${img.src.substring(0, 80)}...`);
  });

  console.log('\n\n📷 All Images in Media Container:');
  galleryInfo.allImages.forEach((img, i) => {
    console.log(`\n${i + 1}. ${img.width}x${img.height}px (${img.isVisible ? 'VISIBLE' : 'HIDDEN'})`);
    console.log(`   Class: ${img.className || 'none'}`);
    console.log(`   Parent: ${img.parentClass || 'none'}`);
  });

  console.log('\n\n🔍 Media Container HTML (first 1000 chars):');
  console.log(galleryInfo.mediaContainerHTML);

  await browser.close();
}

analyzeGallery().catch(console.error);
