# Project Decisions Log

> Last updated: 2026-09-02

---

## Finalized Tech Stack (Updated from original plan)

| Layer | Original Plan | Final Decision | Reason for Change |
|---|---|---|---|
| Frontend | React Native + Expo | ✅ Same | No change |
| Scraper | Node.js + Playwright | **Apify SDK** | Playwright fails against Facebook's login wall and dynamic DOM; Apify handles proxies + browser fingerprints in the cloud |
| Execution | GitHub Actions cron | ✅ Same (planned) | Still planned for production; currently triggered manually via `/api/refresh` |
| Database | Firebase Realtime DB | ✅ Same | No change |
| OCR | Baidu Unlimited-OCR | **Removed** | Not implemented — Apify extracts post text directly; most suspension posts are text-based |
| Push Notifications | Expo Push Notifications | **Removed** | `expo-notifications` is not supported in Expo Go on Android (SDK 53+). Removed to keep app working in Expo Go for the hackathon. |

---

## Key Architecture Decisions

### 1. History Log Filter (2026-09-02)
**Decision:** Only `Asynchronous` and `Synchronous` posts are saved to the Firebase history array.
**Reason:** Facebook pages post frequently (events, birthdays, general announcements). Saving all posts pollutes the history log with irrelevant data. Judges and users only care about class suspension announcements.
**Impact:** History array stays clean. `latestStatus` is still computed from the most recent relevant post.

### 2. Philippine Holiday Auto-Detection (2026-09-02)
**Decision:** Added a `PH_HOLIDAYS` map in `scraper/index.js`. On a holiday, all pages are marked `'Holiday'` and the Apify run is skipped.
**Reason:** No school posts class suspension announcements on a holiday — running Apify would waste API credits and return irrelevant results.
**Impact:** Saves Apify credits. Mobile app shows a violet "HOLIDAY" chip automatically.

### 3. Font Awesome over Emoji (2026-09-02)
**Decision:** Installed `@fortawesome/react-native-fontawesome` to replace emoji in the verdict card corner badge.
**Reason:** Emoji rendering is inconsistent across Android versions and web. Font Awesome provides crisp, scalable SVG icons that work uniformly on all platforms.
**Impact:** Verdict icons (file, magnifier, graduation cap, party horn, cloud, umbrella) now render as clean vector graphics.

### 4. LGU → School Inheritance Model (earlier)
**Decision:** Schools can be assigned a `parentId` pointing to an LGU page. If the LGU's `latestStatus` is `Asynchronous` or `Synchronous`, all child schools inherit that status automatically in the UI.
**Reason:** LGUs announce suspensions for all schools under them. This avoids needing a separate tracked page per school.

### 5. Neo-Brutalism Design System (earlier)
**Decision:** Chose a bold Neo-Brutalism design with `#FFE600` yellow, thick black borders, and hard shadows.
**Reason:** Differentiates PasokCheck visually in a hackathon context. Memorable, opinionated, and consistent with the app's "blunt, direct information" purpose.
