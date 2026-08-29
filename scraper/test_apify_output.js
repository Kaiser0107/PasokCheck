const { ApifyClient } = require('apify-client');
require('dotenv').config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function test() {
  const run = await client.actor("apify/facebook-posts-scraper").call({
      startUrls: [{ url: "https://www.facebook.com/PGNEOfficial" }],
      resultsLimit: 2
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log('facebookUrl:', items[0].facebookUrl);
  console.log('inputUrl:', items[0].inputUrl);
  console.log('url:', items[0].url);
}

test();
