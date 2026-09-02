# PasokCheck: Tech Stack & Architecture

> Last updated: 2026-09-02

This document outlines the finalized technologies used to build **PasokCheck**, a real-time class suspension tracking platform with a Neo-Brutalism UI.

---

## Frontend (Mobile App)

| Technology | Role |
|---|---|
| **React Native** | Cross-platform native mobile app (iOS & Android) |
| **Expo SDK 57** | Dev tooling, Expo Go testing, build pipeline |
| **Expo Router** | File-based navigation (`src/app/`) |
| **NativeWind v4 (Tailwind CSS)** | Utility-class styling inside React Native |
| **expo-image** | Optimized image loading with memory-disk caching |
| **lucide-react-native** | Structural/navigation icons (ArrowLeft, RefreshCw, etc.) |
| **@fortawesome/react-native-fontawesome** | Verdict & status icons (replaces emoji for crisp vector rendering) |
| **Firebase Client SDK v12** | Real-time listener (`onValue`) for live suspension updates |

---

## Backend (Data Collection)

| Technology | Role |
|---|---|
| **Node.js & Express v5** | Local API server — mobile app triggers `/api/refresh` |
| **Apify SDK (`apify-client`)** | Cloud-based Facebook scraper — bypasses login walls, anti-bot systems, and IP blocks |
| **Firebase Admin SDK** | Writes structured post history and status to Realtime Database using Service Account |

---

## Database & Cloud

| Technology | Role |
|---|---|
| **Firebase Realtime Database** | Cloud-hosted NoSQL JSON tree — single source of truth for all page statuses and post history |
| **GitHub Actions** *(Planned)* | Scheduled cron job to run the Node.js scraper autonomously |

---

## Design System

- **Style:** Neo-Brutalism — thick black borders, `#FFE600` yellow accent, hard box shadows (`5px 5px 0px #000`), high contrast
- **Color Tokens:**
  - Background: `#F8F6F1` (off-white)
  - Accent: `#FFE600` (yellow)
  - Dark: `#000` / `#18181b`
  - Suspended (Async): Emerald green chips
  - Suspended (Sync): Amber chips
  - Holiday: Violet chips
  - Regular class: Zinc chips

