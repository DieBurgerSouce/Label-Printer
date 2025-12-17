/**
 * Cookie Handler for Web Crawler
 * Handles cookie consent banners to ensure clean screenshots
 */

import { Page } from 'puppeteer';

/**
 * Accept all cookies to remove cookie banners from screenshots
 * CRITICAL: This must run BEFORE any product screenshots are taken!
 */
export async function acceptCookies(page: Page): Promise<void> {
  try {
    let cookieAccepted = false;

    // Text patterns to search for in buttons
    const textPatterns = [
      'alle cookies akzeptieren',
      'alle akzeptieren',
      'accept all cookies',
      'accept all',
      'akzeptieren',
    ];

    // Get all buttons and links
    const elements = await page.$$('button, a');

    for (const element of elements) {
      try {
        const text = await element.evaluate((el) => el.textContent?.trim().toLowerCase() || '');

        // Check if button text matches any pattern
        for (const pattern of textPatterns) {
          if (text.includes(pattern)) {
            const box = await element.boundingBox();
            if (box) {
              console.log(`✓ Found cookie button: "${text}"`);
              await element.click();
              await new Promise((r) => setTimeout(r, 1000));
              cookieAccepted = true;
              break;
            }
          }
        }

        if (cookieAccepted) break;
      } catch {
        // Continue to next element
      }
    }

    if (!cookieAccepted) {
      console.log('⚠️  No cookie button found');
    }
  } catch (error) {
    console.log(
      '⚠️  Cookie acceptance failed:',
      error instanceof Error ? error.message : 'Unknown'
    );
  }
}
