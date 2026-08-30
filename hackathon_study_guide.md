# Hackathon Study Guide: Core Concepts

If you are joining a hackathon and want to build apps similar to PasokCheck, you should be comfortable with the following programming concepts. 

## 1. React & React Native (Frontend)
To build mobile and web user interfaces quickly:
* **Components & JSX**: Understanding how to break down a UI into reusable blocks (like our `renderCard` function) and writing HTML-like syntax inside JavaScript.
* **State Management (`useState`)**: How to store data that changes over time (like our `inputUrl` or the `loading` spinner) and automatically re-render the UI when it changes.
* **Side Effects (`useEffect`)**: How to run code when a component first loads on the screen (e.g., establishing the Firebase listener when the app opens).
* **List Rendering (`FlatList`)**: The correct way to render long, scrollable lists of data in mobile apps without causing performance lag.

## 2. JavaScript & Node.js (Backend)
To write scrapers, APIs, and automation scripts:
* **Asynchronous Programming (`async` / `await` / Promises)**: Hackathons heavily rely on fetching data over the internet. You must understand how to "wait" for a network request to finish (like waiting for an Apify actor run to complete or OCR processing to finish) before moving to the next line of code.
* **DOM Traversal (Web Scraping)**: Understanding how HTML is structured and how to use CSS selectors (like `div[role="article"]` or `img`) to extract specific data from a website.

## 3. Databases (Firebase NoSQL)
To store and retrieve user data:
* **NoSQL Data Structures**: Understanding how to model data as a massive JSON object (trees and nodes) rather than traditional SQL rows and columns.
* **Realtime Syncing vs HTTP Requests**: Knowing the difference between making a one-time request for data (a standard `GET` request) versus subscribing to a live socket connection (Firebase `onValue`).

## 4. Problem Solving / Architecture
Hackathon judges love to see clever solutions to hard problems:
* **Decoupled Architecture**: Understanding why we separated the heavy scraping logic (Node.js) from the mobile display logic (React Native), using Firebase as the "bridge" in the middle.
* **Fallback Mechanisms**: Writing code that expects to fail (e.g., wrapping the Tesseract OCR inside a `try/catch` block so if an image is corrupted, the whole app doesn't crash).
