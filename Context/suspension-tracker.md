# PasokCheck — Project Status & Task Tracker

> Last updated: 2026-09-02

---

## Architecture Overview

- **Mobile Frontend:** React Native / Expo (Expo Go + Web supported)
- **Backend / Scraper:** Node.js Express API with Apify cloud scraping
- **Database:** Firebase Realtime Database
- **Icons:** Font Awesome (via `@fortawesome/react-native-fontawesome`) + Lucide React Native
- **Push Notifications:** Removed — not supported on Expo Go (SDK 53+). Planned for future dev build.

---

## Completed Work

### Phase 1: Project Setup & Infrastructure
- [x] Initialize Expo React Native project (`mobile/`)
- [x] Set up Firebase Realtime Database and connect React Native app
- [x] Initialize Node.js backend (`scraper/`)
- [ ] Configure GitHub Actions workflow for scraper cron job *(planned)*

### Phase 2: Scraper & Backend Integration
- [x] Express.js `/api/refresh` endpoint triggers Apify scraper on demand
- [x] Apify cloud scraper (`apify/facebook-posts-scraper`) bypasses Facebook anti-bot walls
- [x] Delta-Fetching architecture: Deep Fetch (5 posts) on first add, Delta Fetch (1 post) on refresh
- [x] Keyword parser detects `Asynchronous` / `Synchronous` suspension status
- [x] Firebase Admin SDK pushes structured data (history, latestStatus, pfp, pageName) to database
- [x] **History log filter:** Only `Asynchronous` and `Synchronous` posts are saved to history — irrelevant posts (events, birthdays) are discarded
- [x] **Philippine Holiday support:** On recognized PH holidays, all pages are marked `'Holiday'` and Apify is skipped entirely (saves API credits)

### Phase 3: Mobile App Development
- [x] Neo-Brutalism UI design — black header, yellow accent, hard shadows, thick borders
- [x] Real-time Firebase listener (`onValue`) — UI updates instantly without manual refresh
- [x] Track any public Facebook page (school, LGU, mayor) by pasting URL
- [x] LGU → School parent-child relationship with suspension inheritance
- [x] Per-page detail screen with announcement history log
- [x] Pull-to-refresh triggers backend scraper
- [x] Font Awesome vector icons (replaced emoji in verdict card)
- [x] Holiday status rendered with violet chip and umbrella icon
- [x] Push notifications removed (expo-notifications uninstalled, `app.json` cleaned)

### Phase 4: Testing & Deployment
- [ ] Test GitHub Actions cron job end-to-end
- [ ] Test mobile app on physical Android device (Expo Go)
- [ ] Finalize deployment pipelines

---

## Known Decisions & Constraints

| Decision | Reason |
|---|---|
| Apify over Playwright/Puppeteer | Facebook's login wall and dynamic DOM make local scraping unreliable; Apify handles proxies + browser fingerprints in the cloud |
| Expo Go only (no dev build) | Hackathon constraint — no time to set up EAS build pipeline |
| No push notifications | `expo-notifications` removed; not supported in Expo Go on Android SDK 53+ |
| History filter (Async/Sync only) | Prevents irrelevant posts from polluting the timeline and misleading users |
| Holiday auto-detection | Saves Apify API credits and gives users immediate correct context |

