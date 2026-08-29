const { ApifyClient } = require('apify-client');
require('dotenv').config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function test() {
  try {
    console.log("Calling Apify actor...");
    const run = await client.actor("apify/facebook-posts-scraper").call({
        startUrls: [{ url: "https://www.facebook.com/PGNEOfficial" }],
        resultsLimit: 2
    });
    console.log("Run finished:", run.id);
  } catch (error) {
    console.error("APIFY ERROR:", error);
  }
}

test();

