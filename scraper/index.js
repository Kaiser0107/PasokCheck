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


// Philippine public holidays (MM-DD format)
// Regular Holidays + Special Non-Working Days (2025-2026)
const PH_HOLIDAYS = {
  // 2025 Regular Holidays
  '01-01': "New Year's Day",
  '04-09': 'Araw ng Kagitingan (Day of Valor)',
  '04-17': 'Maundy Thursday',
  '04-18': 'Good Friday',
  '05-01': 'Labor Day',
  '06-12': 'Independence Day',
  '08-25': 'National Heroes Day',
  '11-30': 'Bonifacio Day',
  '12-25': 'Christmas Day',
  '12-30': 'Rizal Day',
  // 2025 Special Non-Working Days
  '02-25': 'EDSA People Power Revolution Anniversary',
  '04-19': 'Black Saturday',
  '08-21': 'Ninoy Aquino Day',
  '11-01': "All Saints' Day",
  '11-02': "All Souls' Day",
  '12-08': 'Feast of the Immaculate Conception',
  '12-24': 'Christmas Eve',
  '12-31': "New Year's Eve",
  // 2026 Regular Holidays
  '03-28': 'Eid al-Fitr (2026)',
  '06-04': 'Eid al-Adha (2026)',
};

/**
 * Check if a given date (or today) is a Philippine holiday.
 * Returns { isHoliday: bool, name: string|null }
 */
function checkHoliday(date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const key = `${mm}-${dd}`;
  const name = PH_HOLIDAYS[key] || null;
  return { isHoliday: !!name, name };
}

// Process raw post data to determine status
function evaluatePostStatus(text) {
  const asyncKeywords = [
    'walang pasok', 'walangpasok', 'suspended', 'suspension', 'asynchronous', 'asynch',
    'modular', 'distance learning', 'cancelled', 'no face-to-face',
    'no face to face', 'no f2f', '#walangpasok'
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

  // --- Holiday Check: skip Apify entirely, mark all pages as Holiday ---
  const today = checkHoliday();
  if (today.isHoliday) {
    console.log(`[holiday] Today is "${today.name}" — marking all pages as Holiday, skipping Apify.`);
    const snapshot = await db.ref('tracked_pages').once('value');
    const trackedPages = snapshot.val();
    if (!trackedPages) { console.log('No pages tracked. Exiting.'); return; }
    const updates = {};
    for (const key of Object.keys(trackedPages)) {
      updates[`tracked_pages/${key}/latestStatus`] = 'Holiday';
      updates[`tracked_pages/${key}/holidayName`] = today.name;
      updates[`tracked_pages/${key}/lastUpdated`] = new Date().toISOString();
    }
    await db.ref('/').update(updates);
    console.log(`[holiday] Marked ${Object.keys(trackedPages).length} pages as Holiday.`);
    return;
  }

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
    const postsByUrl = {};
    deepPosts.forEach(post => {
      const pageUrl = post.facebookUrl || post.inputUrl;
      if (!postsByUrl[pageUrl]) postsByUrl[pageUrl] = [];
      postsByUrl[pageUrl].push(post);
    });

    for (const page of pagesArray.filter(p => !p.hasDoneInitialFetch)) {
      const pagePosts = postsByUrl[page.url] || [];

      // Only save posts that are actual suspension announcements
      const newHistory = pagePosts
        .map(post => ({
          postId: post.id || post.url,
          timestamp: post.time || new Date().toISOString(),
          text: post.text || "",
          status: evaluatePostStatus(post.text || "")
        }))
        .filter(entry => entry.status === 'Asynchronous' || entry.status === 'Synchronous');

      newHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // latestStatus: most recent suspension, or 'No Announcement' if none
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
      console.log(`Completed Deep Fetch for ${page.id}. Saved ${newHistory.length} relevant posts (of ${pagePosts.length} scraped).`);
    }
  }

  // 3. Perform Delta Fetch for existing pages (Top 1 post)
  if (needsDeltaFetchUrls.length > 0) {
    const deltaPosts = await runApifyScraper(needsDeltaFetchUrls, 1);
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
        const status = evaluatePostStatus(post.text || "");

        // Skip posts that are not related to class suspensions
        if (status === 'No Announcement') {
          console.log(`[skip] ${page.id}: post "${(post.text||'').slice(0,60)}" is not an announcement — not saved.`);
          continue;
        }

        const exists = updatedHistory.some(h => h.postId === postId);
        if (!exists) {
          const entry = {
            postId,
            timestamp: post.time || new Date().toISOString(),
            text: post.text || "",
            status,
          };
          updatedHistory.unshift(entry);
          addedCount++;
        }
      }

      updatedHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Compute latestStatus: latest relevant post, or 'No Announcement' if history is empty
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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`dYs? PasokCheck Backend API running on port ${PORT}`);
  console.log(`Waiting for mobile app to trigger a refresh...`);
});
