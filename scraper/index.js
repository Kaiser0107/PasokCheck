const { chromium } = require('playwright');
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
require('dotenv').config();

const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://web-scraper-suspension-default-rtdb.asia-southeast1.firebasedatabase.app"
});

async function scrapeAnnouncements() {
  console.log('Starting Facebook Scraper...');
  try {
    const browser = await chromium.launch({ headless: true, timeout: 10000 });
    console.log('Browser launched.');
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    console.log('Page created.');

    const targetUrl = 'https://www.facebook.com/PGNEOfficial';
    console.log(`Navigating to ${targetUrl}...`);
    
    // Use a strict 15-second timeout for navigation
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => {
      console.log('Navigation timeout hit (expected for Facebook), continuing anyway...');
    });
    
    console.log('Waiting for articles to load...');
    await page.waitForSelector('div[role="article"]', { timeout: 10000 }).catch(() => console.log("Timeout waiting for articles. Might be a login wall or layout change."));

    const posts = await page.$$eval('div[role="article"]', (articles) => {
      return articles.slice(0, 3).map((article, index) => {
        return {
          id: `post_${index}`,
          text: article.innerText,
          timestamp: new Date().toISOString()
        };
      });
    });

    console.log(`Found ${posts.length} posts.`);

    if (posts.length > 0) {
      const dbRef = getDatabase().ref('announcements/PGNEOfficial');
      await dbRef.set(posts);
      console.log('Successfully saved to Firebase!');
    } else {
      console.log('No posts found to save.');
    }

    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error('Fatal Error during scraping:', error);
    process.exit(1);
  }
}

scrapeAnnouncements();

