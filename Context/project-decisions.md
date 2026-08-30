# Project Decisions

**Date:** 2026-08-29
**App:** Suspension Tracker

## Finalized Tech Stack
Based on the feasibility study and architecture recommendations, the following tech stack has been selected:

1. **Frontend:** React Native with Expo. This acts purely as a client to read the suspension feed and notify the user.
2. **Backend/Scraper:** Node.js + Express API with Apify Client, using the `apify/facebook-posts-scraper` actor to collect Facebook posts.
3. **Execution Environment:** GitHub Actions cron job (`*/30 * * * *`) plus manual refresh trigger via backend API.
4. **Database:** Firebase Realtime Database for tracked pages, post history, and latest status sync.
5. **OCR:** Not active in the current pipeline (Tesseract.js exists as a dependency for future OCR integration).

These decisions ensure the app avoids Facebook's IP bans, consumes minimal battery/data on mobile, and operates on a zero-budget scalable architecture.
