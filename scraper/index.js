const { chromium } = require('playwright');
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
require('dotenv').config();

// --- Configuration & Initialization ---
const serviceAccount = require('./serviceAccountKey.json');
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://web-scraper-suspension-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = getDatabase();

// --- Core Functions ---

async function fetchTrackedPages() {
  const snapshot = await db.ref('tracked_pages').once('value');
  const data = snapshot.val();
  if (!data) return [];
  
  return Object.keys(data).map(key => ({
    id: key,
    url: data[key].url
  }));
}

// Helper to parse messy Facebook date strings into a real Date object
function parseFacebookDate(dateStr) {
  if (!dateStr) return new Date();
  const text = dateStr.toLowerCase();
  const now = new Date();
  
  try {
    if (text.includes('just now') || text.includes('min') || text.includes('m')) {
      return now; // Close enough for hackathon
    }
    if (text.includes('hr') || text.includes('h')) {
      const match = text.match(/(\d+)/);
      if (match) {
        now.setHours(now.getHours() - parseInt(match[1]));
        return now;
      }
    }
    if (text.includes('yesterday')) {
      now.setDate(now.getDate() - 1);
      return now;
    }
    
    // Looks like "August 24 at 10:00 AM" or "August 24"
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    for (let i = 0; i < 12; i++) {
      if (text.includes(months[i]) || text.includes(shortMonths[i])) {
        const dayMatch = text.match(/\d{1,2}/);
        if (dayMatch) {
          const yearMatch = text.match(/\d{4}/);
          const year = yearMatch ? parseInt(yearMatch[0]) : now.getFullYear();
          return new Date(year, i, parseInt(dayMatch[0]));
        }
      }
    }
  } catch (e) {
    console.log(`Failed to parse date: ${dateStr}`);
  }
  return now; // Fallback
}

async function scrapePagePosts(page, targetUrl) {
  console.log(`Scraping latest announcements from ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  
  try {
    await page.waitForSelector('div[role="article"]', { timeout: 10000 });
    
    // Quick scroll to load the top 5 recent posts
    for (let i = 0; i < 3; i++) {
      try {
        const closeBtn = await page.$('div[aria-label="Close"]');
        if (closeBtn) await closeBtn.click();
      } catch (e) {}

      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (e) {
    console.log(`No articles found quickly for ${targetUrl}.`);
    return [];
  }
  
  const extractedPosts = await page.$$eval('div[role="article"]', (articles) => {
    // Grab the top 10 posts (covers a full 24-48 hours easily)
    return articles.slice(0, 10).map((el, index) => {
      // INSTEAD of guessing which nested div has the caption, we grab ALL text inside the entire post!
      const fullText = el.innerText || '';
      
      const imgElement = el.querySelector('img[referrerpolicy="origin-when-cross-origin"]');
      const altText = imgElement ? (imgElement.getAttribute('alt') || '') : '';
      
      const dateElement = el.querySelector('a[role="link"] > span[dir="auto"], span > span > a[role="link"], span > a > span > span');
      const rawDateText = dateElement ? dateElement.innerText : '';
      
      return {
        id: `post_${index}`,
        caption: fullText, // Now contains EVERYTHING: Page Name, Caption, Comments, etc.
        altText: altText,
        rawDateText: rawDateText,
        imgUrl: imgElement ? imgElement.src : null
      };
    });
  });

  const validPosts = [];
  
  for (const post of extractedPosts) {
    const postDate = parseFacebookDate(post.rawDateText);
    post.timestamp = postDate.toISOString();
    validPosts.push(post);
  }
  
  console.log(`Extracted top ${validPosts.length} most recent posts.`);
  return validPosts;
}

async function processPosts(posts) {
  // Common terms used in the Philippines for class suspensions
  const asyncKeywords = [
    'walang pasok', 'walangpasok', 'suspended', 'suspension', 'asynchronous', 'asynch', 
    'modular', 'distance learning', 'cancel', 'cancelled', 'no face-to-face',
    'no face to face', 'no f2f'
  ];

  // Common terms for online/live classes
  const syncKeywords = [
    'synchronous', 'synch', 'online class', 'virtual class', 'zoom', 'teams'
  ];

  const allKeywords = [...asyncKeywords, ...syncKeywords];

  for (const post of posts) {
    // Normalize custom bold/italic unicode fonts back to standard ASCII letters using NFKC
    const rawText = (post.caption + ' ' + post.altText);
    const textToSearch = rawText.normalize('NFKC').toLowerCase();
    
    console.log(`\n[DEBUG] Evaluating Post: "${textToSearch.substring(0, 100)}..."`);
    
    // Check if post contains ANY relevant class-related keyword
    if (!allKeywords.some(keyword => textToSearch.includes(keyword))) {
      console.log(`-> Missed. No keywords matched.`);
      continue; 
    }
    
    let status = 'No Announcement';
    
    // Check which specific type of announcement it is
    if (asyncKeywords.some(keyword => textToSearch.includes(keyword))) {
      status = 'Asynchronous';
    } else if (syncKeywords.some(keyword => textToSearch.includes(keyword))) {
      status = 'Synchronous';
    }
    
    return {
      text: post.caption,
      status: status,
      timestamp: post.timestamp
    };
  }
  
  // Default if no relevant posts found
  return {
    text: "No recent class announcements found.",
    status: "No Announcement",
    timestamp: new Date().toISOString()
  };
}

async function saveToFirebase(pageId, latestAnnouncement) {
  // Save directly into the tracked_pages node for a super fast mobile UI
  await db.ref(`tracked_pages/${pageId}`).update({
    latestStatus: latestAnnouncement.status,
    recentPostText: latestAnnouncement.text,
    lastUpdated: latestAnnouncement.timestamp
  });
  console.log(`Successfully updated ${pageId} agenda in Firebase!`);
}

// --- Main Execution ---

async function runScraper() {
  console.log('--- STARTING SCRAPE CYCLE ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    const pagesSnapshot = await db.ref('tracked_pages').once('value');
    const trackedPages = pagesSnapshot.val();

    if (!trackedPages) {
      console.log('No pages tracked. Waiting for next cycle.');
      await browser.close();
      return;
    }

    for (const [pageId, pageData] of Object.entries(trackedPages)) {
      if (!pageData.url) continue;
      
      const posts = await scrapePagePosts(page, pageData.url);
      const finalData = await processPosts(posts);
      await saveToFirebase(pageId, finalData);
    }
  } catch (error) {
    console.error('Error in scraper:', error);
  } finally {
    console.log('--- SCRAPE CYCLE FINISHED ---');
    await browser.close();
  }
}

// Auto-run loop for Hackathon Demo!
async function startDaemon() {
  console.log("🚀 Starting PasokCheck Scraper Daemon...");
  while (true) {
    await runScraper();
    console.log("⏳ Waiting 2 minutes before next scrape...");
    await new Promise(resolve => setTimeout(resolve, 120000)); // Wait 2 mins
  }
}

startDaemon();
