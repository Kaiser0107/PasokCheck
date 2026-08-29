# PasokCheck: Tech Stack & Architecture

This document outlines the core technologies used to build PasokCheck, a dynamic suspension tracking platform.

## Frontend (Mobile App)
* **React Native**: A framework that allows us to build native mobile apps for both iOS and Android using JavaScript and React.
* **Expo**: A set of tools and services built around React Native that makes developing, building, and testing mobile apps significantly easier (e.g., Expo Go).
* **NativeWind (Tailwind CSS)**: A styling engine that lets us use Tailwind CSS utility classes directly inside React Native. It allows for rapid UI development without writing custom stylesheets.

## Backend (Data Collection)
* **Node.js**: A JavaScript runtime that allows us to execute backend scripts (like our scraper) outside of a web browser.
* **Playwright**: A powerful browser automation library. We use it to launch a "headless" (invisible) browser to navigate to Facebook pages and scrape HTML elements just like a real human would, bypassing basic bot protections.
* **Tesseract.js**: A pure JavaScript port of the popular Tesseract Optical Character Recognition (OCR) engine. We use it to "read" the text inside suspension infographics locally without needing expensive cloud APIs or heavy Python models.

## Database & Cloud
* **Firebase Realtime Database**: A cloud-hosted NoSQL database. Data is stored as one large JSON tree and synchronized in real-time to every connected client.
  * **Firebase Admin SDK**: Used by our Node.js scraper to bypass security rules and write data securely using a Service Account Key.
  * **Firebase Client SDK**: Used by our React Native app to listen to database changes (`onValue`) so the UI updates instantly without the user needing to refresh.
* **GitHub Actions** *(Planned)*: A CI/CD platform that we will use to run our Node.js scraper on a schedule (cron job) completely autonomously.

