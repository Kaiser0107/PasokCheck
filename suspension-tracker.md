# Suspension Tracker App Plan

## Architecture Overview
- **Mobile Frontend:** React Native / Expo
- **Backend / Scraper:** Node.js + Express + Apify (`apify/facebook-posts-scraper`)
- **Database:** Firebase Realtime Database
- **OCR Engine:** Not active yet (Tesseract.js dependency available for future integration)

## Task Breakdown

### Phase 1: Project Setup & Infrastructure
- [ ] Initialize Expo React Native project for the mobile app
- [ ] Set up a Firebase project and configure the React Native app
- [ ] Initialize Node.js backend directory for the scraper
- [ ] Configure GitHub Actions workflow for the scraper cron job

### Phase 2: Scraper & OCR Integration
- [ ] Integrate Apify actor-based scraping into scheduled and manual refresh flows
- [ ] Integrate Tesseract.js OCR for extracting text from scraped image announcements
- [ ] Implement parsing logic to detect suspension keywords (e.g., "suspended", "walang pasok, asynchronous")
- [ ] Set up Firebase Admin SDK in the Node.js scraper to push structured data to the database

### Phase 3: Mobile App Development
- [ ] Design and implement the UI/UX for the suspension feed
- [ ] Integrate Firebase Client SDK in the app to fetch and listen for updates
- [ ] The user will input the facebook's Government Official, University, School user's url.
- [ ] Implement push notifications (via Expo Push Notifications) for new announcements

### Phase 4: Testing & Deployment
- [ ] Test the GitHub Actions cron job end-to-end
- [ ] Verify OCR accuracy with real sample infographics and images
- [ ] Test mobile app rendering and data fetching on iOS and Android simulators
- [ ] Finalize deployment pipelines (GitHub Actions to Firebase / App Stores)

## Agent Assignments
- **project-planner:** Created this initial architecture and breakdown.
- **frontend-developer:** Handle Phase 1 (Expo setup) and Phase 3 (App UI/UX).
- **backend-developer:** Handle Phase 2 (Apify + OCR + Firebase integration) and Phase 4 backend testing.

## Verification Checklist (Phase X)
- [ ] Scraper successfully retrieves the latest posts without getting blocked.
- [ ] OCR accurately reads text from graphic announcements.
- [ ] Scraped data is correctly formatted, categorized, and stored in Firebase.
- [ ] Mobile app retrieves data from Firebase and updates the UI accurately.
- [ ] GitHub Actions cron job runs successfully on schedule.
