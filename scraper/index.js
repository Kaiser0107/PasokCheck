const express = require('express');
const cors = require('cors');
const { ApifyClient } = require('apify-client');
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
require('dotenv').config();

// Use global fetch (Node 18+) or fallback to node-fetch
const fetchFn = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

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

// --- Expo Push Helpers ---
async function getExpoPushTokens() {
  const snap = await db.ref('expo_push_tokens').once('value');
  const val = snap.val();
  if (!val) return [];
  return Object.values(val).map(v => v.token || v).filter(t => typeof t === 'string' && t.startsWith('ExponentPushToken'));
}

async function sendExpoPushMessages(messages) {
  if (!messages.length) return;
  // Expo allows max 100 per request
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i+100));
  for (const chunk of chunks) {
    try {
      const res = await fetchFn('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      const data = await res.json();
      console.log('[push] Expo response', JSON.stringify(data).slice(0, 500));
      // Log errors for invalid tokens (could clean up)
      if (data.errors) console.error('[push] errors', data.errors);
    } catch (e) {
      console.error('[push] failed to send chunk', e.message);
    }
  }
}

async function notifyNewPosts(pageId, newPosts) {
  if (!newPosts.length) return;
  const tokens = await getExpoPushTokens();
  if (!tokens.length) {
    console.log(`[push] No expo tokens — skipping push for ${pageId}`);
    return;
  }
  const latest = newPosts[0];
  const snippet = (latest.text || '').slice(0, 120).replace(/\s+/g, ' ').trim() || 'New post on Facebook';
  const titleMap = {
    'Asynchronous': `No class — ${pageId}`,
    'Synchronous': `Online class — ${pageId}`,
    'No Announcement': `Update from ${pageId}`,
  };
  const title = titleMap[latest.status] || `New post from ${pageId}`;
  const body = snippet.length > 80 ? snippet.slice(0, 80) + '…' : snippet;

  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: { pageId, postId: latest.postId, status: latest.status, url: latest.postUrl || `https://facebook.com/${pageId}` },
    channelId: 'default',
    priority: 'high',
  }));
  console.log(`[push] Sending ${messages.length} pushes for ${pageId} — "${title}"`);
  await sendExpoPushMessages(messages);
}

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
    history: trackedPages[key].history || [],
    pfp: trackedPages[key].pfp || null,
    pageName: trackedPages[key].pageName || null,
  }));

  function extractPfp(post, pageId) {
    return post?.user?.profilePic || post?.user?.profile_pic || post?.profilePic || post?.authorProfilePicture || post?.pageProfilePicture || `https://graph.facebook.com/${encodeURIComponent(pageId)}/picture?type=large&width=200&height=200`;
  }
  function extractPageName(post) {
    return post?.user?.name || post?.pageName || post?.authorName || null;
  }

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

      newHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      const latestStatus = newHistory.length > 0 ? newHistory[0].status : 'No Announcement';
      const pfp = pagePosts.length ? extractPfp(pagePosts[0], page.id) : `https://graph.facebook.com/${encodeURIComponent(page.id)}/picture?type=large&width=200&height=200`;
      const pageName = pagePosts.length ? extractPageName(pagePosts[0]) : null;

      await db.ref(`tracked_pages/${page.id}`).update({
        history: newHistory,
        hasDoneInitialFetch: true,
        latestStatus,
        lastUpdated: new Date().toISOString(),
        pfp,
        ...(pageName ? { pageName } : {}),
      });
      console.log(`Completed Deep Fetch for ${page.id}. Found ${newHistory.length} posts. pfp=${pfp?.slice(0,60)}`);
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
      let newlyAdded = [];
      let addedCount = 0;

      for (const post of pagePosts) {
        const postId = post.id || post.url;
        const exists = updatedHistory.some(h => h.postId === postId);
        
        if (!exists) {
          const entry = {
            postId: postId,
            timestamp: post.time || new Date().toISOString(),
            text: post.text || "",
            status: evaluatePostStatus(post.text || "")
          };
          updatedHistory.unshift(entry);
          newlyAdded.push(entry);
          addedCount++;
        }
      }

      updatedHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      const latestStatus = updatedHistory.length > 0 ? updatedHistory[0].status : 'No Announcement';
      // pfp backfill / update
      let pfpUpdate = {};
      if (pagePosts.length) {
        const fetchedPfp = extractPfp(pagePosts[0], page.id);
        const fetchedName = extractPageName(pagePosts[0]);
        if (fetchedPfp && !page.pfp) pfpUpdate.pfp = fetchedPfp;
        else if (fetchedPfp && page.pfp && page.pfp.includes('graph.facebook.com') && !fetchedPfp.includes('graph.facebook.com')) {
          // prefer real scontent CDN over graph redirect
          pfpUpdate.pfp = fetchedPfp;
        }
        if (fetchedName && !page.pageName) pfpUpdate.pageName = fetchedName;
      } else if (!page.pfp) {
        pfpUpdate.pfp = `https://graph.facebook.com/${encodeURIComponent(page.id)}/picture?type=large&width=200&height=200`;
      }

      if (addedCount > 0) {
        await db.ref(`tracked_pages/${page.id}`).update({
          history: updatedHistory,
          latestStatus,
          lastUpdated: new Date().toISOString(),
          ...pfpUpdate,
        });
        console.log(`Completed Delta Fetch for ${page.id}. Added ${addedCount} NEW posts.`);
        notifyNewPosts(page.id, newlyAdded).catch(e => console.error('[push] notify failed', e));
      } else {
        if (Object.keys(pfpUpdate).length) {
          await db.ref(`tracked_pages/${page.id}`).update(pfpUpdate);
          console.log(`Updated pfp for ${page.id}: ${pfpUpdate.pfp?.slice(0,60)}`);
        }
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

// Debug: list push tokens
app.get('/api/push/tokens', async (req, res) => {
  try {
    const tokens = await getExpoPushTokens();
    res.json({ count: tokens.length, tokens: tokens.map(t => t.slice(0, 20) + '…') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Test push: POST { title?, body?, pageId? } — sends to all registered tokens
app.post('/api/push/test', async (req, res) => {
  try {
    const tokens = await getExpoPushTokens();
    if (!tokens.length) return res.status(400).json({ error: 'No tokens registered yet. Enable push on device first.' });
    const { title = 'Test — PasokCheck', body = 'This is a test push for new announcements 🔔', pageId = 'test' } = req.body || {};
    const messages = tokens.map(to => ({
      to, sound: 'default', title, body,
      data: { pageId, test: true },
      channelId: 'default',
    }));
    await sendExpoPushMessages(messages);
    res.json({ success: true, sent: messages.length });
  } catch (e) {
    console.error('[push/test] error', e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`dYs? PasokCheck Backend API running on port ${PORT}`);
  console.log(`Waiting for mobile app to trigger a refresh...`);
});
