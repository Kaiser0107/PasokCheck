import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDu7qv3DV-Qiz7CX56ZbYPLIAnHOQLMgH0",
  authDomain: "web-scraper-suspension.firebaseapp.com",
  databaseURL: "https://web-scraper-suspension-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "web-scraper-suspension",
  storageBucket: "web-scraper-suspension.firebasestorage.app",
  messagingSenderId: "220782143584",
  appId: "1:220782143584:web:beff35f2282eb2fe4a3b05",
  measurementId: "G-Y1V9WDFFX6"
};

// Initialize Firebase (prevent re-initializing during Fast Refresh in React Native)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Get a reference to the Realtime Database
const db = getDatabase(app);

export { app, db };

