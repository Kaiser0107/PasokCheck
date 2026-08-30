# PasokCheck: Tech Stack & Architecture

This document outlines the technologies currently used in PasokCheck.

## Frontend (Mobile App)
* **React Native + React 19**: Cross-platform mobile UI framework.
* **Expo + Expo Router**: App runtime, tooling, and file-based routing.
* **NativeWind (Tailwind CSS)**: Utility-first styling for React Native components.
* **Firebase Client SDK**: Realtime reads/listeners for tracked page status updates.

## Backend (Data Collection API)
* **Node.js**: Runtime for the backend service and scraper orchestration.
* **Express**: API server (`/api/refresh`) used to trigger scraping.
* **Apify Client**: Integrates with `apify/facebook-posts-scraper` actor for Facebook post collection.
* **firebase-admin**: Writes tracked page history and latest status to Firebase.

## Database & Automation
* **Firebase Realtime Database**: Primary datastore for tracked pages and announcement history.
* **GitHub Actions**: Scheduled workflow (`.github/workflows/scraper.yml`) that runs the scraper every 30 minutes.

## OCR Status
* **Tesseract.js** is present as a dependency, but OCR is not yet wired into the current scraping flow.
