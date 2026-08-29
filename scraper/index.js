const express = require('express');
const cors = require('cors');
const { ApifyClient } = require('apify-client');
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

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Apify client (Requires APIFY_TOKEN in .env)
const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

// Process raw post data to determine status
function evaluatePostStatus(text) {
  const asyncKeywords = [
    'walang pasok', 'walangpasok', 'suspended', 'suspension', 'asynchronous', 'asynch', 
    'modular', 'distance learning',  'cancelled', 'no face-to-face',
    'no face to face', 'no f2f', "#WALANGPASOK"
  ];
  
  const syncKeywords = [
    'synchronous', 'online class', 'online classes', 'face to face', 
    'face-to-face', 'resume', 'resumed', 'f2f'
  ];

  const normalizedText = text.normalize('NFKC').toLowerCase();

  for (const keyword of asyncKeywords) {
    if (normalizedText.includes(keyword)) return 'Asynchronous';
  }
  
  for (const keyword of syncKeywords) {
    if (normalizedText.includes(keyword)) return 'Synchronous';
  }

  return 'No Announcement';
}

// Scrape and Update logic
async function performDeltaFetch() {
  console.log("Starting Delta Fetch process...");
  
  // 1. Fetch tracked pages from Firebase
  const snapshot = await db.ref('tracked_pages').once('value');
  const trackedPages = snapshot.val();
  if (!trackedPages) {
    console.log('No pages tracked. Exiting.');
    return;
  }

  const pagesArray = Object.keys(trackedPages).map(key => ({
    id: key,
    url: trackedPages[key].url,
    hasDoneInitialFetch: trackedPages[key].hasDoneInitialFetch || false,
    history: trackedPages[key].history || []
  }));

  // We group them by "Needs Initial Fetch" vs "Delta Fetch"
  const needsDeepFetchUrls = pagesArray.filter(p => !p.hasDoneInitialFetch).map(p => ({ url: p.url }));
  const needsDeltaFetchUrls = pagesArray.filter(p => p.hasDoneInitialFetch).map(p => ({ url: p.url }));

  // Helper to run Apify actor
  async function runApifyScraper(urls, limit) {
    if (urls.length === 0) return [];
    console.log(`Running Apify actor for ${urls.length} pages with resultsLimit=${limit}...`);
    
    // Using the official free Facebook posts scraper on Apify
    const run = await client.actor("apify/facebook-posts-scraper").call({
        startUrls: urls,
        resultsLimit: limit
    });
    
    console.log(`Apify run finished. Fetching dataset ${run.defaultDatasetId}...`);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items;
  }

  // 2. Perform Deep Fetch for new pages (Top 5 posts)
  if (needsDeepFetchUrls.length > 0) {
    const deepPosts = await runApifyScraper(needsDeepFetchUrls, 5);
    
    // Group posts by page URL
    const postsByUrl = {};
    deepPosts.forEach(post => {
      const pageUrl = post.facebookUrl || post.inputUrl;
      if (!postsByUrl[pageUrl]) postsByUrl[pageUrl] = [];
      postsByUrl[pageUrl].push(post);
    });

    for (const page of pagesArray.filter(p => !p.hasDoneInitialFetch)) {
      const pagePosts = postsByUrl[page.url] || [];
      const newHistory = pagePosts.map(post => ({
        postId: post.id || post.url,
        timestamp: post.time || new Date().toISOString(),
        text: post.text || "",
        status: evaluatePostStatus(post.text || "")
      }));

      // Sort newest first
      newHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      const latestStatus = newHistory.length > 0 ? newHistory[0].status : 'No Announcement';

      await db.ref(`tracked_pages/${page.id}`).update({
        history: newHistory,
        hasDoneInitialFetch: true,
        latestStatus: latestStatus,
        lastUpdated: new Date().toISOString()
      });
      console.log(`Completed Deep Fetch for ${page.id}. Found ${newHistory.length} posts.`);
    }
  }

  // 3. Perform Delta Fetch for existing pages (Top 1 posts)
  if (needsDeltaFetchUrls.length > 0) {
    const deltaPosts = await runApifyScraper(needsDeltaFetchUrls, 1);
    
    // Group posts by page URL
    const postsByUrl = {};
    deltaPosts.forEach(post => {
      const pageUrl = post.facebookUrl || post.inputUrl;
      if (!postsByUrl[pageUrl]) postsByUrl[pageUrl] = [];
      postsByUrl[pageUrl].push(post);
    });

    for (const page of pagesArray.filter(p => p.hasDoneInitialFetch)) {
      const pagePosts = postsByUrl[page.url] || [];
      let updatedHistory = [...page.history];
      let addedCount = 0;

      for (const post of pagePosts) {
        const postId = post.id || post.url;
        // Check if this post is already in our history
        const exists = updatedHistory.some(h => h.postId === postId);
        
        if (!exists) {
          updatedHistory.unshift({ // Add to beginning of array
            postId: postId,
            timestamp: post.time || new Date().toISOString(),
            text: post.text || "",
            status: evaluatePostStatus(post.text || "")
          });
          addedCount++;
        }
      }

      // Sort newest first just in case
      updatedHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      const latestStatus = updatedHistory.length > 0 ? updatedHistory[0].status : 'No Announcement';

      if (addedCount > 0) {
        await db.ref(`tracked_pages/${page.id}`).update({
          history: updatedHistory,
          latestStatus: latestStatus,
          lastUpdated: new Date().toISOString()
        });
        console.log(`Completed Delta Fetch for ${page.id}. Added ${addedCount} NEW posts.`);
      } else {
        console.log(`Completed Delta Fetch for ${page.id}. No new posts.`);
      }
    }
  }

  console.log("Delta Fetch process complete!");
}

// --- Express API Endpoints ---

app.post('/api/refresh', async (req, res) => {
  if (!process.env.APIFY_TOKEN) {
    return res.status(500).json({ error: "APIFY_TOKEN is not set in .env" });
  }

  try {
    await performDeltaFetch();
    res.json({ success: true, message: "Scraping complete." });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`dYs? PasokCheck Backend API running on port ${PORT}`);
  console.log(`Waiting for mobile app to trigger a refresh...`);
});
