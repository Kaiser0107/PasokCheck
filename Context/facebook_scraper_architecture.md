# Architecture and Challenges of Scraping Facebook for Public Announcements

Building a Facebook scraper directly into a mobile app (React Native/Expo) to track public posts (like Mayor, LGU, or School announcements) faces significant technical walls. Facebook actively and aggressively blocks automated data extraction. 

Here is a deep dive into the challenges you will face and how to architect a zero-budget alternative that actually works.

---

## 1. Facebook’s Anti-Scraping Mechanisms

Facebook employs sophisticated, enterprise-grade anti-bot systems. If you attempt to scrape their platform, you will encounter the following roadblocks:

*   **The Login Wall:** Facebook increasingly forces unauthenticated users to log in before viewing public pages. A scraper hitting a URL without active session cookies will likely receive a login prompt or a redirect instead of the actual posts.
*   **Dynamic DOM Obfuscation:** Facebook’s web structure is built with React. CSS class names are randomly generated (e.g., `<div class="x1y2z3">`) and change frequently. This makes traditional HTML parsing tools like Cheerio or BeautifulSoup extremely fragile, as your selectors will break constantly.
*   **IP Rate Limiting & CAPTCHAs:** Scraping multiple pages rapidly will trigger automated blocks. If an IP address behaves like a bot (high request volume, no mouse movement, no browser fingerprints), Facebook will serve a CAPTCHA or temporarily/permanently ban the IP.
*   **Shadow Banning:** Sometimes Facebook will return a successful HTTP 200 response, but the content will be intentionally empty or stale to trick the scraper.

---

## 2. Why Client-Side (React Native/Expo) Scraping is a Bad Idea

If you build the scraper directly into your Expo app, every user's phone will independently ping Facebook. This is highly problematic:

*   **CORS (Cross-Origin Resource Sharing) Restrictions:** Network requests (`fetch` or `axios`) from a mobile app environment to Facebook's web endpoints may be blocked. While mobile apps don't strictly enforce CORS like web browsers do, attempting to fetch raw HTML from Facebook often results in blocked requests or requires complex WebView workarounds.
*   **User IP Bans:** If your app scrapes Facebook in the background, your users' personal IP addresses or mobile data IPs could get temporarily blocked from accessing Facebook entirely.
*   **Battery & Data Drain:** Running background tasks on iOS or Android to constantly poll URLs will drain the user's battery and eat up their mobile data allowance. App stores (especially Apple) may reject your app for excessive background network activity.

---

## 3. Recommended Zero-Budget Architecture

Instead of scraping from the phone, decouple the scraper and use free-tier cloud services to centralize the work. This ensures Facebook is only scraped once per interval, not once per user.

### Step 1: The Backend Scraper (GitHub Actions + Node.js/Python)
Set up a free private GitHub repository. You can write a Node.js script using **Playwright** or **Puppeteer** (or Python with Selenium/Playwright) to run on a schedule using GitHub Actions (e.g., a cron job that runs every 15-30 minutes). 
*   **Why Playwright?** It runs a real headless browser, which is better at bypassing simple bot detections and waiting for dynamic React content to load.
*   **The Task:** This script navigates to the target Facebook pages, extracts the latest text and image URLs, and formats the data into JSON.

### Step 2: The Database (Firebase or Supabase Free Tier)
Have your GitHub Action script push the scraped data to a free **Supabase** (PostgreSQL) or **Firebase Realtime Database / Firestore**. 
*   Both services have generous free tiers that will easily accommodate a small to medium user base reading text data.

### Step 3: The Mobile App (React Native / Expo)
Your React Native app simply connects to your Firebase/Supabase database using their official SDKs. 
*   When new suspension data is detected by the scraper and pushed to the database, the app syncs it and displays it to the user.
*   **Result:** The app is fast, uses minimal data, bypasses Facebook's network restrictions entirely, and saves user battery.

---

## 4. Handling Image Announcements (OCR)

Many LGUs or schools announce class suspensions via images or infographics rather than plain text. You will need Optical Character Recognition (OCR) to read this.

### Server-Side OCR (Recommended)
Perform the OCR in your GitHub Actions scraper before sending data to the database.
*   **Google Cloud Vision API:** Has a generous free tier of 1,000 requests per month. Pass the scraped image URL to the API to extract the text, search the text for keywords (e.g., "suspended", "walang pasok", "all levels"), and save the status to your database.
*   **Free Alternative (Tesseract CLI):** You can install Tesseract OCR on the GitHub Actions runner (Ubuntu) and process the images entirely for free during the scraping job.

### Client-Side OCR (Not Recommended, but Free)
If you absolutely must process images on the device to save server operations:
*   Use **Tesseract.js** or a native React Native OCR library. 
*   **Downsides:** Running OCR locally on a mobile device is resource-intensive. It will make your app sluggish during processing, drain battery, and significantly increase your app's bundle size (due to language training data files).
