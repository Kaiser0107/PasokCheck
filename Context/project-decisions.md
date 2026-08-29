# Project Decisions

**Date:** 2026-08-29
**App:** Suspension Tracker

## Finalized Tech Stack
Based on the feasibility study and architecture recommendations, the following tech stack has been selected:

1. **Frontend:** React Native with Expo. This acts purely as a client to read the suspension feed and notify the user.
2. **Backend/Scraper:** Node.js using Playwright. This will run headless browsers to parse Facebook announcements securely.
3. **Execution Environment:** GitHub Actions cron jobs (runs the scraper at regular intervals without draining mobile battery or IP limits).
4. **Database:** Firebase (Realtime Database or Firestore) to store the latest announcements. The mobile app syncs with this directly.
5. **OCR:** Baidu Unlimited-OCR integrated in the backend for reading text from image infographics (e.g., class suspension images).

These decisions ensure the app avoids Facebook's IP bans, consumes minimal battery/data on mobile, and operates on a zero-budget scalable architecture.

