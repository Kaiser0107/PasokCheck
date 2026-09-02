# Architecture: Scraping Facebook for Public Announcements

> Last updated: 2026-09-02 — Updated to reflect Apify-based implementation and new filtering logic.

Building a Facebook scraper to track public posts (LGU, mayor, school announcements) faces significant technical walls. Facebook actively and aggressively blocks automated data extraction.

---

## 1. Facebook's Anti-Scraping Mechanisms

Facebook employs sophisticated, enterprise-grade anti-bot systems:

- **The Login Wall:** Facebook forces unauthenticated users to log in before viewing public pages. A scraper hitting a URL without active session cookies receives a login prompt instead of post content.
- **Dynamic DOM Obfuscation:** Facebook's web structure is built with React. CSS class names are randomly generated (e.g. `<div class="x1y2z3">`) and change frequently — making traditional HTML parsers like Cheerio extremely fragile.
- **IP Rate Limiting & CAPTCHAs:** Scraping multiple pages rapidly triggers automated blocks. If an IP behaves like a bot (high request volume, no mouse movement, no browser fingerprints), Facebook will serve a CAPTCHA or ban the IP.
- **Shadow Banning:** Sometimes Facebook returns HTTP 200 but with intentionally empty or stale content to trick the scraper.

---

## 2. Why Client-Side (React Native/Expo) Scraping Fails

Building the scraper directly into the Expo app means every user's phone independently pings Facebook:

- **User IP Bans:** The user's personal IP could get temporarily blocked from Facebook entirely.
- **Battery & Data Drain:** Background network polling is rejected by iOS/Android app stores for excessive background activity.
- **CORS Issues (Web):** Fetching raw Facebook HTML from a web environment is blocked by CORS policies.

---

## 3. Actual Architecture: Apify Cloud Scraper

> **Note:** The original plan used Playwright + GitHub Actions. After testing, Playwright was unable to reliably bypass Facebook's login wall. The implementation switched to **Apify**, which solves this problem at the cloud level.

### How It Works

```
[Mobile App]
    ↓  POST /api/refresh
[Node.js Express Server (local)]
    ↓  client.actor("apify/facebook-posts-scraper").call(...)
[Apify Cloud]  ← handles proxies, fingerprints, login bypass
    ↓  returns scraped post items
[Node.js]  ← evaluates keyword status, filters to Async/Sync only
    ↓  db.ref('tracked_pages').update(...)
[Firebase Realtime Database]
    ↓  onValue() real-time listener
[Mobile App UI]  ← updates instantly
```

### Delta-Fetch Architecture (Cost Optimization)

| Fetch Type | When | Posts Fetched | Firebase Action |
|---|---|---|---|
| **Deep Fetch** | First time a page is added | Last 5 posts | Seeds history with relevant announcements |
| **Delta Fetch** | Every subsequent refresh | Latest 1 post | Checks if the newest post is new and relevant; adds to history if so |

### History Filter Logic

Only posts classified as `Asynchronous` or `Synchronous` are written to Firebase history:

```js
// Deep Fetch
const newHistory = pagePosts
  .map(post => ({ ...post, status: evaluatePostStatus(post.text) }))
  .filter(entry => entry.status === 'Asynchronous' || entry.status === 'Synchronous');

// Delta Fetch
if (status === 'No Announcement') {
  console.log(`[skip] Not an announcement — discarded.`);
  continue; // do not write to history
}
```

`latestStatus` on the page record reflects the true current state (including `'No Announcement'` when no suspension was found). History only contains meaningful, actionable entries.

---

## 4. Holiday Auto-Detection

A `PH_HOLIDAYS` map (keyed `MM-DD`) is checked at the top of `performDeltaFetch()`:

```js
const today = checkHoliday();
if (today.isHoliday) {
  // mark all pages as 'Holiday', skip Apify entirely
  return;
}
```

**Why:** No school or LGU posts a class suspension on a public holiday. Running Apify on these days wastes API credits and returns irrelevant results.

---

## 5. Keyword Classification

```js
function evaluatePostStatus(text) {
  // Returns 'Asynchronous', 'Synchronous', or 'No Announcement'
  const asyncKeywords = ['walang pasok', 'suspended', 'asynchronous', ...];
  const syncKeywords  = ['synchronous', 'online class', 'f2f', ...];
  const normalized    = text.normalize('NFKC').toLowerCase();
  // checks asyncKeywords first, then syncKeywords
}
```

**Status meanings:**
| Status | Meaning | UI Color |
|---|---|---|
| `Asynchronous` | No face-to-face class, do async tasks | Emerald green |
| `Synchronous` | Online class (remote but live) | Amber |
| `Holiday` | Philippine public holiday | Violet |
| `No Announcement` | Latest post is not about class | Zinc/gray |
| `Scanning...` | Page just added, not yet fetched | Light gray |

---

## 6. OCR (Not Implemented)

Many LGUs post suspension announcements as images or infographics. This was planned but not implemented in the hackathon version:

- **Server-side (recommended):** Google Cloud Vision API (1,000 free requests/month) or Tesseract CLI on GitHub Actions runner.
- **Client-side (not recommended):** Tesseract.js is resource-intensive and increases bundle size significantly.

> Current approach: The Apify scraper extracts the `text` field from Facebook posts. Most suspension posts include text alongside any images, so keyword matching still works in the majority of cases.
