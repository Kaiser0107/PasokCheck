const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://web-scraper-suspension-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = getDatabase();

async function feedData() {
  const fakePost = {
    postId: "manual_hackathon_seed_1",
    timestamp: new Date().toISOString(),
    text: "#WALANGPASOK | AUGUST 29, 2026 (SATURDAY)\n\nUnder the directive of Governor Aurelio Oyie Matias Umali based on the recommendation of the Provincial Disaster Risk Reduction and Management Office (PDRRMO), and in accordance with Executive Order No. 27, Series of 2026, face-to-face classes in all levels throughout the province of Nueva Ecija will be suspended tomorrow, August 29, 2026, Saturday.\n\nThis suspension includes colleges and universities, including college students who are scheduled to have classes on Saturdays.\n\nSchools and higher education institutions are advised to implement appropriate alternative delivery modes, such as asynchronous learning, in accordance with their existing policies and guidelines.",
    status: "Asynchronous"
  };

  // Check if PGNEOfficial exists
  const snapshot = await db.ref('tracked_pages').once('value');
  const pages = snapshot.val();
  
  // Find the exact key for PGNEOfficial (it might be PGNEOfficial or something else)
  let targetKey = "PGNEOfficial";
  for (const key in pages) {
    if (pages[key].url.includes("PGNEOfficial")) {
      targetKey = key;
      break;
    }
  }

  // Get current history or empty
  const currentData = (await db.ref(`tracked_pages/${targetKey}`).once('value')).val() || {};
  let currentHistory = currentData.history || [];
  
  // Inject the post at the top
  currentHistory.unshift(fakePost);

  await db.ref(`tracked_pages/${targetKey}`).update({
    hasDoneInitialFetch: true,
    history: currentHistory,
    latestStatus: "Asynchronous",
    lastUpdated: new Date().toISOString()
  });

  console.log(`Successfully fed mock post into ${targetKey}!`);
  process.exit(0);
}

feedData();

