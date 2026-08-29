const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://web-scraper-suspension-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = getDatabase();

async function reset() {
  const snapshot = await db.ref('tracked_pages').once('value');
  const pages = snapshot.val();
  for (const key in pages) {
    await db.ref(`tracked_pages/${key}`).update({ hasDoneInitialFetch: false, history: [] });
    console.log("Reset", key);
  }
  process.exit(0);
}
reset();

