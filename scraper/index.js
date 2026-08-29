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
  console.log("Fetching tracked pages from Firebase...");
  const pagesSnapshot = await getDatabase().ref('tracked_pages').once('value');
  const pagesData = pagesSnapshot.val();

  if (!pagesData) {
    console.log("No pages tracked in database. Exiting.");
    process.exit(0);
  }

  const pagesToScrape = Object.keys(pagesData).map(key => ({
    id: key,
    url: pagesData[key].url
  }));

  console.log(`Starting Facebook Scraper for ${pagesToScrape.length} pages...`);
  
  const browser = await chromium.launch({ headless: true });
  console.log("Browser launched.");
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  console.log("Page created.");
  
  for (const target of pagesToScrape) {
    console.log(`\nNavigating to ${target.url}...`);
    try {
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => {
        console.log(`Navigation timeout for ${target.id}, but proceeding anyway...`);
      });
      
      console.log(`Waiting for articles to load on ${target.id}...`);
      await page.waitForSelector('div[role="article"]', { timeout: 10000 }).catch(() => {
        console.log(`No articles found quickly for ${target.id}.`);
      });
      
      const posts = await page.$$eval('div[role="article"]', (articles) => {
        return articles.slice(0, 3).map((el, index) => {
          // Get text caption
          const textElement = el.querySelector('div[dir="auto"]');
          const caption = textElement ? textElement.innerText : '';
          
          // Get image URL if there is an infographic attached
          const imgElement = el.querySelector('img[referrerpolicy="origin-when-cross-origin"]');
          const imgUrl = imgElement ? imgElement.src : null;
          
          return {
            id: `post_${index}`,
            caption: caption,
            imgUrl: imgUrl,
            timestamp: new Date().toISOString()
          };
        });
      });
      
      console.log(`Found ${posts.length} posts for ${target.id}. Processing with OCR...`);
      
      const finalPosts = [];
      const Tesseract = require('tesseract.js');
      
      for (const post of posts) {
        let fullText = post.caption;
        
        // If an image exists, run Tesseract OCR locally
        if (post.imgUrl) {
          try {
            console.log(`Running Tesseract OCR on image for ${target.id}...`);
            const { data: { text } } = await Tesseract.recognize(
              post.imgUrl,
              'eng'
            );
            
            if (text && text.trim()) {
              fullText = `${post.caption}\n\n[OCR Extracted Text]:\n${text.trim()}`;
              console.log(`OCR Success! Extracted ${text.trim().length} characters.`);
            }
          } catch (e) {
            console.log(`OCR failed for this image: ${e.message}`);
          }
        }
        
        finalPosts.push({
          id: post.id,
          text: fullText || 'No text content',
          timestamp: post.timestamp
        });
      }
      
      if (finalPosts.length > 0) {
        const dbRef = getDatabase().ref(`announcements/${target.id}`);
        await dbRef.set(finalPosts);
        console.log(`Successfully saved ${target.id} to Firebase!`);
      }

      // Respectful delay to prevent getting blocked
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (err) {
      console.error(`Error scraping ${target.id}:`, err);
    }
  }

  await browser.close();
  console.log("\nFinished scraping all pages.");
  process.exit(0);
}

scrapeAnnouncements();
